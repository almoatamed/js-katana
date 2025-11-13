import { createAdapter as createRedisAdapter } from "@socket.io/redis-adapter";
import cluster from "cluster";
import http from "http";
import { pid } from "process";
import { Server, Socket } from "socket.io";
import { createLogger } from "kt-logger";
import { gerRedisClient, getSocketPrefix } from "../loadConfig/index.js";
import { createRequestError, extractRequestError } from "../router/index.js";
import { ChannelHandler, createSocketRouter } from "./sucketRouter/index.js";
const { setupMaster, setupWorker } = await import("@socket.io/sticky");
const { createAdapter: createClusterAdapter, setupPrimary } = await import("@socket.io/cluster-adapter");

const log = await createLogger({
    worker: false,
    color: "yellow",
    logLevel: "Info",
    name: "Channels-Manager",
});

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

export const defineEmittedEvent = <B, R = never>(event: string) => {
    return {
        event,
        body: null as unknown as B,
        response: null as unknown as R,
    };
};
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

// Pre-computed handler lookup map for O(1) access: normalizedPath -> handler index
const handlerPathMap = new Map<string, number>();

// Normalize path: ensure it ends with "/"
const normalizePath = (path: string): string => {
    return path.endsWith("/") ? path : path + "/";
};

// Rebuild handler path map when handlers change (call after handlers array modifications)
export const rebuildHandlerPathMap = () => {
    handlerPathMap.clear();
    for (let i = 0; i < handlers.length; i++) {
        handlerPathMap.set(normalizePath(handlers[i].path), i);
    }
};

