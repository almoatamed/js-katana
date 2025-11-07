import { createServer } from "http";
import { run, runThreaded } from "../channelsBuilder/index.js";
import { createLogger } from "kt-logger";
import express from "express";
import path from "path";
import cors from "cors";

import { getApiPrefix, getCorsOptions, getMaxJsonSize, getSourceDir, getStaticDirs } from "../loadConfig/index.js";
import compression from "compression";
import { routesRegistryMap } from "../mainRouterBuilder/index.js";
import { extractRequestError, HandlerContext, throwRequestError } from "../router/index.js";

export async function createApp(multithreading = false) {
    const llog = await createLogger({
        color: "red",
        logLevel: "Info",
        name: "SERVER",
        worker: true,
    });

    const srcPath = await getSourceDir();

    const app = express();
    app.use(compression());
    app.use(express.json({ limit: await getMaxJsonSize() }));
    app.use(express.urlencoded({ extended: false }));

    const corsConfig = await getCorsOptions();
    app.use(cors(corsConfig));

    app.use((await import("./requestLogger.js")).requestLogger);

    // router
    llog("started building routers");
    await (await import("../mainRouterBuilder/index.js")).default();

    const router = express.Router();
    for (const [path, route] of Object.entries(routesRegistryMap)) {
        router[
            route.method == "GET"
                ? "get"
                : route.method == "PUT"
                ? "put"
                : route.method == "POST"
                ? "post"
                : route.method == "ALL"
                ? "all"
                : "delete"
        ](path, async (request, response) => {
            let responded = false;
            try {
                const query = request.query || {};
                const params = request.params || {};
                const headers = request.headers || {};

                const context: HandlerContext<any, any, any, any> = {
                    locale: {},
                    respond: {
                        async file(fullPath) {
                            response.sendFile(fullPath);
                            responded = true;
                            return {
                                path: fullPath,
                            };
                        },
                        html: (text) => {
                            response.send(text);
                            responded = true;

                            return text;
                        },
                        text: (text) => {
                            response.send(text);
                            responded = true;

                            return text;
                        },
                        json: (data: any) => {
                            response.json(data);
                            responded = true;
                            return data;
                        },
                    },
                    body: request.body,
                    headers,
                    params,
                    query,
                    setStatus(_statusCode) {
                        response.status(_statusCode);
                        return context;
                    },
                };

                for (const middleware of route.middleWares) {
                    await middleware(context, request.body, query, params, headers);
                }

                await route.handler(context, request.body, query, params, headers);
                if (!responded) {
                    console.warn("You Did not respond properly to the request on", route.method, path);
                    response.json?.({
                        msg: "OK",
                    });
                }
            } catch (error) {
                if (responded) {
                    return;
                }
                const requestError = extractRequestError(error);
                if (requestError) {
                    response.status(requestError.statusCode).json(requestError);
                    return;
                }
                response.status(500).json(
                    throwRequestError(500, [
                        {
                            error: "Unknown server error",
                            data: error,
                        },
                    ])
                );
            }
        });
    }

    app.use(await getApiPrefix(), router);
    llog("finished building routers");

    // Set static folder
    for (const staticResource of await getStaticDirs()) {
        const root = path.join(srcPath, staticResource.local);
        const remotePrefix = staticResource.remote;
        llog("created static file server", root, remotePrefix);
        if (staticResource.middleware) {
            app.use(remotePrefix, staticResource.middleware, express.static(root));
        } else {
            app.use(remotePrefix, express.static(root));
        }
    }

    const { errorHandler } = await import("./errorHandler.js");
    app.use(errorHandler);

    return {
        app,
        makeServer: async () => {
            const httpServer = createServer(app);

            if (multithreading) {
                await runThreaded(httpServer);
            } else {
                await run(httpServer);
            }

            return httpServer;
        },
    };
}
