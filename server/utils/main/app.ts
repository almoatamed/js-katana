import { HandlerFunction, clientModifierMiddleware as clientModifier } from "$/server/utils/express/index.js";
import { createServer } from "http";
import { routerConfig } from "../../config/routing/index.js";
import buildChannelling, { run, runThreaded } from "../channelsBuilder/index.js";
import rootPaths from "../dynamicConfiguration/rootPaths.js";

export async function createApp(multithreading = false) {
    const logUtil = await import("../log/index.js");
    const llog = await logUtil.localLogDecorator("MAIN_SERVER", "red", true, "Info");
    const path = (await import("path")).default;
    const express = (await import("$/server/utils/express/index.js")).default;
    const cors = (await import("cors")).default;
    const srcPath = rootPaths.srcPath;

    const app = express();

    const compression = (await import("compression")).default;
    app.use(compression());

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: false }));
    app.use(cors());
    const middlewares: HandlerFunction[] = [];
    app.use((await import("./requestLogger.js")).requestLogger);

    if (routerConfig.embedModifiedVersionOfModulesInRequest()) {
        app.use(clientModifier as any);
        middlewares.push(clientModifier);
    }

    // router
    llog("started building routers");
    app.use(
        routerConfig.getApiPrefix(),
        (await (await import("../mainRouterBuilder/index.js")).default("/", middlewares))._Router,
    );
    llog("finished building routers");

    // Set static folder
    for (const staticResource of routerConfig.getStaticDirs()) {
        const root = path.join(srcPath, staticResource.local);
        const remotePrefix = staticResource.remote;
        llog("created static file server", root, remotePrefix);
        if (staticResource.middleware) {
            app.use(
                remotePrefix,
                (await import(path.join(srcPath, staticResource.middleware))).default,
                express.static(root),
            );
        } else {
            app.use(remotePrefix, express.static(root));
        }
    }

    const { errorHandler } = await import("./errorHandler.js");
    app.use(errorHandler);

    await buildChannelling(app);
    return {
        app,
        makeServer: async () => {
            const httpServer = createServer(app);

            if (multithreading) {
                runThreaded(httpServer);
            } else {
                run(httpServer);
            }

            return httpServer;
        },
    };
}
