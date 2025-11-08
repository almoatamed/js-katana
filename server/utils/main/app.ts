import { createServer } from "http";
import { run, runThreaded } from "../channelsBuilder/index.js";
import { createLogger } from "kt-logger";
import express from "express";
import path from "path";
import cors from "cors";

import { getApiPrefix, getCorsOptions, getMaxJsonSize, getSourceDir, getStaticDirs } from "../loadConfig/index.js";
import compression from "compression";
import { routesRegistryMap } from "../mainRouterBuilder/index.js";
import { createHandler, extractRequestError, HandlerContext, Route, throwRequestError } from "../router/index.js";
import { Handler as ExpressHandler } from "express";

const convertHandlerToExpressMiddleware = (route: Omit<Route<any, any, any, any, any>, "handler">) => {
    const expressHandler: ExpressHandler = async (request, response, next) => {
        let responded = false;
        try {
            const query = { ...request.query };
            const params = { ...request.params };
            const headers = { ...request.headers };
            const body = { ...request.body };
            const context: HandlerContext<any, any, any, any> = {
                locale: {},
                fullPath: request.originalUrl,
                method: route.method,
                respond: {
                    async file(fullPath) {
                        response.sendFile(fullPath);
                        responded = true;
                        return {
                            path: fullPath,
                        };
                    },
                    html: (text) => {
                        response.setHeader("Content-Type", "text/html; charset=utf-8");
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
                body,
                headers,
                params,
                query,
                setStatus(_statusCode) {
                    response.status(_statusCode);
                    return context;
                },
            };
            for (const middleware of [...route.externalMiddlewares, ...route.middleWares]) {
                await middleware(context, body, query, params, headers);
                if (responded) {
                    return;
                }
            }

            next();
        } catch (error) {
            console.error("Error in static resource middleware:", error);
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
    };
    return expressHandler;
};

const convertHandlerToExpressRoute = (route: Route<any, any, any, any, any>) => {
    const expressHandler: ExpressHandler = async (request, response) => {
        let responded = false;
        try {
            const query = { ...request.query };
            const params = { ...request.params };
            const headers = { ...request.headers };
            const body = { ...request.body };

            const context: HandlerContext<any, any, any, any> = {
                locale: {},
                method: route.method,
                fullPath: request.originalUrl,
                respond: {
                    async file(fullPath) {
                        response.sendFile(fullPath);
                        responded = true;
                        return {
                            path: fullPath,
                        };
                    },
                    html: (text) => {
                        response.setHeader("Content-Type", "text/html; charset=utf-8");
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
                body,
                headers,
                params,
                query,
                setStatus(_statusCode) {
                    response.status(_statusCode);
                    return context;
                },
            };

            for (const middleware of [...route.externalMiddlewares, ...route.middleWares]) {
                await middleware(context, body, query, params, headers);
                if (responded) {
                    return;
                }
            }

            await route.handler(context, body, query, params, headers);
            if (!responded) {
                console.warn("You Did not respond properly to the request on", route.method, request.originalUrl);
                response.json?.({
                    msg: "OK",
                });
            }
        } catch (error) {
            console.error("Error in route handler:", error);
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
    };
    return expressHandler;
};

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
        ](path, convertHandlerToExpressRoute(route));
    }

    app.use(await getApiPrefix(), router);
    llog("finished building routers");

    // Set static folder
    for (const staticResource of await getStaticDirs()) {
        const root = path.join(srcPath, staticResource.local);
        const remotePrefix = staticResource.remote;
        llog("created static file server", root, remotePrefix);
        if (staticResource.middlewares?.length) {
            const handler = createHandler({
                method: "GET",
                middleWares: staticResource.middlewares,
                handler: async () => {},
                serveVia: ["Http"],
            });
            const expressHandler = convertHandlerToExpressMiddleware(handler);
            app.use(remotePrefix, expressHandler, express.static(root));
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
