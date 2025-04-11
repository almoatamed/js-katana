// @ts-nocheck
import envObj from "$/server/env.js";

const routesList = (await import("$/server/utils/routersHelpers/buildEndpoints/index.js")).default;

const appObj = {};
function setApp(app) {
    appObj.app = app;
}

function removeRoute(router, targetRoutesPaths, targetRoutesHandlersContain, path = "", routes = [], root = true, updateEndpoints = false) {
    if (!router) {
        if (!appObj.app?.Router) {
            throw {
                statusCode: envObj.response.statusCodes.serverError,
                error: {
                    msg: "App Server is not set on the endpoints list builder",
                    name: "server error",
                },
            };
        }
        router = appObj.app.Router;
    }

    if (router.stack) {
        for (const layer of router.stack) {
            if (layer.route) {
                const Path = `${path}${layer.route.path}`;
                const HandlersNames = layer.route.stack.map((handler) => handler?.name);
                let removed = false;
                if (targetRoutesPaths) {
                    if (targetRoutesPaths.includes(Path)) {
                        console.log(Path, HandlersNames);
                        removed = true;
                        router.stack = router.stack.filter((Layer) => {
                            const handlersNames = Layer?.route?.stack.map((handler) => handler?.name);
                            return !(
                                handlersNames?.length === HandlersNames?.length &&
                                handlersNames.every((name) => HandlersNames.includes(name)) &&
                                !!Layer?.route?.path &&
                                Layer?.route?.path === layer.route.path
                            );
                        });
                    }
                }
                if (targetRoutesHandlersContain) {
                    if (targetRoutesHandlersContain.some((targetName) => HandlersNames.filter((name) => name != "<anonymous>").includes(targetName))) {
                        removed = true;
                        router.stack = router.stack.filter((Layer) => {
                            const handlersNames = Layer?.route?.stack.map((handler) => handler?.name);
                            return !(
                                handlersNames?.length === HandlersNames?.length &&
                                handlersNames.every((name) => HandlersNames.includes(name)) &&
                                !!Layer?.route?.path &&
                                Layer?.route?.path === layer.route.path
                            );
                        });
                    }
                }
                if (!removed) {
                    routes.push({
                        methods: layer.route.methods,
                        path: `${path}${layer.route.path}`.replace("\\", ""),
                        handlersName: layer.route.stack.map((handler) => handler?.name),
                    });
                }
            }
            if (layer?.handle?.stack) {
                console.log(layer.regexp);
                const subPath = String(layer.regexp)
                    .match(/(\^\\?)(.*?)(\\\/\?)/)[2]
                    .replace("\\", "");
                removeRoute(layer.handle, targetRoutesPaths, targetRoutesHandlersContain, path + subPath, routes, false);
            }
        }
    }
    if (root && updateEndpoints) {
        routesList.splice(0, routesList.length);
        routesList.push(...routes);
    }
    return routes;
}

export default removeRoute;
export { setApp };
