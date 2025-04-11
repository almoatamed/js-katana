/**
 * - the main router builder reads the current directory content
 * - for each item
 *   - if the item is directory then recursively call the build function
 *   - else then check if the file suffix is .router.js
 *   - if so then this is router, its default export is router
 *   - you need to use this router with the prefix is the relative folder
 *     name
 *   - the function returns a router
 */

import { HandlerFunction, R } from "$/server/utils/express/index.js";
import zlib from "zlib";
import { routerConfig } from "../../config/routing/index.js";
import {
    ChannelDirectoryAliasDefaultExport,
    ChannelHandlerBeforeMounted,
    ChannelHandlerBuilder,
    ChannelHandlerMounted,
} from "../channelsBuilder/index.js";
import { ChannelDescriptionProps, channelsDescriptionsMap } from "../channelsHelpers/describe/listener/index.js";
import { resolveTs } from "../common/index.js";
import { DescriptionProps, descriptionsMap } from "../routersHelpers/describe/index.js";
import {
    descriptionSuffixRegx,
    directoryAliasSuffixRegx,
    middlewareSuffixRegx,
    routerSuffixRegx,
} from "../routersHelpers/matchers.js";
const rootPaths = (await import("../dynamicConfiguration/rootPaths.js")).default;
const express = (await import("$/server/utils/express/index.js")).default;
const path = (await import("path")).default;
const url = (await import("url")).default;
const fs = (await import("fs")).default;
const logUtil = await import("$/server/utils/log/index.js");
const log = await logUtil.localLogDecorator("routerBuilder", "blue", true, "Info", false);

const directoryRoutersAlieses = {};
const aliases = [] as any;

export async function getMiddlewaresArray(routerDirectory: string): Promise<HandlerFunction[]> {
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
                    return (await import(fullPath)).default;
                }),
        )
    ).filter((e) => !!e);
    return middlewares;
}

export default async function buildRouter(
    Prefix = "/",
    providedMiddlewares: HandlerFunction[] = [],
    routerDirectory = path.join(rootPaths.srcPath, routerConfig.getRouterDirectory()),
    root = true,
    fullPrefix = "/",
) {
    const router = express.Router();
    if (root) {
        router.middlewares = [...providedMiddlewares];
    }
    directoryRoutersAlieses[fullPrefix] = router;
    const content = fs.readdirSync(routerDirectory);
    router.directoryFullPath = routerDirectory;
    for (const item of content) {
        const itemStat = fs.statSync(path.join(routerDirectory, item));
        if (itemStat.isDirectory()) {
            const subRouter = await buildRouter(
                item,
                [],
                path.join(routerDirectory, item),
                false,
                path.join(fullPrefix, item),
            );
            const middlewares = (await getMiddlewaresArray(path.join(routerDirectory, item))).filter((e) => !!e);

            if (middlewares?.length) {
                router.use(`/${item}`, middlewares, subRouter);
            } else {
                router.use(`/${item}`, subRouter);
            }
        } else {
            const routerMatch = item.match(routerSuffixRegx);
            if (!!routerMatch) {
                console.log("Route", routerDirectory);
                const routerName = item.slice(0, item.indexOf(routerMatch[0]));
                const routeFullPath = path.join(routerDirectory, item);
                router.routeFullPath = routeFullPath;
                if (routerName == "index") {
                    const routerInstance = (await import(routeFullPath)).default;
                    if (routerInstance) {
                        console.log("route", path.join(Prefix));
                        router.use(`/`, routerInstance);
                    }

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`,
                    );
                    const routerDescriptionFile = content.find((el) => !!el.match(routerDescriptionRegx));
                    routerDescriptionFile &&
                        router.get(`/describe`, async (request, response, next) => {
                            try {
                                response.sendFile(path.join(routerDirectory, routerDescriptionFile), (error) => {
                                    !!error && next(error);
                                });
                            } catch (error: any) {
                                next(error);
                            }
                        });
                } else {
                    const subRouter = (await import(path.join(routerDirectory, item))).default;
                    if (subRouter) {
                        console.log("route", path.join(Prefix, routerName));
                        router.use(`/${routerName}`, subRouter);
                    }
                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`,
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    routerDescriptionFile &&
                        router.get(`/${routerName}/describe`, async (request, response, next) => {
                            try {
                                response.sendFile(path.join(routerDirectory, routerDescriptionFile), (error) => {
                                    !!error && next(error);
                                });
                            } catch (error: any) {
                                next(error);
                            }
                        });
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (!!directoryAliasMatch) {
                    aliases.push(async () => {
                        let routerAlias = (await import(path.join(routerDirectory, item))).default;
                        if (!routerAlias.startsWith("/")) {
                            routerAlias = "/" + routerAlias;
                        }
                        const dirRouter = directoryRoutersAlieses[routerAlias];
                        if (!dirRouter) {
                            log("Directory alias not found", routerAlias);
                            process.exit(1);
                        } else {
                            const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                            router.use(`/${routerName}`, dirRouter);

                            const fullRoute = path.join(fullPrefix, routerName);
                            const additionalRoutes: [string, DescriptionProps][] = Object.entries(descriptionsMap)
                                .filter(([entryPath, route]) => {
                                    return entryPath.startsWith(routerAlias);
                                })
                                .map(([entryPath, route]) => {
                                    entryPath = entryPath.replace(routerAlias, fullRoute);
                                    route = { ...route };
                                    route.fullRoutePath = entryPath;
                                    return [entryPath, route];
                                });

                            for (const entry of additionalRoutes) {
                                descriptionsMap[entry[0]] = entry[1];
                            }
                        }
                    });
                }
            }
        }
    }

    if (root) {
        await Promise.all(aliases.map((f) => f(router)));
        await processRouterForChannels(router);
    }

    root && log("finished", routerDirectory);
    return router;
}

export async function getChannelMiddlewaresArray(currentChannelsDirectory: string): Promise<
    {
        channelMiddleware?: ChannelHandlerBuilder;
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
                return await import(resolveTs(fullPath));
            }),
    );
    return middlewares;
}
const channelsAliases: (() => void | Promise<void>)[] = [];

