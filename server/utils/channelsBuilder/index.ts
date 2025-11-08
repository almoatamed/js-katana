import { createAdapter as createRedisAdapter } from "@socket.io/redis-adapter";
import cluster from "cluster";
import http from "http";
import { pid } from "process";
import { Server, Socket } from "socket.io";
import { createLogger } from "kt-logger";
import { gerRedisClient, getSocketPrefix } from "../loadConfig/index.js";
import { createRequestError, extractRequestError } from "../router/index.js";
const { setupMaster, setupWorker } = await import("@socket.io/sticky");
const { createAdapter: createClusterAdapter, setupPrimary } = await import("@socket.io/cluster-adapter");

const log = await createLogger({
    worker: false,
    color: "yellow",
    logLevel: "Info",
    name: "Channels-Manager",
});

export type Respond<T> = (response: T) => void;

export type ChannelHandlerBeforeMounted = (
    socket: Socket
) => null | undefined | void | string | boolean | Promise<null | undefined | void | string | boolean>;
const defineChannelBeforeMounted = (definition: ChannelHandlerBeforeMounted) => definition;
export const channelBeforeMountedSymbol = Symbol("Channel Before Mounted");
defineChannelBeforeMounted.__symbol = channelBeforeMountedSymbol;
export { defineChannelBeforeMounted };

export type ChannelHandlerBuilder<B, R> = (
    socket: Socket
) =>
    | ChannelHandler<B, R>
    | null
    | void
    | undefined
    | string
    | Promise<ChannelHandler<B, R> | string | void | null | undefined>;

// handler shape (very important: respond is an *optional param*, not a union)
type ChannelHandlerSimple<B, R> = (body: B, respond: (response: R) => void | undefined, ev: string) => unknown;

// defineChannelHandler with generics that will be inferred from `definition`
const defineChannelHandler = <B, R>(
    definition: (socket: Socket) =>
        | {
              middlewares?: ChannelHandlerSimple<B, R>[];
              handler: ChannelHandlerSimple<B, R>;
          }
        | Promise<{
              middlewares?: ChannelHandlerSimple<B, R>[];
              handler: ChannelHandlerSimple<B, R>;
          }>
): ChannelHandlerBuilder<B, R> => {
    return async (socket) => {
        const result = await definition(socket);
        if (result && typeof result !== "string") {
            return [...(result.middlewares ?? []), result.handler];
        }
        return result as any;
    };
};

export const defineEmittedEvent = <B, R = never>(
    event: string,
)=>{
    return {
        event,
        body: null as unknown as B,
        response: null as unknown as R,
    }
}
export const channelHandlerSymbol = Symbol("Channel Handler Builder");
defineChannelHandler.__symbol = channelHandlerSymbol;
export { defineChannelHandler };

export type ChannelHandlerMounted = (
    socket: Socket
) => null | undefined | void | string | Promise<null | undefined | void | string>;

const defineChannelMounted = (definition: ChannelHandlerMounted) => definition;
export const channelMountedSymbol = Symbol("Channel Mounted");
defineChannelMounted.__symbol = channelMountedSymbol;
export { defineChannelMounted };

export type ChannelHandlerFunction<B, R> = (body: B, respond: ((response: R) => void) | undefined, ev: string) => any;
export type _ChannelHandler<B, R> = ChannelHandler<B, R>[];
export type ChannelHandler<B, R> = ChannelHandlerFunction<B, R> | _ChannelHandler<B, R>;
export type ChannelDirectoryAliasDefaultExport = {
    targetDirectory: string;
    includeTargetMiddlewares: boolean;
};

export const handlers: {
    path: string;

    beforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[];
    middlewares: {
        middleware: ChannelHandlerBuilder<any, any>[];
        path: string;
    }[];
    mountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[];

    handler?: ChannelHandlerBuilder<any, any>;
    mounted?: ChannelHandlerMounted;
    beforeMounted?: ChannelHandlerBeforeMounted;
}[] = [];

export const perform = async (
    body: any,
    respond: Respond<any> | undefined,
    handler: ChannelHandler<any, any>,
    ev: string
) => {
    if (typeof handler == "function") {
        await handler(body, respond, ev);
    } else if (Array.isArray(handler)) {
        for (const subHandler of handler) {
            await perform(body, respond, subHandler, ev);
        }
    }
};

