import fs from "fs";
import os from "os";
import path from "path";
import Stream from "stream";
import { mkdir } from "fs/promises";
import { rename } from "fs/promises";
import { createRequestError, HandlerContext, Middleware, routerSymbol, throwRequestError } from "../router/index.js";

function parseContentType(ct?: string) {
    // ct example: multipart/form-data; boundary=----WebKitFormBoundary...
    if (!ct) return null;
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return m ? m[1] || m[2] : null;
}

function sanitizeFilename(name = "file") {
    // keep basename, remove dangerous chars
    return path.basename(name).replace(/[^\w.\-() ]+/g, "_");
}

export type CurrentMultipartField =
    | {
          isFile: true;
          headers: {
              [headerName: string]: string;
          };
          tempPath: string;
          name: string;
          filename: string;
          mimeType: string;
          stream: Stream.Writable;
          bytesWritten: number;
      }
    | {
          chunks: Buffer[];
          size: number;
          isFile: false;
          name: string;
      };

export class MultipartParser<Source extends NodeJS.ReadableStream> {
    req: Source;
    boundary: Buffer;
    boundaryDash: Buffer;
    boundarySep: Buffer;
    onField: (name: string, value: string) => void;
    onFile: (props: {
        fileName: string;
        fieldName: string;
        path: string;
        move: (directory: string, fileName?: string) => Promise<void>;
        mimeType: string;
        size: number;
    }) => void;
    onFinish: () => void;
    onError: (err: any) => void;
    maxFieldSize: number;
    maxFileSize: number;
    totalLimit: number;

    _leftover: Buffer;
    _state: "INIT" | "HEADERS" | "BODY" | "END";
    totalBytes: number = 0;
    _current: CurrentMultipartField | null;
    _ended: boolean;

    constructor(
        req: Source,
        opts: {
            maxFieldSize?: number;
            maxFileSize?: number;
            totalLimit?: number;
            boundary: Buffer;
            onError: (err: any) => void;
            onField: (name: string, value: string) => void;
            onFile: (props: {
                fileName: string;
                fieldName: string;
                path: string;
                move: (target: string, fileName?: string) => Promise<void>;
                mimeType: string;
                size: number;
            }) => void;
            onFinish: () => void;
        }
    ) {
        this.req = req;
        this.boundary = opts.boundary; // Buffer
        this.boundaryDash = Buffer.concat([Buffer.from("--"), this.boundary]); // --boundary
        this.boundarySep = Buffer.concat([Buffer.from("\r\n"), this.boundaryDash]); // \r\n--boundary
        this.onField = opts.onField;
        this.onFile = opts.onFile;
        this.onFinish = opts.onFinish;
        this.onError = opts.onError;
        this.maxFieldSize = opts.maxFieldSize ?? 1024 * 1024; // 1MB default
        this.maxFileSize = opts.maxFileSize ?? 5 * 1024 * 1024 * 1024; // 5GB default
        this.totalBytes = 0;
        this.totalLimit = opts.totalLimit ?? 10 * 1024 * 1024 * 1024; // 10GB
        this._leftover = Buffer.alloc(0);
        this._state = "INIT"; // INIT -> HEADERS -> BODY -> END
        this._current = null; // { headers, name, filename, stream, bytesWritten, isFile }
        this._ended = false;
    }

    start() {
        const req = this.req;
        req.on("data", (chunk) => this._onData(chunk));
        req.on("end", () => this._onEnd());
        req.on("error", (err) => this._error(err));
    }

    _error(err: any) {
        this.onError(err);
        if (this._current && this._current.isFile) {
            try {
                this._current.stream?.destroy();
            } catch (e) {
                console.error(e);
            }
        }
    }

