import {
    ChannelHandlerBeforeMounted,
    ChannelHandlerBuilder,
    ChannelHandlerMounted,
    handlers,
} from "../channelsBuilder/index.js";
import {
    descriptionSuffixRegx,
    directoryAliasSuffixRegx,
    middlewareSuffixRegx,
    routerSuffixRegx,
} from "../routersHelpers/matchers.js";
import { createLogger } from "kt-logger";
import {
    aliasSymbol,
    createRequestError,
    extractRequestError,
    HandlerContext,
    RouterAlias,
    routerSymbol,
    throwRequestError,
    throwUnauthorizedError,
    type createHandler,
    type Handler,
    type Middleware,
    type Route,
} from "../router/index.js";
import {
    autoDescribe,
    getAllDescriptionsSecret,
    getRouterDirectory,
    getTypesPlacementDir,
    isDev,
} from "../loadConfig/index.js";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";
import cluster from "cluster";
import { renderMdDescriptionFile } from "../renderDescriptionFile/index.js";
import { processRoutesForTypes } from "../typesScanner/index.js";

const log = await createLogger({
    color: "blue",
    logLevel: "Info",
    name: "routerBuilder",
    worker: false,
});
type RouteRegistry = {
    [key: string]: Route<any, any, any, any, any>;
};

export let routesRegistryMap: RouteRegistry = {};

const aliases = [] as any;

const routesFilesMap: {
    [key: string]: string;
} = {};

