import { createServer } from "http";
import { createLogger } from "kt-logger";
import express from "express";
import type { Request as BunRequest } from "undici-types";
import qs from "qs";
import {
    getHeadersTimeout,
    getHttpAdapter,
    getKeepAliveTimeout,
    getMaxJsonSize,
    getPort,
    hasBun,
} from "../loadConfig/index.js";
import compression from "compression";
import { routesRegistryMap } from "../mainRouterBuilder/index.js";
import { createRequestError, extractRequestError, HandlerContext, Route } from "../router/index.js";
import { Handler as ExpressHandler } from "express";
import { TransactionLogger } from "./requestLogger.js";
import { dashDateFormatter, trimSlashes } from "kt-common";
import { MaybePromise } from "bun";
import cluster from "cluster";
import { runBun, runExpress, runThreadedBun, runThreadedExpress } from "../channelsBuilder/index.js";
import type { Server as BunEngine } from "@socket.io/bun-engine"
const log = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "SERVER",
    worker: true,
});

type BunHandler<Req extends BunRequest, S, Res> = (request: Req, server: S) => MaybePromise<Res>;

const convertHandlerToExpressRoute = (route: Route<any, any, any, any, any, any>) => {
    const expressHandler: ExpressHandler = async (request, response) => {
        let responded = false;
        const logger = new TransactionLogger("Request Logger");

        try {
            const text = `
        method: ${request.method} 
        url: ${request.protocol}://${request.get("host")}${request.originalUrl} 
        Authentication: ${request.headers["authorization"]
                    ? "Has Authorization Info in headers"
                    : "Doesn't have Authorization Info in headers"
                }
        started at: ${dashDateFormatter(new Date(), {
                    getDate: true,
                    getTime: true,
                    getMilliseconds: true,
                    dateFormat: "yyyy-mm-dd",
                })} 
`;
            logger.log("blue", text);
            const query = { ...request.query };
            const params = { ...request.params };
            const headers = { ...request.headers };
            const body = { ...request.body };

            const context: HandlerContext<any, any, any, any, any> = {
                locals: {},
                servedVia: "http",
                setHeader(key, value) {
                    response.setHeader(key, value);
                },
                sourceStream: request,
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
                logger.warn("yellow", "You Did not respond properly to the request on", route.method, request.originalUrl);
                response.json?.({
                    msg: "OK",
                });
            }
        } catch (error) {
            logger.error("red", "Error in route handler:", error);
            if (responded) {
                return;
            }
            const requestError = extractRequestError(error);
            if (requestError) {
                response.status(requestError.statusCode).json(requestError);
                return;
            }
            response.status(500).json(
                createRequestError(500, [
                    {
                        error: "Unknown server error",
                        data: error,
                    },
                ])
            );
        } finally {
            logger
                .log(
                    "red",
                    `
        Status Code: ${response.statusCode}
        Finished At: ${dashDateFormatter(new Date(), {
                        getDate: true,
                        getTime: true,
                        getMilliseconds: true,
                        dateFormat: "yyyy-mm-dd",
                    })}                
`
                )
                .out();
        }
    };
    return expressHandler;
};

/**
 * RouteMatcher
 *  - new RouteMatcher(pattern)
 *  - matcher.match(path) -> { ok: boolean, params: Record<string,string|string[]> }
 *
 * Supports:
 *  - /api/x/:id            -> { id: "some-id" }
 *  - /api/x/:id?           -> optional id
 *  - /api/x/*filePath      -> { filePath: ["one","two","three"] }
 *
 * Note: uses RegExp named capture groups (Node 10+ / modern browsers).
 */
class RouteMatcher {
    pattern: string;
    regex: RegExp;
    keys: {
        name: string;
        wildcard: boolean;
        optional: boolean;
    }[]
    constructor(pattern: string) {
        const { regex, keys } = this._compile(pattern);
        this.pattern = pattern;
        this.regex = regex;
        this.keys = keys; // array of { name, wildcard, optional }
    }

    _escapeLiteral(s: string) {
        return s.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
    }

    static tokenRe = /:([A-Za-z0-9_]+)(\?)?|\*([A-Za-z0-9_]+)/g;

