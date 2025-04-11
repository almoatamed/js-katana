// @ts-nocheck
const endPoints = [];

function routesLister(router, path = "", routes = endPoints, root = true) {
    if (root) {
        routes.splice(0, routes.length);
    }

    if (router.stack) {
        for (const layer of router.stack) {
            if (layer.route) {
                routes.push({
                    methods: layer.route.methods,
                    path: `${path}${layer.route.path}`.replace("\\", ""),
                    handlersName: layer.route.stack.map((handler) => handler?.name),
                });
            }
            if (layer?.handle?.stack) {
                const subPath = String(layer.regexp)
                    .match(/(\^\\?)(.*?)(\\\/\?)/)[2]
                    .replace("\\", "");
                routesLister(layer.handle, path + subPath, routes, false);
            }
        }
    }
    return routes;
}

export default endPoints;
export { routesLister };
