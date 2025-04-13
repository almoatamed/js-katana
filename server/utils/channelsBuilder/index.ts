import { createAdapter as createRedisAdapter } from "@socket.io/redis-adapter";
import cluster from "cluster";
import http from "http";
import { pid } from "process";
import { Server, Socket } from "socket.io";
import { fileURLToPath } from "url";
import { redisConfig } from "../../config/redis/index.js";
import { routerConfig } from "../../config/routing/index.js";
import { redisClient } from "../redis/index.js";
const { setupMaster, setupWorker } = await import("@socket.io/sticky");
const { createAdapter: createClusterAdapter, setupPrimary } = await import("@socket.io/cluster-adapter");

const path = (await import("path")).default;
const fs = (await import("fs")).default;
const logUtil = await import("$/server/utils/log/index.js");
const log = await logUtil.localLogDecorator("channelsBuilder", "yellow", true, "Info", false);

const directoryAliasSuffixRegx = RegExp(routerConfig.getDirectoryAliasSuffixRegx());
const channelSuffixRegx = RegExp(routerConfig.getChannelSuffixRegx());
const middlewareSuffixRegx = RegExp(routerConfig.getMiddlewareSuffixRegx());
const descriptionSuffixRegx = RegExp(routerConfig.getDescriptionSuffixRegx());

const aliases: Function[] = [];

const srcPath = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../."));

const resolveTs = (path: string) => {
    if (path.endsWith(".ts")) {
        path = path.replace(/\.ts$/, ".js");
    }
    return path;
};

export type Respond = (response: any) => void;

export type ChannelHandlerBeforeMounted = (
    socket: Socket,
) => null | undefined | void | string | boolean | Promise<null | undefined | void | string | boolean>;
export type ChannelHandlerBuilder = (
    socket: Socket,
) => ChannelHandler | null | void | undefined | string | Promise<ChannelHandler | string | void | null | undefined>;
export type ChannelHandlerMounted = (
    socket: Socket,
) => null | undefined | void | string | Promise<null | undefined | void | string>;

export type ChannelHandlerFunction = (body: any, respond: Respond | undefined, ev: string) => any;
export type _ChannelHandler = ChannelHandler[];
export type ChannelHandler = ChannelHandlerFunction | _ChannelHandler;
export type ChannelDirectoryAliasDefaultExport = {
    targetDirectory: string;
    includeTargetMiddlewares: boolean;
};

export async function getMiddlewaresArray(
    currentChannelsDirectory: string,
): Promise<
    { default?: ChannelHandlerBuilder; mounted?: ChannelHandlerMounted; beforeMounted?: ChannelHandlerBeforeMounted }[]
> {
    const content = fs.readdirSync(currentChannelsDirectory);
    const middlewares = await Promise.all(
        content
            .filter((f) => {
                const fileStats = fs.statSync(path.join(currentChannelsDirectory, f));
                return fileStats.isFile() && !!f.match(middlewareSuffixRegx);
            })
            .map(async (f) => {
                let fullPath = path.join(currentChannelsDirectory, f);

                return await import(resolveTs(fullPath));
            }),
    );
    return middlewares;
}

export const handlers: {
    path: string;

    beforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[];
    middlewares: {
        middleware: ChannelHandlerBuilder[];
        path: string;
    }[];
    mountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[];

    handler?: ChannelHandlerBuilder;
    mounted?: ChannelHandlerMounted;
    beforeMounted?: ChannelHandlerBeforeMounted;
}[] = [];

export const perform = async (body: any, respond: Respond | undefined, handler: ChannelHandler, ev: string) => {
    if (typeof handler == "function") {
        await handler(body, respond, ev);
    } else if (Array.isArray(handler)) {
        for (const subHandler of handler) {
            await perform(body, respond, subHandler, ev);
        }
    }
};

