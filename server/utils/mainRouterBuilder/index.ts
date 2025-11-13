import {
    ChannelHandlerBeforeMounted,
    ChannelHandlerBuilder,
    ChannelHandlerMounted,
    handlers,
    rebuildHandlerPathMap,
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

const aliases = [] as (()=>Promise<void>)[];

const routesFilesMap: {
    [key: string]: string;
} = {};

// Pre-compile regex patterns for performance
const paramReplaceRegex = /\[(\w+)\]/g;

// Pre-compile regex for socket route filtering
const socketRoutes = new Set<string>();

// Cache for file stats to avoid repeated syscalls
const statCache = new Map<string, fs.Stats>();

// Optimized file stat with caching
async function getFileStat(filePath: string): Promise<fs.Stats> {
    const cached = statCache.get(filePath);
    if (cached) return cached;
    const stats = await fs.promises.stat(filePath);
    statCache.set(filePath, stats);
    return stats;
}

// Batch file stats for parallel execution
async function getFileStats(filePaths: string[]): Promise<Map<string, fs.Stats>> {
    const statsMap = new Map<string, fs.Stats>();
    await Promise.all(
        filePaths.map(async (filePath) => {
            const stats = await getFileStat(filePath);
            statsMap.set(filePath, stats);
        })
    );
    return statsMap;
}

export async function getMiddlewaresArray(routerDirectory: string): Promise<Handler<any, any, any, any, any>[]> {
    const content = fs.readdirSync(routerDirectory);
    const filePaths = content.map((f) => path.join(routerDirectory, f));
    const statsMap = await getFileStats(filePaths);

    const middlewareFiles = content.filter((f, i) => {
        const filePath = filePaths[i];
        const stats = statsMap.get(filePath);
        return stats?.isFile() && middlewareSuffixRegx.test(f);
    });

    const middlewares = await Promise.all(
        middlewareFiles.map(async (f) => {
            const fullPath = path.join(routerDirectory, f);
            try {
                const middleware: Handler<any, any, any, any, any> = (await import(fullPath)).default;
                if (typeof middleware !== "function") {
                    return null;
                }
                return middleware;
            } catch (error) {
                console.error("Failed to import middleware at", fullPath, error);
                return null;
            }
        })
    );

    return middlewares.filter((m): m is Handler<any, any, any, any, any> => m !== null && m !== undefined);
}

const defaultRoutesDirectory = await getRouterDirectory();

// Optimized path normalization
function normalizeRoutePath(routePath: string): string {
    return routePath.replace(paramReplaceRegex, ":$1");
}

const getDescriptionMiddleware: (devMode: boolean, secret?: string | null) => Middleware<any, any, any, any, any>[] = (
    devMode,
    secret
) => [
    async (context) => {
        if (devMode) {
            return;
        }
        if (!secret) {
            return;
        }
        const authorizationHeader = context.headers["authorization"] || context.headers["Authorization"] || context.query["mes"];
        if (authorizationHeader !== `Secret ${secret}`) {
            throwUnauthorizedError("Unauthorized to access descriptions");
        }
    },
];

export default async function buildRouter(
    providedMiddlewares: Middleware<any, any, any, any, any>[] = [],
    routerDirectory = defaultRoutesDirectory,
    root = true,
    fullPrefix = "/"
) {
    if (root) {
        routesRegistryMap = {};
        statCache.clear(); // Clear cache on root build
    }

    const content = fs.readdirSync(routerDirectory);
    const directoryPath = routerDirectory;

    // Load middlewares
    const directoryMiddlewares = await getMiddlewaresArray(routerDirectory);

    const allMiddlewares =
        providedMiddlewares.length > 0 || directoryMiddlewares.length > 0
            ? [...providedMiddlewares, ...directoryMiddlewares]
            : providedMiddlewares;

    // Batch file stats for all items
    const itemPaths = content.map((item) => path.join(directoryPath, item));
    const itemStatsMap = await getFileStats(itemPaths);

    // Separate directories and files for parallel processing
    const directories: string[] = [];
    const routerFiles: Array<{ name: string; path: string; match: RegExpMatchArray }> = [];
    const aliasFiles: Array<{ name: string; path: string; match: RegExpMatchArray }> = [];
    const descriptionFiles: Map<string, string> = new Map();

    // First pass: categorize files
    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        const itemPath = itemPaths[i];
        const itemStat = itemStatsMap.get(itemPath);

        if (!itemStat) continue;

        if (itemStat.isDirectory()) {
            directories.push(item);
        } else {
            const routerMatch = item.match(routerSuffixRegx);
            if (routerMatch) {
                routerFiles.push({ name: item, path: itemPath, match: routerMatch });
            } else {
                const aliasMatch = item.match(directoryAliasSuffixRegx);
                if (aliasMatch) {
                    aliasFiles.push({ name: item, path: itemPath, match: aliasMatch });
                } else {
                    // Check if it's a description file
                    const descMatch = item.match(descriptionSuffixRegx);
                    if (descMatch) {
                        const routerName = item.slice(0, item.indexOf(descMatch[0]));
                        descriptionFiles.set(routerName, item);
                    }
                }
            }
        }
    }

    // Process router files in parallel
    const routerPromises = routerFiles.map(async ({ name, path: routeFullPath, match }) => {
        const routerName = name.slice(0, name.indexOf(match[0]));
        const routerInstance: ReturnType<typeof createHandler> = (await import(routeFullPath)).default;

        if (!routerInstance) {
            return null;
        }

        if (routerInstance?.__symbol !== routerSymbol) {
            console.error("Expecting Router Handler Got", routerInstance);
            process.exit(1);
        }

        let routePath: string;
        if (routerName === "index") {
            routePath = fullPrefix;
        } else {
            routePath = path.join(fullPrefix, routerName);
        }
        routePath = normalizeRoutePath(routePath);
        routesFilesMap[routeFullPath] = routePath;

        // Assign middlewares directly (avoid spread if possible)
        routerInstance.externalMiddlewares = allMiddlewares.length > 0 ? allMiddlewares.slice() : [];

        const descriptionFile = descriptionFiles.get(routerName);
        const descriptionRoutePath = path.join(routePath, "/describe");

        return {
            routePath,
            routerInstance,
            routerName,
            descriptionFile,
            descriptionRoutePath,
        };
    });

    const routerResults = await Promise.all(routerPromises);

    // Process router results
    for (const result of routerResults) {
        if (!result) continue;

        const { routePath, routerInstance, routerName, descriptionFile, descriptionRoutePath } = result;
        routesRegistryMap[routePath] = routerInstance;

        if (descriptionFile) {
            const descriptionFullPath = path.join(directoryPath, descriptionFile);
            const isMarkdown = descriptionFullPath.endsWith(".md");
            const renderPath = routerName === "index" ? fullPrefix : path.join(fullPrefix, routerName);

            const [devMode, secret] = await Promise.all([isDev(), getAllDescriptionsSecret()]);

            routesRegistryMap[descriptionRoutePath] = {
                __symbol: routerSymbol,
                serveVia: ["Http"],
                externalMiddlewares: [],
                handler: async (context) => {
                    if (isMarkdown) {
                        const rendered = await renderMdDescriptionFile(renderPath, descriptionFullPath);
                        return context.respond.html(rendered);
                    }
                    return context.respond.file(descriptionFullPath);
                },
                middleWares: getDescriptionMiddleware(devMode, secret),
                method: "GET",
            };
        }
    }

    // Process alias files
    for (const { name, path: fullAliasPath, match } of aliasFiles) {
        const routerName = name.slice(0, name.indexOf(match[0]));
        const fullRoute = path.join(fullPrefix, routerName);

        const routerAlias: RouterAlias | undefined | null = (await import(fullAliasPath)).default;
        if (routerAlias?.__symbol !== aliasSymbol) {
            log.error("Expected router alias at", fullAliasPath, " but got", routerAlias);
            process.exit(1);
        }

        const middlewares = allMiddlewares.slice(); // Clone only when needed

        aliases.push(async () => {
            const matchingRoutes: RouteRegistry = {};
            const aliasPath = routerAlias.path;

            // Optimized filtering and mapping
            for (const [routePath, route] of Object.entries(routesRegistryMap)) {
                if (routePath.startsWith(aliasPath)) {
                    const newRoute = { ...route };
                    const newPath = routePath.replace(aliasPath, fullRoute);

                    if (routerAlias.includeOriginalMIddlewares) {
                        newRoute.externalMiddlewares = [...middlewares, ...route.externalMiddlewares];
                    } else {
                        newRoute.externalMiddlewares = middlewares.slice();
                    }

                    matchingRoutes[newPath] = newRoute;
                }
            }

            Object.assign(routesRegistryMap, matchingRoutes);
        });
    }

    // Process directories in parallel
    if (directories.length > 0) {
        await Promise.all(
            directories.map((item) =>
                buildRouter(allMiddlewares, path.join(routerDirectory, item), false, path.join(fullPrefix, item))
            )
        );
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
        await processRouterForChannels();
        await maybeProcessRoutesForTypes();

        const typesPlacementDir = await getTypesPlacementDir();
        const typesPath = path.join(typesPlacementDir, "apiTypes.json");
        const [devMode, secret] = await Promise.all([isDev(), getAllDescriptionsSecret()]);

        routesRegistryMap[path.join(fullPrefix, "/__describe-json")] = {
            __symbol: routerSymbol,
            externalMiddlewares: [],
            handler: async (context) => {
                if (!fs.existsSync(typesPath)) {
                    throwRequestError(404, [
                        {
                            error: "API Types description not found",
                        },
                    ]);
                }
                return context.respond.file(typesPath);
            },
            method: "GET",
            middleWares: getDescriptionMiddleware(devMode, secret),
            serveVia: ["Http"],
        };

        routesRegistryMap[path.join(fullPrefix, "/__routes-list")] = {
            __symbol: routerSymbol,
            externalMiddlewares: [],
            handler: async (context) => {
                return context.respond.json({
                    routesList: Object.entries(routesRegistryMap).map(([path, route]) => {
                        return {
                            path: path,
                            method: route.method,
                            servedVia: route.serveVia,
                        };
                    }),
                });
            },
            method: "GET",
            middleWares: getDescriptionMiddleware(devMode, secret),
            serveVia: ["Http"],
        };

        routesRegistryMap[path.join(fullPrefix, "/__channels-list")] = {
            __symbol: routerSymbol,
            externalMiddlewares: [],
            handler: async (context) => {
                return context.respond.json({
                    routesList: handlers.map(c=>c.path)
                });
            },
            method: "GET",
            middleWares: getDescriptionMiddleware(devMode, secret),
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
    const filePaths = content.map((f) => path.join(currentChannelsDirectory, f));
    const statsMap = await getFileStats(filePaths);

    const middlewareFiles = content.filter((f, i) => {
        const filePath = filePaths[i];
        const stats = statsMap.get(filePath);
        return stats?.isFile() && middlewareSuffixRegx.test(f);
    });

    const middlewares = await Promise.all(
        middlewareFiles.map(async (f) => {
            const fullPath = path.join(currentChannelsDirectory, f);
            try {
                return await import(fullPath);
            } catch (error) {
                console.error("Failed to import channel middleware at", fullPath, error);
                return null;
            }
        })
    );

    return middlewares.filter((m): m is NonNullable<(typeof middlewares)[0]> => m !== null);
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
    const directoryPath = currentChannelsDirectory;

    // Use Maps for O(1) lookups
    const beforeMountedMap = new Map<string, ChannelHandlerBeforeMounted[]>();
    const middlewaresMap = new Map<string, ChannelHandlerBuilder<any, any>[]>();
    const mountedMap = new Map<string, ChannelHandlerMounted[]>();

    // Initialize maps from provided middlewares
    for (const pm of providedBeforeMountedMiddlewares || []) {
        beforeMountedMap.set(pm.path, [...pm.middleware]);
    }
    for (const pm of providedMiddlewares || []) {
        middlewaresMap.set(pm.path, [...pm.middleware]);
    }
    for (const pm of providedMountedMiddlewares || []) {
        mountedMap.set(pm.path, [...pm.middleware]);
    }

    const loadedMiddlewares = await getChannelMiddlewaresArray(currentChannelsDirectory);

    // Process middlewares
    for (const middleware of loadedMiddlewares) {
        if (middleware.channelBeforeMounted) {
            const existing = beforeMountedMap.get(fullPrefix);
            if (existing) {
                existing.push(middleware.channelBeforeMounted);
            } else {
                beforeMountedMap.set(fullPrefix, [middleware.channelBeforeMounted]);
            }
        }

        if (middleware.channelMiddleware) {
            const existing = middlewaresMap.get(fullPrefix);
            if (existing) {
                existing.push(middleware.channelMiddleware);
            } else {
                middlewaresMap.set(fullPrefix, [middleware.channelMiddleware]);
            }
        }

        if (middleware.channelMounted) {
            const existing = mountedMap.get(fullPrefix);
            if (existing) {
                existing.push(middleware.channelMounted);
            } else {
                mountedMap.set(fullPrefix, [middleware.channelMounted]);
            }
        }
    }

    // Convert maps back to arrays for recursion
    const beforeMountedMiddlewares = Array.from(beforeMountedMap.entries()).map(([path, middleware]) => ({
        path,
        middleware,
    }));
    const middlewares = Array.from(middlewaresMap.entries()).map(([path, middleware]) => ({
        path,
        middleware,
    }));
    const mountedMiddlewares = Array.from(mountedMap.entries()).map(([path, middleware]) => ({
        path,
        middleware,
    }));

    // Batch file stats
    const itemPaths = content.map((item) => path.join(directoryPath, item));
    const itemStatsMap = await getFileStats(itemPaths);

    // Separate directories and files
    const directories: string[] = [];
    const channelFiles: Array<{ name: string; path: string; match: RegExpMatchArray }> = [];
    const aliasFiles: Array<{ name: string; path: string; match: RegExpMatchArray }> = [];

    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        const itemPath = itemPaths[i];
        const itemStat = itemStatsMap.get(itemPath);

        if (!itemStat) continue;

        if (itemStat.isDirectory()) {
            directories.push(item);
        } else {
            const channelMatch = item.match(routerSuffixRegx);
            if (channelMatch) {
                channelFiles.push({ name: item, path: itemPath, match: channelMatch });
            } else {
                const aliasMatch = item.match(directoryAliasSuffixRegx);
                if (aliasMatch) {
                    aliasFiles.push({ name: item, path: itemPath, match: aliasMatch });
                }
            }
        }
    }

    // Get middleware arrays for current path (use map for O(1) lookup)
    const currentBeforeMounted = beforeMountedMap.get(fullPrefix) || [];
    const currentMiddlewares = middlewaresMap.get(fullPrefix) || [];
    const currentMounted = mountedMap.get(fullPrefix) || [];

    // Convert to expected format
    const beforeMountedMiddlewaresArray =
        currentBeforeMounted.length > 0 ? [{ middleware: currentBeforeMounted, path: fullPrefix }] : [];
    const middlewaresArray =
        currentMiddlewares.length > 0 ? [{ middleware: currentMiddlewares, path: fullPrefix }] : [];
    const mountedMiddlewaresArray = currentMounted.length > 0 ? [{ middleware: currentMounted, path: fullPrefix }] : [];

    // Process channel files in parallel
    const channelPromises = channelFiles.map(async ({ name, path: handlerPath, match }) => {
        const routerName = name.slice(0, name.indexOf(match[0]));

        let routePath: string;
        if (routerName === "index") {
            routePath = fullPrefix;
        } else {
            routePath = path.join(fullPrefix, routerName);
        }
        routePath = normalizeRoutePath(routePath);

        const { handler, mounted, beforeMounted } = await import(handlerPath);
        if (!handler) {
            return null;
        }

        return {
            path: routePath,
            beforeMounted,
            handler,
            mounted,
            middlewares: middlewaresArray.slice(),
            mountedMiddlewares: mountedMiddlewaresArray.slice(),
            beforeMountedMiddlewares: beforeMountedMiddlewaresArray.slice(),
        };
    });

    const channelResults = await Promise.all(channelPromises);
    for (const result of channelResults) {
        if (result) {
            handlers.unshift(result);
        }
    }

    // Process alias files
    for (const { name, path: itemFullPath, match } of aliasFiles) {
        aliases.push(async () => {
            const routerAlias: RouterAlias = (await import(itemFullPath)).default;
            if (routerAlias?.__symbol !== aliasSymbol) {
                log.error("Expected router alias at", itemFullPath, " but got", routerAlias);
                process.exit(1);
            }

            const routerName = name.slice(0, name.indexOf(match[0]));
            const aliasPathPattern = new RegExp(`^${routerAlias.path.replaceAll("/", "\\/")}`);
            const newPathPrefix = path.join(fullPrefix, routerName);

            // Convert to expected format
            const aliasBeforeMountedArray =
                currentBeforeMounted.length > 0 ? [{ middleware: currentBeforeMounted, path: fullPrefix }] : [];
            const aliasMiddlewaresArray =
                currentMiddlewares.length > 0 ? [{ middleware: currentMiddlewares, path: fullPrefix }] : [];
            const aliasMountedArray =
                currentMounted.length > 0 ? [{ middleware: currentMounted, path: fullPrefix }] : [];

            const aliasedHandlers = handlers
                .filter((h) => h.path.startsWith(routerAlias.path))
                .map((h) => {
                    const newHandler = { ...h };
                    newHandler.path = newHandler.path.replace(aliasPathPattern, newPathPrefix);

                    if (routerAlias.includeOriginalMIddlewares) {
                        newHandler.beforeMountedMiddlewares = [
                            ...aliasBeforeMountedArray,
                            ...(newHandler.beforeMountedMiddlewares || []),
                        ];
                        newHandler.middlewares = [...aliasMiddlewaresArray, ...(newHandler.middlewares || [])];
                        newHandler.mountedMiddlewares = [
                            ...aliasMountedArray,
                            ...(newHandler.mountedMiddlewares || []),
                        ];
                    } else {
                        newHandler.beforeMountedMiddlewares = aliasBeforeMountedArray.slice();
                        newHandler.middlewares = aliasMiddlewaresArray.slice();
                        newHandler.mountedMiddlewares = aliasMountedArray.slice();
                    }
                    return newHandler;
                });
            handlers.push(...aliasedHandlers);
        });
    }

    // Process directories in parallel
    if (directories.length > 0) {
        await Promise.all(
            directories.map((item) =>
                buildChannelling(
                    path.join(currentChannelsDirectory, item),
                    false,
                    path.join(fullPrefix, item),
                    beforeMountedMiddlewares,
                    middlewares,
                    mountedMiddlewares
                )
            )
        );
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
        log("finished building channels", currentChannelsDirectory);
    }
}

const loadCompatibleRoutesIntoChannels = async () => {
    // Pre-filter socket routes
    socketRoutes.clear();
    for (const [path, route] of Object.entries(routesRegistryMap)) {
        if (route.serveVia.includes("Socket")) {
            socketRoutes.add(path);
        }
    }

    // Process all socket routes
    for (const routePath of socketRoutes) {
        const route = routesRegistryMap[routePath];
        handlers.push({
            beforeMountedMiddlewares: [],
            middlewares: [],
            mountedMiddlewares: [],
            path: `---%http%---${routePath}`,
            beforeMounted: undefined,
            handler: (_socket) => {
                return [
                    async (body: any, cb, _ev, params) => {
                        if (!cb) {
                            return;
                        }

                        let responded = false;
                        try {
                            let statusCode = 200;

                            const query = body?.__query ? { ...body.__query } : {};
                            const headers = body?.__headers ? { ...body.__headers } : {};

                            const context: HandlerContext<any, any, any, any> = {
                                locale: {},
                                method: route.method,
                                fullPath: routePath,
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
                                        if (typeof data === "object" && data !== null) {
                                            data.__status = statusCode;
                                        }
                                        cb?.(data);
                                        responded = true;
                                        return data;
                                    },
                                },
                                body: body ? { ...body } : {},
                                headers,
                                params,
                                query,
                                setStatus(_statusCode) {
                                    statusCode = _statusCode;
                                    return context;
                                },
                            };

                            // Combine middlewares once
                            const allMiddlewares =
                                route.externalMiddlewares.length > 0 || route.middleWares.length > 0
                                    ? [...route.externalMiddlewares, ...route.middleWares]
                                    : route.externalMiddlewares;

                            for (const middleware of allMiddlewares) {
                                await middleware(context, body, query, params, headers);
                            }

                            await route.handler(context, body, query, params, headers);
                            if (!responded) {
                                console.warn("You Did not respond properly to the request on", route.method, routePath);
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
    }
};

async function processRouterForChannels() {
    await loadCompatibleRoutesIntoChannels();
    await buildChannelling();
    // Rebuild handler path map after all handlers are registered for O(1) lookups
    rebuildHandlerPathMap();
}

const maybeProcessRoutesForTypes = async () => {
    if (!(await autoDescribe()) || !cluster.isPrimary || !(await isDev())) {
        return;
    }
    await processRoutesForTypes(routesFilesMap);
};