    _compile(pattern: string) {
        // token regex: captures :name (with optional ?) or *name
        const tokenRe = new RegExp(RouteMatcher.tokenRe);
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        let regexParts = "";
        const keys: {
            name: string;
            wildcard: boolean;
            optional: boolean;
        }[] = [];
        while ((m = tokenRe.exec(pattern)) !== null) {
            const index = m.index;
            // add escaped literal before token
            if (index > lastIndex) {
                regexParts += this._escapeLiteral(pattern.slice(lastIndex, index));
            }

            if (m[1]) {
                // :name (m[1]) possibly optional if m[2] === '?'
                const name = m[1];
                const optional = !!m[2];

                if (optional) {
                    // make the slash + segment optional: (?:/<name>[^/]+)?
                    regexParts += `(?:/(?<${name}>[^/]+))?`;
                } else {
                    // require segment (no slash inserted here; pattern should include '/')
                    // But ensure it consumes a segment (no slashes inside)
                    regexParts += `(?<${name}>[^/]+)`;
                }
                keys.push({ name, wildcard: false, optional });
            } else if (m[3]) {
                // *name wildcard - capture the rest (can be empty)
                const name = m[3];
                // allow zero or more chars (we'll split into segments later)
                regexParts += `(?<${name}>.*)`;
                keys.push({ name, wildcard: true, optional: true });
            }

            lastIndex = tokenRe.lastIndex;
        }

        // tail literal
        if (lastIndex < pattern.length) {
            regexParts += this._escapeLiteral(pattern.slice(lastIndex));
        }

        // allow optional trailing slash, enforce start/end
        const fullRegex = "^" + regexParts + "\\/?$";
        const regex = new RegExp(fullRegex);

        return { regex, keys };
    }

    _decode(s: string) {
        if (s === undefined) return undefined;
        try {
            // replace plus with space like form decoding
            return decodeURIComponent(s.replace(/\+/g, " "));
        } catch {
            return s;
        }
    }

    match(path: string) {
        if (!path) return { ok: false, params: {} };
        // strip query/hash
        path = path.split("?")[0].split("#")[0];

        const m = path.match(this.regex);
        if (!m) return { ok: false, params: {} };

        const params = {};
        // some engines may not populate groups; be defensive
        const groups = (m && m.groups) ? m.groups : {};

        for (const key of this.keys) {
            const raw = groups[key.name];

            if (key.wildcard) {
                // split by slash, filter empties, decode each
                if (!raw) {
                    params[key.name] = [];
                } else {
                    params[key.name] = raw.split("/").filter(Boolean).map(seg => this._decode(seg));
                }
            } else {
                if (raw === undefined) {
                    params[key.name] = undefined;
                } else {
                    params[key.name] = this._decode(raw);
                }
            }
        }

        return { ok: true, params };
    }
}
type GeneralRoute = Route<any, any, any, any, any, any>


const handleGeneralBunRequest = () => {
    const exactRoutesMap = new Map<string, GeneralRoute>()
    const patternedRoutesList: {
        matcher: RouteMatcher;
        route: GeneralRoute;
    }[] = []


    const includeMethod = (route: string, method: string) => {
        if (method.toUpperCase() == "ALL") {
            return route
        }
        return `${method}---${route}`
    }

    for (const routePattern in routesRegistryMap) {
        const route = routesRegistryMap[routePattern]
        const match = routePattern.match(RouteMatcher.tokenRe)

        const fullRoutePattern = includeMethod(trimSlashes(routePattern), route.method)
        if (match) {
            const matcher = new RouteMatcher(fullRoutePattern)

            patternedRoutesList.push({
                matcher,
                route,
            })
        } else {
            exactRoutesMap.set(fullRoutePattern, route)
        }
    }

    const bunHandler: BunHandler<BunRequest, any, any> = async (request) => {
        const logger = new TransactionLogger("Request Logger");
        let responded = false;
        let responseStatusCode = 200;

        try {
            const url = new URL(request.url);
            const query = qs.parse(request.url.split("?")[1] || "");
            const routePath = trimSlashes(url.pathname)
            const body: any = request.headers.get("content-type")?.includes("application/json") ? await request.json() : {}
            const fullRoutePattern = includeMethod(routePath, request.method)
            let response: Response | null = null

            let params: any = {}
            let route: GeneralRoute | null = null

            route = exactRoutesMap.get(fullRoutePattern) || null
            const headers = new Headers()
            if (route) {
                params = {}
            } else {
                for (const r of patternedRoutesList) {
                    const match = r.matcher.match(fullRoutePattern);
                    if (match.ok) {
                        route = r.route;
                        params = match.params
                        break
                    }
                }
            }


            const text = `
        method: ${request.method} 
        url: ${url} 
        Authentication: ${request.headers["authorization"]
                    ? "Has Authorization Info in headers"
                    : "Doesn't have Authorization Info in headers"
                }
        started at: ${dashDateFormatter(new Date(), {
                    getDate: true,
                    getTime: true,
                    getMilliseconds: true,
                    dateFormat: "yyyy-mm-dd",
                })} 
`;

            logger.log("blue", text);

            if (!route) {
                throw createRequestError(404, [
                    {
                        error: "invalid url, route with given path not found",
                        data: {
                            url: request.url
                        }
                    }
                ])
            }




            const context: HandlerContext<any, any, any, any, any> = {
                locals: {},
                servedVia: "http",
                setHeader(key, value) {
                    headers.set(key, value);
                },
                sourceStream: request.body,
                method: route.method,
                fullPath: routePath,
                respond: {
                    async file(fullPath) {
                        responded = true;
                        response = new Response(Bun.file(fullPath), {
                            headers,
                            status: responseStatusCode,
                        })
                        return {
                            path: fullPath
                        }
                    },
                    html: (text) => {
                        responded = true;
                        headers.set("Content-Type", "text/html; charset=utf-8");
                        response = new Response(text, {
                            headers,
                            status: responseStatusCode,

                        })
                        return text;
                    },
                    text: (text) => {
                        responded = true;
                        response = new Response(text, {
                            headers,
                            status: responseStatusCode,

                        })
                        return text;
                    },
                    json: (data: any) => {
                        headers.set("Content-Type", "application/json")
                        responded = true;
                        response = new Response(JSON.stringify(data), {
                            headers,
                            status: responseStatusCode,
                        });
                        return data;
                    },
                },
                body,
                headers,
                params,
                query,
                setStatus(_statusCode) {
                    responseStatusCode = _statusCode
                    return context;
                },
            };

            for (const middleware of [...route.externalMiddlewares, ...route.middleWares]) {
                await middleware(context, body, query, params, headers);
                if (response && responded) {
                    return response;
                }
            }

            await route.handler(context, body, query, params, headers);
            if (response && responded) {
                return response
            }

            logger.warn("yellow", "You Did not respond properly to the request on", route.method, request.url);
            return new Response(JSON.stringify({
                msg: "OK",
            }));
        } catch (error) {
            if (responded) {
                return;
            }
            logger.error("red", "Error in route handler:", error);
            const requestError = extractRequestError(error);
            if (requestError) {
                responseStatusCode = requestError.statusCode
                return new Response(JSON.stringify(requestError), {
                    status: requestError.statusCode,
                    headers: {
                        "content-type": "application/json"
                    }
                })
            }
            const serverError = createRequestError(500, [
                {
                    error: "Unknown server error",
                    data: error,
                },
            ])
            responseStatusCode = serverError.statusCode;
            return new Response(JSON.stringify(serverError), {
                status: serverError.statusCode
            })

        } finally {
            logger
                .log(
                    "red",
                    `
        Status Code: ${responseStatusCode}
        Finished At: ${dashDateFormatter(new Date(), {
                        getDate: true,
                        getTime: true,
                        getMilliseconds: true,
                        dateFormat: "yyyy-mm-dd",
                    })}                
`
                )
                .out();
        }
    };
    return bunHandler;
};