const processChannelsAliases = async (
    fullPrefix: string,
    directoryFullPath: string,
    beforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[] = [],
    middlewares: {
        middleware: ChannelHandlerBuilder[];
        path: string;
    }[] = [],
    mountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[] = [],
) => {
    const directoryContent = fs.readdirSync(directoryFullPath);
    for (const item of directoryContent) {
        const itemFullPath = path.join(directoryFullPath, item);
        const itemStat = fs.statSync(itemFullPath);
        const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
        if (itemStat.isFile() && !!directoryAliasMatch) {
            channelsAliases.push(async () => {
                const importedRouterAlias: string | ChannelDirectoryAliasDefaultExport = (await import(itemFullPath))
                    .default;
                const routerAlias: ChannelDirectoryAliasDefaultExport =
                    typeof importedRouterAlias == "object"
                        ? importedRouterAlias
                        : {
                              includeTargetMiddlewares: false,
                              targetDirectory: importedRouterAlias,
                          };
                const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                const aliases = channelsHandlers
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
                channelsHandlers.push(...aliases);

                const fullRoute = path.join(fullPrefix, routerName);
                const additionalChannels: [string, ChannelDescriptionProps][] = Object.entries(channelsDescriptionsMap)
                    .filter(([entryPath, channel]) => {
                        return entryPath.startsWith(routerAlias.targetDirectory);
                    })
                    .map(([entryPath, channelDescriptions]) => {
                        entryPath = entryPath.replace(routerAlias.targetDirectory, fullRoute);
                        channelDescriptions = { ...channelDescriptions };
                        channelDescriptions.fullChannelPath = entryPath;
                        return [entryPath, channelDescriptions];
                    });

                for (const entry of additionalChannels) {
                    channelsDescriptionsMap[entry[0]] = entry[1];
                }
            });
        }
    }
};