    _onData(chunk: Buffer) {
        this.totalBytes += chunk.length;
        if (this.totalBytes > this.totalLimit) return this._error(new Error("Total upload size limit exceeded"));

        // append leftover and process
        let buffer = Buffer.concat([this._leftover, chunk]);
        let offset = 0;

        // If first time, expect boundary at start (could start without leading CRLF)
        if (this._state === "INIT") {
            // boundary line must be at start: --boundary\r\n
            if (buffer.indexOf(this.boundaryDash) === 0) {
                // consume the initial boundary and following CRLF
                const after = buffer.indexOf("\r\n", this.boundaryDash.length);
                if (after === -1) {
                    // header incomplete; keep leftover
                    this._leftover = buffer;
                    return;
                }
                offset = after + 2;
                buffer = buffer.slice(offset);
                this._leftover = Buffer.alloc(0);
                this._state = "HEADERS";
            } else {
                return this._error(new Error("Bad multipart request: missing starting boundary"));
            }
        }

        // Main loop: find next boundary occurrences
        while (buffer.length) {
            if (this._state === "HEADERS") {
                // find header/body separator = \r\n\r\n
                const hdrEnd = buffer.indexOf("\r\n\r\n");
                if (hdrEnd === -1) {
                    // headers not complete yet -> keep buffer
                    this._leftover = buffer;
                    return;
                }
                const hdrBuf = buffer.slice(0, hdrEnd);
                const rawHeaders = hdrBuf.toString("utf8");
                const headers = parsePartHeaders(rawHeaders);
                // initialize current part meta
                const disp = headers["content-disposition"] || "";
                const cd = parseContentDisposition(disp);
                const contentType = headers["content-type"] || null;
                const isFile = !!cd.filename;
                const name = cd.name;
                let cur: CurrentMultipartField;
                if (isFile) {
                    const fileName = sanitizeFilename(cd.filename);
                    const tmp = path.join(
                        os.tmpdir(),
                        `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`
                    );
                    cur = {
                        headers,
                        name,
                        filename: fileName,
                        isFile,
                        bytesWritten: 0,
                        stream: fs.createWriteStream(tmp, { flags: "w" }),
                        tempPath: tmp,
                        mimeType: contentType || "application/octet-stream",
                    };
                    cur.stream.on("error", (err) => this._error(err));
                } else {
                    cur = {
                        isFile: false,
                        chunks: [],
                        size: 0,
                        name,
                    };
                }

                this._current = cur;
                // consume headers + \r\n\r\n
                buffer = buffer.slice(hdrEnd + 4);
                this._state = "BODY";
            }

            if (this._state === "BODY") {
                // find the boundary separator: \r\n--boundary  (or final --)
                // But the boundary could be right at the start (empty body), handle that.
                let boundaryIndex = buffer.indexOf(this.boundarySep);
                let finalBoundaryIndex = -1;
                if (boundaryIndex === -1) {
                    // maybe it's the very final boundary without preceding CRLF (only at exact end), check for "--boundary--"
                    const possible = Buffer.concat([Buffer.from("\r\n"), this.boundaryDash, Buffer.from("--")]);
                    finalBoundaryIndex = buffer.indexOf(possible);
                }

                // If no boundary found in current buffer, write whole buffer to part and continue reading
                if (boundaryIndex === -1 && finalBoundaryIndex === -1) {
                    // But we must be careful: boundary may be split across chunk end. Keep a small tail equal to boundary length + 4
                    const keep = this.boundary.length + 6; // safe tail
                    if (buffer.length <= keep) {
                        this._leftover = buffer;
                        return;
                    } else {
                        const writable = buffer.slice(0, buffer.length - keep);
                        this._writeToCurrent(writable);
                        // leftover gets kept for next chunk
                        this._leftover = buffer.slice(buffer.length - keep);
                        return;
                    }
                }

                // we found a boundary somewhere in buffer
                const idx = boundaryIndex !== -1 ? boundaryIndex : finalBoundaryIndex;
                const partData = buffer.slice(0, idx);
                this._writeToCurrent(partData);

                // finish current part
                this._finalizeCurrent();

                // determine if it's final boundary
                const rest = buffer.slice(idx);
                // rest starts with \r\n--boundary...
                // check if it's final boundary (ends with --)
                const afterBoundary = rest.slice(this.boundarySep.length); // bytes after \r\n--boundary
                if (afterBoundary.slice(0, 2).toString() === "--") {
                    // final boundary -> we are done
                    this._state = "END";
                    this._leftover = Buffer.alloc(0);
                    // no more processing; request might still have extra bytes but spec says end
                    return;
                } else {
                    // consume the boundary and the following CRLF (\r\n)
                    // rest should be: \r\n--boundary\r\n (then next headers)
                    const afterSep = rest.indexOf("\r\n", this.boundarySep.length);
                    if (afterSep === -1) {
                        // incomplete, keep leftover
                        this._leftover = rest;
                        return;
                    }
                    buffer = rest.slice(afterSep + 2);
                    // go to next part's headers
                    this._state = "HEADERS";
                    // loop continues
                }
            }

            if (this._state === "END") {
                this._leftover = Buffer.alloc(0);
                return;
            }
        } // end while

        // keep any remainder
        this._leftover = buffer;
    }

    _onEnd() {
        if (this._current && this._state !== "END") {
            // If stream ended without boundary, finalize current
            this._finalizeCurrent();
        }
        this.onFinish();
    }

    _writeToCurrent(buf: Buffer) {
        if (!this._current) return;
        if (this._current.isFile) {
            // enforce per-file limit
            this._current.bytesWritten += buf.length;
            if (this._current.bytesWritten > this.maxFileSize) {
                return this._error(new Error("Per-file size limit exceeded"));
            }
            // write to file stream
            if (!this._current.stream.write(buf)) {
                // backpressure handling: pause request until drain
                this.req.pause();
                this._current.stream.once("drain", () => this.req.resume());
            }
        } else {
            // field
            this._current.size += buf.length;
            if (this._current.size > this.maxFieldSize) {
                return this._error(new Error("Field size limit exceeded"));
            }
            this._current.chunks.push(buf);
        }
    }