export async function createExpressApp(multithreading = false): Promise<{
    startServer: () => Promise<void>;
}> {
    const app = express();
    app.use(compression());
    app.use(express.json({ limit: await getMaxJsonSize() }));
    app.use(express.urlencoded({ extended: false }));

    // router
    log("started building routers");
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

    app.use(router);
    log("finished building routers");

    const { expressErrorHandler } = await import("./errorHandler.js");
    app.use(expressErrorHandler);

    return {
        startServer: async () => {
            const httpServer = createServer(app);
            const port = await getPort();

            if (multithreading) {
                await runThreadedExpress(httpServer);
            } else {
                await runExpress(httpServer);
            }
            if ((multithreading && !cluster.isPrimary) || (!multithreading && cluster.isPrimary)) {
                httpServer.listen(port);
                httpServer.keepAliveTimeout = await getKeepAliveTimeout();
                httpServer.headersTimeout = await getHeadersTimeout();
                log("started server in single thread mode", `Port: ${port}`, `PID: ${process.pid}`);
            }
        },
    };
}

export async function createBunApp(multithreading: boolean = false): Promise<{
    startServer: () => Promise<void>;
}> {
    log("started building routers");
    await (await import("../mainRouterBuilder/index.js")).default();
    const { serve } = await import("bun");

    return {
        async startServer() {
            const port = await getPort();
            const { bunErrorHandler } = await import("./errorHandler.js");
            let engine: BunEngine
            if (multithreading) {
                engine = await runThreadedBun();
            } else {
                engine = await runBun();
            }

            const routerHandler = handleGeneralBunRequest()

            if ((multithreading && !cluster.isPrimary) || (!multithreading && cluster.isPrimary)) {
                serve({
                    reusePort: multithreading,
                    port,
                    ...engine.handler(),
                    error: bunErrorHandler,
                    fetch: async (req, server: any) => {

                        const url = new URL(req.url);
                        if (trimSlashes(url.pathname) === trimSlashes(engine.opts.path)) {
                            try {
                                const result = await engine.handleRequest(req, server);
                                return result
                            } catch (error) {
                                console.error(error)
                                throw error
                            }
                        }
                        else {
                            return await routerHandler(req, server)
                        }
                    },
                });
            }
        },
    };
}

export async function createApp(multithreading = false) {
    const targetAdapter = await getHttpAdapter();
    const isBun = await hasBun();

    if (!isBun && targetAdapter == "bun") {
        console.warn("Configured HTTP adapter is `bun` but you dont have bun installed!");
    }

    if (isBun && (targetAdapter === undefined || targetAdapter == "bun")) {
        return createBunApp(multithreading);
    } else {
        return createExpressApp(multithreading);
    }
}