export const registerSocket = async (socket: Socket) => {
    console.log("socket connection", socket.id);
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
                        (abmm) => abmm.path == beforeMountedMiddleware.path,
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
                const handlers: ChannelHandler[] = [];
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
                socket.on(handler.path, async (body: any, cb?: Respond) => {
                    try {
                        await perform(body, cb, handlers, handler.path);
                    } catch (error: any) {
                        console.log(error);
                        log.error("Channel Error", handler.path, error);
                        if (cb) {
                            if (error?.httpError) {
                                error = {
                                    message: error.message,
                                    response: {
                                        data: error,
                                    },
                                };
                            }
                            if (error?.error) {
                                cb({
                                    error: error.error,
                                });
                            } else {
                                cb({
                                    error: error,
                                });
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
            console.log("incoming event", event, foundEvent?.path ? "(event found)" : "(event not found)");
            if (typeof cb == "function") {
                if (!foundEvent) {
                    console.log(`event not found`, event);
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

export const run = (httpServer: http.Server) => {
    io = new Server(httpServer, {
        path: routerConfig.getSocketPrefix(),
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
    if (redisConfig.useRedis()) {
        const pub = redisClient.duplicate();
        const sub = redisClient.duplicate();
        io.adapter(createRedisAdapter(pub, sub));
    }
    io.on("connection", async (socket) => {
        await registerSocket(socket);
    });
};
export const runThreaded = (httpServer: http.Server) => {
    if (cluster.isPrimary) {
        setupMaster(httpServer, {
            loadBalancingMethod: "least-connection",
        });
        setupPrimary();
        log("setup primary cluster done");
    } else {
        io = new Server(httpServer, {
            path: routerConfig.getSocketPrefix(),
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
        
        if (redisConfig.useRedis()) {
            const pub = redisClient.duplicate();
            const sub = redisClient.duplicate();
            io.adapter(createRedisAdapter(pub, sub));
        }
        setupWorker(io);

        io.on("connection", async (socket) => {
            console.log("connected", socket.id, pid);
            await registerSocket(socket);
        });
    }
};

export default async function buildChannelling(
    app: any,
    currentChannelsDirectory = path.join(srcPath, routerConfig.getChannelsDirectory()),
    root = true,
    fullPrefix = "/",
    providedBeforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[] = [],
    providedMiddlewares: {
        middleware: ChannelHandlerBuilder[];
        path: string;
    }[] = [],
    providedMountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[] = [],
) {
    const content = fs.readdirSync(currentChannelsDirectory);
    root && log("Building Channels", currentChannelsDirectory);

    const beforeMountedMiddlewares = [...(providedBeforeMountedMiddlewares || [])];
    const middlewares = [...(providedMiddlewares || [])];
    const mountedMiddlewares = [...(providedMountedMiddlewares || [])];

    const loadedMiddlewares = await getMiddlewaresArray(currentChannelsDirectory);

    for (const middleware of loadedMiddlewares || []) {
        if (middleware.beforeMounted) {
            const foundBeforeMountedMiddleware = beforeMountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundBeforeMountedMiddleware) {
                foundBeforeMountedMiddleware.middleware.push(middleware.beforeMounted);
            } else {
                beforeMountedMiddlewares.push({
                    middleware: [middleware.beforeMounted],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.default) {
            const foundMiddleware = middlewares.find((pm) => pm.path == fullPrefix);
            if (foundMiddleware) {
                foundMiddleware.middleware.push(middleware.default);
            } else {
                middlewares.push({
                    middleware: [middleware.default],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.mounted) {
            const foundMountedMiddleware = mountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundMountedMiddleware) {
                foundMountedMiddleware.middleware.push(middleware.mounted);
            } else {
                mountedMiddlewares.push({
                    middleware: [middleware.mounted],
                    path: fullPrefix,
                });
            }
        }
    }

    for (const item of content) {
        const itemStat = fs.statSync(path.join(currentChannelsDirectory, item));

        if (itemStat.isDirectory()) {
            await buildChannelling(
                app,
                path.join(currentChannelsDirectory, item),
                false,
                path.join(fullPrefix, item),
                beforeMountedMiddlewares,
                middlewares,
                mountedMiddlewares,
            );
        } else {
            const channelMatch = item.match(channelSuffixRegx);
            if (!!channelMatch) {
                // process.env.NODE_ENV !== "test" && console.log("Route", currentChannelsDirectory);
                const routerName = item.slice(0, item.indexOf(channelMatch[0]));
                if (routerName == "index") {
                    const handlerPath = resolveTs(path.join(currentChannelsDirectory, item));
                    const { default: handler, mounted, beforeMounted } = await import(handlerPath);
                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`,
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    handlers.push({
                        path: fullPrefix,

                        beforeMounted,
                        handler,
                        mounted,

                        middlewares: [...middlewares],
                        mountedMiddlewares: [...mountedMiddlewares],
                        beforeMountedMiddlewares: [...beforeMountedMiddlewares],
                    });
                    routerDescriptionFile &&
                        app.get(path.join("channelling", fullPrefix, "describe"), async (request, response, next) => {
                            try {
                                response.sendFile(
                                    path.join(currentChannelsDirectory, routerDescriptionFile),
                                    (error) => {
                                        !!error && next(error);
                                    },
                                );
                            } catch (error: any) {
                                next(error);
                            }
                        });
                } else {
                    const handlerPath = resolveTs(path.join(currentChannelsDirectory, item));
                    const { default: handler, mounted, beforeMounted } = await import(handlerPath);
                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`,
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    const channelPath = path.join(fullPrefix, routerName);
                    handlers.push({
                        path: channelPath,

                        mounted,
                        handler,
                        beforeMounted,

                        middlewares: [...middlewares],
                        mountedMiddlewares: [...mountedMiddlewares],
                        beforeMountedMiddlewares: [...beforeMountedMiddlewares],
                    });
                    routerDescriptionFile &&
                        app.get(path.join("channelling", channelPath, "describe"), async (request, response, next) => {
                            try {
                                response.sendFile(
                                    path.join(currentChannelsDirectory, routerDescriptionFile),
                                    (error) => {
                                        !!error && next(error);
                                    },
                                );
                            } catch (error: any) {
                                next(error);
                            }
                        });
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (!!directoryAliasMatch) {
                    aliases.push(async () => {
                        const routerAlias: ChannelDirectoryAliasDefaultExport = (
                            await import(path.join(currentChannelsDirectory, item))
                        ).default;
                        const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                        const aliases = handlers
                            .filter((h) => {
                                return h.path.startsWith(routerAlias.targetDirectory);
                            })
                            .map((h) => {
                                const newHandler = { ...h };
                                newHandler.path = newHandler.path.replace(
                                    RegExp(`^${routerAlias.targetDirectory.replaceAll("/", "\\/")}`),
                                    path.join(fullPrefix, routerName),
                                );
                                if (routerAlias.includeTargetMiddlewares) {
                                    newHandler.beforeMountedMiddlewares = [
                                        ...beforeMountedMiddlewares,
                                        ...(newHandler.beforeMountedMiddlewares || []),
                                    ];
                                    newHandler.middlewares = [...middlewares, ...(newHandler.middlewares || [])];
                                    newHandler.mountedMiddlewares = [
                                        ...mountedMiddlewares,
                                        ...(newHandler.mountedMiddlewares || []),
                                    ];
                                } else {
                                    newHandler.beforeMountedMiddlewares = [...beforeMountedMiddlewares];
                                    newHandler.middlewares = [...middlewares];
                                    newHandler.mountedMiddlewares = [...mountedMiddlewares];
                                }
                                return newHandler;
                            });
                        handlers.push(...aliases);
                    });
                }
            }
        }
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
    }
    root && log("finished", currentChannelsDirectory);
}