export const registerSocket = async (socket: Socket) => {
    log("socket connection", socket.id);
    try {
        let hasHandlers = false;
        const appliedBeforeMountedMiddlewares: {
            path: string;
            accepted: boolean;
        }[] = [];
        const appliedMiddlewares: {
            path: string;
            processed: any[];
            accepted: boolean;
        }[] = [];
        const appliedMountedMiddlewares: string[] = [];
        socket.data.accessMap = [];
        for (const handler of handlers) {
            let allBeforeMountedMiddlewaresAccepted = true;
            if (handler.beforeMountedMiddlewares?.length) {
                for (const beforeMountedMiddleware of handler.beforeMountedMiddlewares) {
                    const foundApplied = appliedBeforeMountedMiddlewares.find(
                        (abmm) => abmm.path == beforeMountedMiddleware.path
                    );
                    if (!foundApplied) {
                        let beforeMountedMiddlewaresAccepted = true;
                        for (const beforeMiddleware of beforeMountedMiddleware.middleware) {
                            const middlewareAccepted = await beforeMiddleware(socket);

                            if (middlewareAccepted === false || typeof middlewareAccepted == "string") {
                                allBeforeMountedMiddlewaresAccepted = false;
                                beforeMountedMiddlewaresAccepted = false;

                                socket.data.accessMap.push({
                                    accessible: false,
                                    path: handler.path,
                                    beforeMountedMiddlewarePath: beforeMountedMiddleware.path,
                                    rejectionReason:
                                        typeof middlewareAccepted == "string"
                                            ? middlewareAccepted
                                            : "one of the middlewares before mounted handlers rejected",
                                });
                                break;
                            }
                        }
                        appliedBeforeMountedMiddlewares.push({
                            path: beforeMountedMiddleware.path,
                            accepted: beforeMountedMiddlewaresAccepted,
                        });

                        if (allBeforeMountedMiddlewaresAccepted === false) {
                            break;
                        }
                    } else {
                        allBeforeMountedMiddlewaresAccepted = foundApplied.accepted;

                        if (allBeforeMountedMiddlewaresAccepted === false) {
                            socket.data.accessMap.push({
                                accessible: false,
                                path: handler.path,
                                rejectionReason:
                                    socket.data.accessMap?.find((a) => {
                                        return a?.beforeMountedMiddlewarePath == foundApplied.path;
                                    })?.rejectionReason || "one of the middlewares before mounted handlers rejected",
                            });
                            break;
                        }
                    }
                }
            }
            if (!allBeforeMountedMiddlewaresAccepted) {
                continue;
            }

            if (handler.beforeMounted) {
                const accepted = await handler.beforeMounted?.(socket);
                if (accepted === false || typeof accepted == "string") {
                    socket.data.accessMap.push({
                        path: handler.path,
                        accessible: false,
                        rejectionReason:
                            typeof accepted == "string"
                                ? accepted
                                : "this event not accessible, rejected on event before mounted",
                    });
                    continue;
                }
            }

            const mainHandlers = await handler.handler?.(socket);
            if (mainHandlers && typeof mainHandlers != "string") {
                const handlers: ChannelHandler<any, any>[] = [];
                let allMiddlewaresAccepted = true;
                for (const middleware of handler.middlewares) {
                    let middlewareHandler: any[] = [];
                    const foundApplied = appliedMiddlewares.find((am) => am.path == middleware.path);
                    if (!foundApplied) {
                        const processed = [] as any[];

                        for (const middlewareHandler of middleware.middleware) {
                            const processedMiddlewareHandler = await middlewareHandler(socket);
                            if (!!processedMiddlewareHandler && typeof processedMiddlewareHandler != "string") {
                                processed.push(processedMiddlewareHandler);
                            } else {
                                socket.data.accessMap.push({
                                    accessible: false,
                                    path: handler.path,
                                    middlewarePath: middleware.path,
                                    rejectionReason:
                                        typeof processedMiddlewareHandler == "string"
                                            ? processedMiddlewareHandler
                                            : "one of the middlewares handlers rejected",
                                });
                                allMiddlewaresAccepted = false;
                                break;
                            }
                        }
                        if (!allMiddlewaresAccepted) {
                            appliedMiddlewares.push({
                                path: middleware.path,
                                processed: [],
                                accepted: false,
                            });
                            break;
                        }

                        appliedMiddlewares.push({
                            path: middleware.path,
                            processed: processed,
                            accepted: true,
                        });
                        middlewareHandler = processed;
                    } else {
                        if (foundApplied.accepted) {
                            middlewareHandler = foundApplied.processed;
                        } else {
                            allMiddlewaresAccepted = false;
                            socket.data.accessMap.push({
                                accessible: false,
                                path: handler.path,
                                rejectionReason:
                                    socket.data.accessMap?.find((a) => {
                                        return a?.middlewarePath == foundApplied.path;
                                    })?.rejectionReason || "one of the middlewares handlers rejected",
                            });
                            break;
                        }
                    }
                    handlers.push(...middlewareHandler);
                }

                if (!allMiddlewaresAccepted) {
                    continue;
                }
                handlers.push(mainHandlers);
                hasHandlers = true;
                if (!handler.path.endsWith("/")) {
                    handler.path = handler.path + "/";
                }
                socket.on(handler.path, async (body: any, cb?: Respond<any>) => {
                    try {
                        await perform(body, cb, handlers, handler.path);
                    } catch (error: any) {
                        const e = extractRequestError(error);
                        log.error("Channel Error", handler.path, error);
                        if (cb) {
                            if (e) {
                                cb(e);
                            } else {
                                cb(
                                    createRequestError(500, [
                                        {
                                            error: "Unknown Socket error",
                                            data: error,
                                        },
                                    ])
                                );
                            }
                        }
                    }
                });
            } else {
                socket.data.accessMap.push({
                    path: handler.path,
                    accessible: false,
                    rejectionReason: typeof mainHandlers == "string" ? mainHandlers : "this event not accessible",
                });
                continue;
            }

            if (handler.mounted) {
                await handler.mounted(socket);
            }

            if (handler.mountedMiddlewares?.length) {
                for (const mountedMiddleware of handler.mountedMiddlewares) {
                    if (!appliedMountedMiddlewares.find((path) => path == mountedMiddleware.path)) {
                        for (const middleware of mountedMiddleware.middleware) {
                            await middleware(socket);
                        }
                        appliedMountedMiddlewares.push(mountedMiddleware.path);
                    }
                }
            }
        }

        socket.use(([event, ...args], next) => {
            const cb = args?.at?.(-1);
            const foundEvent = handlers.find((h) => {
                return h.path == event;
            });
            log("incoming event", event, foundEvent?.path ? "(event found)" : "(event not found)");
            if (typeof cb == "function") {
                if (!foundEvent) {
                    log(`event not found`, event);
                    cb({
                        error: {
                            msg: "event not found",
                        },
                    });
                    return;
                }
                const foundAccessibility = socket.data.accessMap.find((a) => a.path == event);
                if (foundAccessibility) {
                    if (foundAccessibility.accessible === false) {
                        cb({
                            // statusCode: 403,
                            error: {
                                msg: foundAccessibility.rejectionReason || "event not accessible",
                            },
                        });
                    } else {
                        next();
                    }
                } else {
                    next();
                }
            } else {
                next();
            }
        });

        if (!hasHandlers) {
            socket.disconnect();
        }
    } catch (error: any) {
        log.error("Channel Error", error);
        if (socket.connected) {
            if (error.error) {
                socket.emit("error", {
                    error: error.error,
                    statusCode: error?.statusCode,
                });
            } else {
                socket.emit("error", {
                    error: error,
                });
            }
            socket.disconnect();
        }
    }
};