const { handlers: channelsHandlers } = await import("$/server/utils/channelsBuilder/index.js");
async function processRouterForChannels(
    router: R,
    root = true,
    fullPrefix = "/",

    providedMiddlewaresHandlers: HandlerFunction[] = [],

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
    if (root) {
        channelsAliases.splice(0);
    }
    const middlewaresHandlers = [...providedMiddlewaresHandlers, ...router.middlewares];

    const beforeMountedMiddlewares = [...providedBeforeMountedMiddlewares];
    const middlewares = [...providedMiddlewares];
    const mountedMiddlewares = [...providedMountedMiddlewares];
    if (router.directoryFullPath) {
        const loadedMiddlewares = await getChannelMiddlewaresArray(router.directoryFullPath);
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

        await processChannelsAliases(
            fullPrefix,
            router.directoryFullPath,
            beforeMountedMiddlewares,
            middlewares,
            mountedMiddlewares,
        );
    }

    let channelMounted: ChannelHandlerMounted | undefined = undefined;
    let channelBeforeMounted: ChannelHandlerBeforeMounted | undefined = undefined;
    let channelHandler: ChannelHandlerBuilder | undefined = undefined;
    if (router.routeFullPath) {
        const routeFileContent: {
            channelHandler?: ChannelHandlerBuilder;
            channelMounted?: ChannelHandlerMounted;
            channelBeforeMounted?: ChannelHandlerBeforeMounted;
        } = (await import(router.routeFullPath)) || {};
        channelMounted = routeFileContent?.channelMounted;
        channelBeforeMounted = routeFileContent?.channelBeforeMounted;
        channelHandler = routeFileContent?.channelHandler;
        if (channelHandler) {
            console.log("channel handler in router system", fullPrefix, router.routeFullPath);
        }
    }

    if (channelHandler) {
        channelsHandlers.push({
            beforeMountedMiddlewares,
            middlewares,
            mountedMiddlewares,
            path: fullPrefix,
            beforeMounted: channelBeforeMounted,
            handler: channelHandler,
            mounted: channelMounted,
        });
    }

    for (const event of Object.values(router.events)) {
        if (event) {
            channelsHandlers.push({
                beforeMountedMiddlewares: [],
                middlewares: [],
                mountedMiddlewares: [],
                path: path.join(fullPrefix, event.path),
                handler: (socket) => {
                    return [
                        async (body, cb, eventName) => {
                            let statusCode = 200;
                            console.log("event", eventName);
                            let cbCalled = false;

                            const response = {
                                status(providedStatusCode: number) {
                                    statusCode = providedStatusCode;
                                    return response;
                                },
                                json(responseBody: any = {}) {
                                    if (responseBody) {
                                        responseBody.statusCode = statusCode;
                                        responseBody.status = statusCode;
                                    }

                                    const compressedResponseBody = zlib.deflateSync(JSON.stringify(responseBody), {
                                        level: 9,
                                    });
                                    cb?.(compressedResponseBody);
                                    cbCalled = true;
                                    return response;
                                },
                                end: () => response,
                            };
                            const request = {
                                body: body,
                                user: socket.data.user,
                                params: body?.provided_Params || body,
                                headers: body?.provided_Headers || body,
                                query: body?.provided_Query || body,
                            };
                            const eventHandlers = [...middlewaresHandlers, ...event.handlers];
                            for (let i = 0; i < eventHandlers.length; i++) {
                                const handler = eventHandlers[i];
                                const next = (error: any) => {
                                    if (error) {
                                        error.httpError = true;
                                        throw error;
                                    }
                                };
                                await handler(request as any, response as any, next);
                            }
                            if (!cbCalled) {
                                response.json?.({
                                    msg: "ok",
                                });
                            }
                        },
                    ];
                },
            });
        }
    }

    for (const subRouter of Object.values(router.children)) {
        await processRouterForChannels(
            subRouter.router,
            false,
            path.join(fullPrefix, subRouter.path || "/"),
            middlewaresHandlers,
            beforeMountedMiddlewares,
            middlewares,
            mountedMiddlewares,
        );
    }

    if (root) {
        await Promise.all(channelsAliases.map((f) => f()));
    }
}
