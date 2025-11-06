import type { Router } from "express";

export function removeExpressRoute(
    router: Router,
    targetRoutesPaths: string[],
    targetRoutesHandlersContain: string[],
    path = "",
    routes: {
        methods: string[];
        path: string;
        handlersName: string[];
    }[] = []
) {
    if (!router) {
        throw {
            error: {
                msg: "App Server is not set on the endpoints list builder",
                name: "server error",
            },
        };
    }

    if (router.stack) {
        for (const layer of router.stack) {
            if (layer.route) {
                const Path = `${path}${layer.route.path}`;
                const HandlersNames = layer.route.stack.map((handler) => handler?.name);
                let removed = false;
                if (targetRoutesPaths?.length && targetRoutesPaths.includes(Path)) {
                    console.log("Removing", Path, HandlersNames);
                    removed = true;
                    router.stack = router.stack.filter((Layer) => {
                        const handlersNames = Layer?.route?.stack.map((handler) => handler?.name);
                        return !(
                            !!Layer?.route?.path &&
                            Layer?.route?.path === layer.route?.path &&
                            handlersNames?.length === HandlersNames?.length &&
                            handlersNames.every((name) => HandlersNames.includes(name))
                        );
                    });
                }

                if (targetRoutesHandlersContain?.length) {
                    if (
                        targetRoutesHandlersContain.some((targetName) =>
                            HandlersNames.filter((name) => name != "<anonymous>").includes(targetName)
                        )
                    ) {
                        removed = true;
                        router.stack = router.stack.filter((Layer) => {
                            const handlersNames = Layer?.route?.stack.map((handler) => handler?.name);
                            return !(
                                handlersNames?.length === HandlersNames?.length &&
                                handlersNames.every((name) => HandlersNames.includes(name)) &&
                                !!Layer?.route?.path &&
                                Layer?.route?.path === layer.route?.path
                            );
                        });
                    }
                }

                if (!removed) {
                    const route = {
                        methods: (layer.route as any).methods as string[],
                        path: `${path}${layer.route.path}`.replace("\\", ""),
                        handlersName: layer.route.stack.map((handler) => handler?.name),
                    };
                    routes.push(route);
                }
            }

            if ((layer?.handle as any)?.stack) {
                console.log(layer.regexp);
                const subPath = String(layer.regexp)
                    .match(/(\^\\?)(.*?)(\\\/\?)/)?.[2]
                    ?.replace("\\", "");

                removeExpressRoute(
                    layer.handle as any,
                    targetRoutesPaths,
                    targetRoutesHandlersContain,
                    path + subPath,
                    routes
                );
            }
        }
    }
    return routes;
}

export function listExpressRoute(
    router: Router,
    path = "",
    routes: {
        methods: string[];
        path: string;
        handlersName: string[];
    }[] = []
) {
    if (!router) {
        throw {
            error: {
                msg: "App Server is not set on the endpoints list builder",
                name: "server error",
            },
        };
    }

    if (router.stack) {
        for (const layer of router.stack) {
            if (layer.route) {
                const route = {
                    methods: (layer.route as any).methods as string[],
                    path: `${path}${layer.route.path}`.replace("\\", ""),
                    handlersName: layer.route.stack.map((handler) => handler?.name),
                };
                routes.push(route);
            }

            if ((layer?.handle as any)?.stack) {
                console.log(layer.regexp);
                const subPath = String(layer.regexp)
                    .match(/(\^\\?)(.*?)(\\\/\?)/)?.[2]
                    ?.replace("\\", "");

                listExpressRoute(layer.handle as any, path + subPath, routes);
            }
        }
    }
    return routes;
}