export const registerSocket = async (socket: Socket) => {
    log("socket connection", socket.id);
    try {
        const socketRouter = createSocketRouter(socket);
        let hasHandlers = false;
        // Use Maps/Sets for O(1) lookups instead of O(n) array finds
        const appliedBeforeMountedMiddlewares = new Map<string, { accepted: boolean; rejectionReason?: string }>();
        const appliedMiddlewares = new Map<string, { processed: any[]; accepted: boolean; rejectionReason?: string }>();
        const appliedMountedMiddlewares = new Set<string>();
        // Use Map for O(1) accessMap lookups
        const accessMap = new Map<
            string,
            {
                accessible: boolean;
                rejectionReason?: string;
                beforeMountedMiddlewarePath?: string;
                middlewarePath?: string;
            }
        >();
        socket.data.accessMap = accessMap;

        // Ensure handler path map is up to date (should be built at startup, but check as fallback)
        if (handlerPathMap.size !== handlers.length) {
            rebuildHandlerPathMap();
        }

        for (let handlerIndex = 0; handlerIndex < handlers.length; handlerIndex++) {
            const handler = handlers[handlerIndex];
            const normalizedPath = normalizePath(handler.path);
            let allBeforeMountedMiddlewaresAccepted = true;
            if (handler.beforeMountedMiddlewares?.length) {
                for (const beforeMountedMiddleware of handler.beforeMountedMiddlewares) {
                    const middlewarePath = beforeMountedMiddleware.path;
                    const foundApplied = appliedBeforeMountedMiddlewares.get(middlewarePath);

                    if (!foundApplied) {
                        let beforeMountedMiddlewaresAccepted = true;
                        let rejectionReason: string | undefined;

                        for (const beforeMiddleware of beforeMountedMiddleware.middleware) {
                            const middlewareAccepted = await beforeMiddleware(socket);

                            if (middlewareAccepted === false || typeof middlewareAccepted === "string") {
                                allBeforeMountedMiddlewaresAccepted = false;
                                beforeMountedMiddlewaresAccepted = false;
                                rejectionReason =
                                    typeof middlewareAccepted === "string"
                                        ? middlewareAccepted
                                        : "one of the middlewares before mounted handlers rejected";
                                break;
                            }
                        }

                        appliedBeforeMountedMiddlewares.set(middlewarePath, {
                            accepted: beforeMountedMiddlewaresAccepted,
                            rejectionReason,
                        });

                        if (!allBeforeMountedMiddlewaresAccepted) {
                            accessMap.set(normalizedPath, {
                                accessible: false,
                                beforeMountedMiddlewarePath: middlewarePath,
                                rejectionReason: rejectionReason!,
                            });
                            break;
                        }
                    } else {
                        allBeforeMountedMiddlewaresAccepted = foundApplied.accepted;

                        if (!allBeforeMountedMiddlewaresAccepted) {
                            accessMap.set(normalizedPath, {
                                accessible: false,
                                beforeMountedMiddlewarePath: middlewarePath,
                                rejectionReason:
                                    foundApplied.rejectionReason ||
                                    "one of the middlewares before mounted handlers rejected",
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
                const accepted = await handler.beforeMounted(socket);
                if (accepted === false || typeof accepted === "string") {
                    accessMap.set(normalizedPath, {
                        accessible: false,
                        rejectionReason:
                            typeof accepted === "string"
                                ? accepted
                                : "this event not accessible, rejected on event before mounted",
                    });
                    continue;
                }
            }

            const mainHandlers = await handler.handler?.(socket);
            if (mainHandlers && typeof mainHandlers !== "string") {
                const handlerChain: ChannelHandler<any, any>[] = [];
                let allMiddlewaresAccepted = true;

                for (const middleware of handler.middlewares) {
                    const middlewarePath = middleware.path;
                    const foundApplied = appliedMiddlewares.get(middlewarePath);

                    if (!foundApplied) {
                        const processed: any[] = [];
                        let rejectionReason: string | undefined;

                        for (const middlewareHandlerBuilder of middleware.middleware) {
                            const processedMiddlewareHandler = await middlewareHandlerBuilder(socket);
                            if (processedMiddlewareHandler && typeof processedMiddlewareHandler !== "string") {
                                processed.push(processedMiddlewareHandler);
                            } else {
                                allMiddlewaresAccepted = false;
                                rejectionReason =
                                    typeof processedMiddlewareHandler === "string"
                                        ? processedMiddlewareHandler
                                        : "one of the middlewares handlers rejected";
                                break;
                            }
                        }

                        appliedMiddlewares.set(middlewarePath, {
                            processed: allMiddlewaresAccepted ? processed : [],
                            accepted: allMiddlewaresAccepted,
                            rejectionReason,
                        });

                        if (!allMiddlewaresAccepted) {
                            accessMap.set(normalizedPath, {
                                accessible: false,
                                middlewarePath,
                                rejectionReason: rejectionReason!,
                            });
                            break;
                        }

                        handlerChain.push(...processed);
                    } else {
                        if (foundApplied.accepted) {
                            handlerChain.push(...foundApplied.processed);
                        } else {
                            allMiddlewaresAccepted = false;
                            accessMap.set(normalizedPath, {
                                accessible: false,
                                middlewarePath,
                                rejectionReason:
                                    foundApplied.rejectionReason || "one of the middlewares handlers rejected",
                            });
                            break;
                        }
                    }
                }

                if (!allMiddlewaresAccepted) {
                    continue;
                }

                handlerChain.push(mainHandlers);
                hasHandlers = true;

                socketRouter.on(normalizedPath, handlerChain);
            } else {
                accessMap.set(normalizedPath, {
                    accessible: false,
                    rejectionReason: typeof mainHandlers === "string" ? mainHandlers : "this event not accessible",
                });
                continue;
            }

            if (handler.mounted) {
                await handler.mounted(socket);
            }

            if (handler.mountedMiddlewares?.length) {
                for (const mountedMiddleware of handler.mountedMiddlewares) {
                    const middlewarePath = mountedMiddleware.path;
                    if (!appliedMountedMiddlewares.has(middlewarePath)) {
                        for (const middleware of mountedMiddleware.middleware) {
                            await middleware(socket);
                        }
                        appliedMountedMiddlewares.add(middlewarePath);
                    }
                }
            }
        }
        if (!hasHandlers) {
            socket.disconnect();
        } else {
            socketRouter.ensureAttached();
        }
    } catch (error: any) {
        log.error("Channel Error", error);
        if (socket.connected) {
            if (error) {
                const e = extractRequestError(error);
                if (e) {
                    socket.emit("error", e);
                } else {
                    socket.emit(
                        "error",
                        createRequestError(500, [
                            {
                                error: "Unknown Socket error",
                                data: error,
                            },
                        ])
                    );
                }
            } else {
                socket.emit(
                    "error",
                    createRequestError(500, [
                        {
                            error: "Unknown Socket error",
                            data: error,
                        },
                    ])
                );
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