export async function getMiddlewaresArray(routerDirectory: string): Promise<Handler<any, any, any, any, any>[]> {
    const content = fs.readdirSync(routerDirectory);
    const middlewares = (
        await Promise.all(
            content
                .filter((f) => {
                    const fileStats = fs.statSync(path.join(routerDirectory, f));
                    return fileStats.isFile() && !!f.match(middlewareSuffixRegx);
                })
                .map(async (f) => {
                    const fullPath = path.join(routerDirectory, f);
                    const middleware: Handler<any, any, any, any, any> = (await import(fullPath)).default;
                    if (typeof middleware != "function") {
                        console.error(
                            "Failed to load middleware on ",
                            fullPath,
                            "expected a Handler got",
                            typeof middlewares
                        );
                        process.exit(1);
                    }
                    return middleware;
                })
        )
    ).filter((e) => !!e);
    return middlewares;
}
const defaultRoutesDirectory = await getRouterDirectory();
export default async function buildRouter(
    providedMiddlewares: Middleware<any, any, any, any, any>[] = [],
    routerDirectory = defaultRoutesDirectory,
    root = true,
    fullPrefix = "/"
) {
    if (root) {
        routesRegistryMap = {};
    }
    const content = fs.readdirSync(routerDirectory);

    providedMiddlewares = [...providedMiddlewares, ...(await getMiddlewaresArray(routerDirectory))];

    for (const item of content) {
        const itemStat = fs.statSync(path.join(routerDirectory, item));

        if (itemStat.isDirectory()) {
            await buildRouter(
                providedMiddlewares,
                path.join(routerDirectory, item),
                false,
                path.join(fullPrefix, item)
            );
        } else {
            const routerMatch = item.match(routerSuffixRegx);
            if (routerMatch) {
                const routerName = item.slice(0, item.indexOf(routerMatch[0]));
                const routeFullPath = path.join(routerDirectory, item);
                const routerInstance: ReturnType<typeof createHandler> = (await import(routeFullPath)).default;

                if (routerName == "index") {
                    routesFilesMap[routeFullPath] = fullPrefix;
                } else {
                    routesFilesMap[routeFullPath] = path.join(fullPrefix, routerName);
                }

                if (!routerInstance) {
                    continue;
                }

                if (routerInstance?.__symbol != routerSymbol) {
                    console.error("Expecting Router Handler Got", routerInstance);
                    process.exit(1);
                }

                routerInstance.externalMiddlewares = [...providedMiddlewares];

                if (routerName == "index") {
                    routesRegistryMap[fullPrefix] = routerInstance;

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`
                    );
                    const routerDescriptionFile = content.find((el) => !!el.match(routerDescriptionRegx));
                    if (routerDescriptionFile) {
                        routesRegistryMap[path.join(fullPrefix, "/describe")] = {
                            __symbol: routerSymbol,
                            serveVia: ["Http"],
                            externalMiddlewares: [],
                            handler: async (context) => {
                                const fullPath = path.join(routerDirectory, routerDescriptionFile);
                                if (fullPath.endsWith(".md")) {
                                    const rendered = await renderMdDescriptionFile(path.join(fullPrefix), fullPath);
                                    return context.respond.html(rendered);
                                }
                                return context.respond.file(fullPath);
                            },
                            method: "GET",
                            middleWares: [],
                        };
                    }
                } else {
                    const routePath = path.join(fullPrefix, routerName);

                    routesRegistryMap[routePath] = routerInstance;

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    if (routerDescriptionFile) {
                        routesRegistryMap[path.join(fullPrefix, routerName, "/describe")] = {
                            __symbol: routerSymbol,
                            externalMiddlewares: [],
                            handler: async (context) => {
                                const fullPath = path.join(routerDirectory, routerDescriptionFile);
                                if (fullPath.endsWith(".md")) {
                                    return context.respond.html(
                                        await renderMdDescriptionFile(path.join(fullPrefix, routerName), fullPath)
                                    );
                                }

                                return context.respond.file(fullPath);
                            },
                            serveVia: ["Http"],
                            method: "GET",
                            middleWares: [],
                        };
                    }
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (directoryAliasMatch) {
                    const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                    const fullRoute = path.join(fullPrefix, routerName);
                    const fullAliasPath = path.join(routerDirectory, item);

                    const routerAlias: RouterAlias = (await import(fullAliasPath)).default;
                    if (routerAlias.__symbol != aliasSymbol) {
                        log.error("Expected router alias at", fullAliasPath, " but got", routerAlias);
                    }

                    const middlewares = [...providedMiddlewares];

                    // if (!routerAlias.path.startsWith("/")) {
                    //     routerAlias.path = "/" + routerAlias;
                    // }

                    aliases.push(async () => {
                        const matchingRoutes = Object.fromEntries(
                            Object.entries(routesRegistryMap)
                                .filter(([path, _]) => {
                                    return path.startsWith(routerAlias.path);
                                })
                                .map(([path, route]) => {
                                    route = { ...route };
                                    path = path.replace(routerAlias.path, fullRoute);
                                    if (routerAlias.includeOriginalMIddlewares) {
                                        route.externalMiddlewares = [...middlewares, ...route.externalMiddlewares];
                                    } else {
                                        route.externalMiddlewares = [...middlewares];
                                    }
                                    return [path, route];
                                })
                        );

                        for (const routePath in matchingRoutes) {
                            routesRegistryMap[routePath] = matchingRoutes[routePath];
                        }
                    });
                }
            }
        }
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
        await processRouterForChannels();
        await maybeProcessRoutesForTypes();
        routesRegistryMap[path.join(fullPrefix, "/__describe-json")] = {
            __symbol: routerSymbol,
            externalMiddlewares: [],
            handler: async (context) => {
                const fullPath = path.join(await getTypesPlacementDir(), "apiTypes.json");
                if (!fs.existsSync(fullPath)) {
                    throwRequestError(404, [
                        {
                            error: "API Types description not found",
                        },
                    ]);
                }
                return context.respond.file(fullPath);
            },
            method: "GET",
            middleWares: [
                async (context) => {
                    if (await isDev()) {
                        return;
                    }
                    const secret = await getAllDescriptionsSecret();
                    if (!secret) {
                        return;
                    }
                    const authorizationHeader = context.headers["authorization"] || context.headers["Authorization"];
                    if (authorizationHeader !== `Secret ${secret}`) {
                        throwUnauthorizedError("Unauthorized to access descriptions");
                    }
                },
            ],
            serveVia: ["Http"],
        };

        log("finished Building Router:", Object.keys(routesRegistryMap));
    }
}

export async function getChannelMiddlewaresArray(currentChannelsDirectory: string): Promise<
    {
        channelMiddleware?: ChannelHandlerBuilder<any, any>;
        channelMounted?: ChannelHandlerMounted;
        channelBeforeMounted?: ChannelHandlerBeforeMounted;
    }[]
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
                const importedResult = await import(fullPath);
                return importedResult;
            })
    );
    return middlewares;
}

async function buildChannelling(
    currentChannelsDirectory = defaultRoutesDirectory,
    root = true,
    fullPrefix = "/",
    providedBeforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[] = [],
    providedMiddlewares: {
        middleware: ChannelHandlerBuilder<any, any>[];
        path: string;
    }[] = [],
    providedMountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[] = []
) {
    if (root) {
        log("Building Channels", currentChannelsDirectory);
    }

    const content = fs.readdirSync(currentChannelsDirectory);

    const beforeMountedMiddlewares = [...(providedBeforeMountedMiddlewares || [])];
    const middlewares = [...(providedMiddlewares || [])];
    const mountedMiddlewares = [...(providedMountedMiddlewares || [])];

    const loadedMiddlewares = await getChannelMiddlewaresArray(currentChannelsDirectory);

    for (const middleware of loadedMiddlewares || []) {
        if (middleware.channelBeforeMounted) {
            const foundBeforeMountedMiddleware = beforeMountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundBeforeMountedMiddleware) {
                foundBeforeMountedMiddleware.middleware.push(middleware.channelBeforeMounted);
            } else {
                beforeMountedMiddlewares.push({
                    middleware: [middleware.channelBeforeMounted],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.channelMiddleware) {
            const foundMiddleware = middlewares.find((pm) => pm.path == fullPrefix);
            if (foundMiddleware) {
                foundMiddleware.middleware.push(middleware.channelMiddleware);
            } else {
                middlewares.push({
                    middleware: [middleware.channelMiddleware],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.channelMounted) {
            const foundMountedMiddleware = mountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundMountedMiddleware) {
                foundMountedMiddleware.middleware.push(middleware.channelMounted);
            } else {
                mountedMiddlewares.push({
                    middleware: [middleware.channelMounted],
                    path: fullPrefix,
                });
            }
        }
    }

    for (const item of content) {
        const itemFullPath = path.join(currentChannelsDirectory, item);
        const itemStat = fs.statSync(itemFullPath);

        if (itemStat.isDirectory()) {
            await buildChannelling(
                itemFullPath,
                false,
                path.join(fullPrefix, item),
                beforeMountedMiddlewares,
                middlewares,
                mountedMiddlewares
            );
        } else {
            const channelMatch = item.match(routerSuffixRegx);
            if (channelMatch) {
                const routerName = item.slice(0, item.indexOf(channelMatch[0]));
                if (routerName == "index") {
                    const handlerPath = itemFullPath;
                    const { handler, mounted, beforeMounted } = await import(handlerPath);
                    if (!handler) {
                        continue;
                    }

                    handlers.push({
                        path: fullPrefix,

                        beforeMounted,
                        handler,
                        mounted,

                        middlewares: [...middlewares],
                        mountedMiddlewares: [...mountedMiddlewares],
                        beforeMountedMiddlewares: [...beforeMountedMiddlewares],
                    });
                } else {
                    const handlerPath = itemFullPath;
                    const { handler, mounted, beforeMounted } = await import(handlerPath);

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
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (directoryAliasMatch) {
                    aliases.push(async () => {
                        const routerAlias: RouterAlias = (await import(itemFullPath)).default;
                        const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                        const aliases = handlers
                            .filter((h) => {
                                return h.path.startsWith(routerAlias.path);
                            })
                            .map((h) => {
                                const newHandler = { ...h };
                                newHandler.path = newHandler.path.replace(
                                    RegExp(`^${routerAlias.path.replaceAll("/", "\\/")}`),
                                    path.join(fullPrefix, routerName)
                                );
                                if (routerAlias.includeOriginalMIddlewares) {
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
        log("finished building channels", currentChannelsDirectory);
    }
}

const loadCompatibleRoutesIntoChannels = async () => {
    Object.entries(routesRegistryMap)
        .filter(([_path, route]) => {
            return route.serveVia.includes("Socket");
        })
        .map(([path, route]) => {
            handlers.push({
                beforeMountedMiddlewares: [],
                middlewares: [],
                mountedMiddlewares: [],
                path: path,
                beforeMounted: undefined,
                handler: (_socket) => {
                    return [
                        async (body: any, cb, _ev) => {
                            if (!cb) {
                                return;
                            }

                            let responded = false;
                            try {
                                let statusCode = 200;

                                const query = { ...body?.__query };
                                const params = { ...body?.__params };
                                const headers = { ...body?.__headers };

                                const context: HandlerContext<any, any, any, any> = {
                                    locale: {},
                                    method: route.method,
                                    fullPath: path,
                                    respond: {
                                        async file(fullPath) {
                                            const data = await readFile(fullPath);
                                            cb?.(data);
                                            responded = true;
                                            return {
                                                path: fullPath,
                                            };
                                        },
                                        html: (text) => {
                                            cb?.(text);
                                            responded = true;

                                            return text;
                                        },
                                        text: (text) => {
                                            cb?.(text);
                                            responded = true;

                                            return text;
                                        },
                                        json: (data: any) => {
                                            if (typeof data == "object") {
                                                data.__status = statusCode;
                                            }
                                            cb?.(data);
                                            responded = true;
                                            return data;
                                        },
                                    },
                                    body: { ...body },
                                    headers,
                                    params,
                                    query,
                                    setStatus(_statusCode) {
                                        statusCode = _statusCode;
                                        return context;
                                    },
                                };

                                for (const middleware of [...route.externalMiddlewares, ...route.middleWares]) {
                                    await middleware(context, body, query, params, headers);
                                }

                                await route.handler(context, body, query, params, headers);
                                if (!responded) {
                                    console.warn("You Did not respond properly to the request on", route.method, path);
                                    cb?.({
                                        __status: 200,
                                        msg: "OK",
                                    });
                                }
                            } catch (error) {
                                if (responded) {
                                    return;
                                }
                                const requestError = extractRequestError(error);
                                if (requestError) {
                                    cb(requestError);
                                    return;
                                }
                                cb(
                                    createRequestError(500, [
                                        {
                                            error: "Unknown server error",
                                            data: error,
                                        },
                                    ])
                                );
                            }
                        },
                    ];
                },
                mounted: undefined,
            });
        });
};

async function processRouterForChannels() {
    await loadCompatibleRoutesIntoChannels();
    await buildChannelling();
}

const maybeProcessRoutesForTypes = async () => {
    if (!(await autoDescribe()) || !cluster.isPrimary || !(await isDev())) {
        return;
    }
    await processRoutesForTypes(routesFilesMap);
};
