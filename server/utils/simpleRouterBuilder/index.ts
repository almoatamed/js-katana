import express from "express";
import path from "path";
import fs from "fs";

;
import rootPaths from "../dynamicConfiguration/rootPaths.js";
import { routerConfig } from "../../config/routing/index.js";

const appPath = rootPaths.appPath;

type Opts = {
    routesDirectory?: string;
    prefix?: string;
    router?: any;
};

export default async function build(opts: Opts = {}) {
    const routesDir = opts.routesDirectory || path.join(appPath, routerConfig.getRouterDirectory());
    const prefix = opts.prefix || "/";
    const router = opts.router || express.Router();

    const routesDirContents = fs.readdirSync(routesDir);

    for (const item of routesDirContents) {
        const itemPath = path.join(routesDir, item);
        const itemStat = fs.statSync(itemPath);

        if (itemStat.isDirectory()) {
            await build({
                routesDirectory: itemPath,
                router: router,
                prefix: prefix === "/" ? `/${item}` : `${prefix}/${item}`,
            });
            continue;
        }

        if (item.startsWith("get")) {
            router.get(prefix, (await import(itemPath)).default);
        } else if (item.startsWith("post")) {
            router.post(prefix, (await import(itemPath)).default);
        } else if (item.startsWith("delete")) {
            router.delete(prefix, (await import(itemPath)).default);
        } else if (item.startsWith("patch")) {
            router.patch(prefix, (await import(itemPath)).default);
        } else if (item.startsWith("put")) {
            router.put(prefix, (await import(itemPath)).default);
        }
    }

    return router;
}