    _finalizeCurrent() {
        const cur = this._current;
        if (!cur) return;
        if (cur.isFile) {
            // finalize file stream
            cur.stream.end();
            this.onFile({
                fieldName: cur.name,
                fileName: cur.filename,
                path: cur.tempPath,
                mimeType: cur.mimeType,
                size: cur.bytesWritten,
                async move(dir, name) {
                    await mkdir(dir, { recursive: true });
                    await rename(cur.tempPath, path.join(dir, name || cur.filename));
                },
            });
        } else {
            const val = Buffer.concat(cur.chunks || []).toString("utf8");
            this.onField(cur.name, val);
        }
        this._current = null;
    }
}

// helpers
function parsePartHeaders(raw: string) {
    const lines = raw
        .split("\r\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const headers: {
        [key: string]: string;
    } = {};
    for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const key = line.slice(0, idx).toLowerCase();
        const val = line.slice(idx + 1).trim();
        headers[key] = val;
    }
    return headers;
}

function parseContentDisposition(str: string) {
    // Example: form-data; name="file"; filename="a.png"
    const res: {
        [key: string]: string;
    } = {};
    const [type, ...rest] = str.split(";");
    res.type = type && type.trim();
    for (const part of rest) {
        const m = part.match(/([^=]+)=["']?([^"']+)["']?/);
        if (m) {
            res[m[1].trim()] = m[2];
        }
    }
    return res;
}

export type Handler<T, B, Q, P, H, S extends NodeJS.ReadableStream> = (
    context: HandlerContext<B, Q, P, H, S> & {
        files: {
            [fieldName: string]: {
                fileName: string;
                fieldName: string;
                path: string;
                move: (directory: string, fileName?: string) => Promise<void>;
                mimeType: string;
                size: number;
            }[];
        };
    },
    body: B,
    query: Q,
    params: P,
    headers: H
) => T;

type Route<T, B, Q, P, H, S extends NodeJS.ReadableStream> = {
    externalMiddlewares: Middleware<any, B, Q, P, H, S>[];
    middleWares: Handler<any, B, Q, P, H, S>[];
    serveVia: ("Http" | "Socket")[];
    __symbol: symbol;
    method: "GET" | "POST" | "PUT" | "DELETE" | "ALL" | "PATCH";
    handler: Handler<T, B, Q, P, H, S>;
};

export const createFormDataHandler = <T, B, Q, P, H, S extends NodeJS.ReadableStream>(
    props: Omit<
        Omit<Omit<Omit<Omit<Route<T, B, Q, P, H, S>, "externalMiddlewares">, "__symbol">, "serveVia">, "middleWares">,
        "handler"
    > & {
        middleWares?: Handler<any, B, Q, P, H, S>[];
        handler: Handler<T, B, Q, P, H, S>;
    }
) => {
    return {
        handler: props.handler,
        method: props.method,
        middleWares: [
            async (context) => {
                if (context.servedVia !== "http") {
                    throwRequestError(400, [
                        {
                            error: "Cannot Handle form data outside of http, dont use sockets for form data",
                        },
                    ]);
                    return;
                }
                const contentType = context.headers["content-type"];
                const boundaryStr = parseContentType(contentType);
                if (!boundaryStr) {
                    throwRequestError(400, [
                        {
                            error: "Processing FormData, could not find content-type boundary header",
                        },
                    ]);
                    return;
                }

                const fields: {
                    [key: string]: string;
                } = {};
                const files: {
                    [fieldName: string]: {
                        fileName: string;
                        fieldName: string;
                        path: string;
                        move: (directory: string, fileName?: string) => Promise<void>;
                        mimeType: string;
                        size: number;
                    }[];
                } = {};

                await new Promise<void>((resolve, reject) => {
                    const parser = new MultipartParser(context.sourceStream, {
                        boundary: Buffer.from(boundaryStr),
                        maxFieldSize: 1_000_000,
                        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
                        totalLimit: 12 * 1024 * 1024 * 1024, // 12GB
                        onField: (name, value) => {
                            fields[name] = value;
                        },
                        onFile: (meta) => {
                            let targetField = files[meta.fieldName];
                            if (!targetField) {
                                targetField = [];
                                files[meta.fieldName] = targetField;
                            }
                            targetField.push(meta);
                        },
                        onFinish: () => {
                            context.body = {
                                ...context.body,
                                ...fields,
                            } as B;
                            context.files = files;
                            resolve();
                        },
                        onError: (err) => {
                            console.error("Upload error:", err);
                            try {
                                reject(
                                    createRequestError(400, [
                                        {
                                            error: String(err.message) || "Unknown Error",
                                            data: err,
                                        },
                                    ])
                                );
                                return;
                            } catch (e) {
                                console.error(e);
                            }
                        },
                    });
                    parser.start();
                });
            },
            ...(props.middleWares || []),
        ],
        externalMiddlewares: [],
        serveVia: ["Http"],
        __symbol: routerSymbol,
    } as Route<T, B, Q, P, H, S>;
};