export let io: Server;

export const emit = (event: string, ...args: any[]) => io.emit(event, ...args);

export const emitToRoom = (room: string, event: string, ...arg: any[]) => {
    io.to(room).emit(event, ...arg);
};

export const run = async (httpServer: http.Server) => {
    io = new Server(httpServer, {
        path: await getSocketPrefix(),
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        perMessageDeflate: {
            threshold: 1024, // Minimum size in bytes before compressing
            zlibDeflateOptions: {
                // Options for zlib's deflate
                chunkSize: 1024,
            },
            zlibInflateOptions: {
                // Options for zlib's inflate
                chunkSize: 10 * 1024,
            },
        },
    });
    const redisClient = await gerRedisClient();
    if (redisClient) {
        const pub = redisClient.duplicate();
        const sub = redisClient.duplicate();
        io.adapter(createRedisAdapter(pub, sub));
    }
    io.on("connection", async (socket) => {
        await registerSocket(socket);
    });
};
export const runThreaded = async (httpServer: http.Server) => {
    if (cluster.isPrimary) {
        setupMaster(httpServer, {
            loadBalancingMethod: "least-connection",
        });
        setupPrimary();
        log("setup primary cluster done");
    } else {
        io = new Server(httpServer, {
            path: await getSocketPrefix(),
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            },
            perMessageDeflate: {
                threshold: 1024, // Minimum size in bytes before compressing
                zlibDeflateOptions: {
                    // Options for zlib's deflate
                    chunkSize: 1024,
                },
                zlibInflateOptions: {
                    // Options for zlib's inflate
                    chunkSize: 10 * 1024,
                },
            },
        });

        io.adapter(createClusterAdapter());
        const redisClient = await gerRedisClient();
        if (redisClient) {
            const pub = redisClient.duplicate();
            const sub = redisClient.duplicate();
            io.adapter(createRedisAdapter(pub, sub));
        }
        setupWorker(io);
        io.on("connection", async (socket) => {
            log("connected", socket.id, pid);
            await registerSocket(socket);
        });
    }
};
