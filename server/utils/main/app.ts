import { createServer } from "http";
import { createLogger } from "kt-logger";
import express from "express";
import type { Request as BunRequest } from "undici-types";
import {
    getHeadersTimeout,
    getHttpAdapter,
    getKeepAliveTimeout,
    getMaxJsonSize,
    getMaxRequestBodySize,
    getPort,
    getRequestLogging,
    getUseNativeRouter,
    hasBun,
} from "../loadConfig/index.js";
import compression from "compression";
import { routesRegistryMap } from "../mainRouterBuilder/index.js";
import { createRequestError, extractRequestError, HandlerContext, Route } from "../router/index.js";
import { Handler as ExpressHandler } from "express";
import { TransactionLogger } from "./requestLogger.js";
import { trimSlashes } from "kt-common";
import { MaybePromise } from "bun";
import cluster from "cluster";
import { runBun, runExpress, runThreadedExpress } from "../channelsBuilder/index.js";
import { SegmentTrieRouter } from "../routersHelpers/trieRouter.js";
import { getNativeRouter, NativeRouterModule } from "../routersHelpers/nativeRouter.js";

const log = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "SERVER",
    worker: true,
});

/**
 * Per-request transaction logging is the single largest hot-path cost
 * (date formatting + console writes on every request). It defaults to
 * development-only and can be forced on/off via `getRequestLogging`.
 */
const requestLoggingEnabled = await getRequestLogging();

type BunHandler<Req extends BunRequest, S, Res> = (request: Req, server: S) => MaybePromise<Res>;

/**
 * Manual URL splitting — avoids allocating a `URL` object per request when we
 * only need the pathname and the raw query string. Handles both full URLs
 * (Bun passes absolute URLs) and bare paths.
 */
const parseRequestUrl = (url: string): { pathname: string; search: string } => {
    let rest = url;

    // strip scheme://authority prefix
    const schemeIndex = rest.indexOf("://");
    if (schemeIndex !== -1) {
        const authorityStart = schemeIndex + 3;
        const authorityEnd = rest.indexOf("/", authorityStart);
        if (authorityEnd === -1) {
            // e.g. "http://host:3001" with no path (query may still exist)
            const queryIndex = rest.indexOf("?", authorityStart);
            return {
                pathname: "/",
                search: queryIndex === -1 ? "" : rest.slice(queryIndex + 1),
            };
        }
        rest = rest.slice(authorityEnd);
    }

    // rest now starts with the pathname (or is empty)
    let pathname = rest;
    let search = "";
    const queryIndex = rest.indexOf("?");
    if (queryIndex !== -1) {
        pathname = rest.slice(0, queryIndex);
        search = rest.slice(queryIndex + 1);
        const hashIndex = search.indexOf("#");
        if (hashIndex !== -1) {
            search = search.slice(0, hashIndex);
        }
    } else {
        const hashIndex = rest.indexOf("#");
        if (hashIndex !== -1) {
            pathname = rest.slice(0, hashIndex);
        }
    }
    return { pathname, search };
};

/**
 * Minimal query-string parser (flat keys, duplicate keys → arrays, percent
 * decoding). Faster than `qs` for the common case.
 */
const parseQueryString = (search: string): Record<string, any> => {
    if (!search) return {};
    const result: Record<string, any> = {};
    const parts = search.split("&");
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const eqIndex = part.indexOf("=");
        let key: string;
        let value: string;
        if (eqIndex === -1) {
            key = part;
            value = "";
        } else {
            key = part.slice(0, eqIndex);
            value = part.slice(eqIndex + 1);
        }
        try {
            key = decodeURIComponent(key.replace(/\+/g, " "));
            value = decodeURIComponent(value.replace(/\+/g, " "));
        } catch {
            // keep raw values on malformed encodings
        }
        if (result[key] === undefined) {
            result[key] = value;
        } else if (Array.isArray(result[key])) {
            result[key].push(value);
        } else {
            result[key] = [result[key], value];
        }
    }
    return result;
};

/**
 * Exposes a `Headers` instance (e.g. Bun's `context.headers`) as the plain
 * case-insensitive object handlers expect, matching Node/Express `req.headers`
 * semantics — without copying the headers eagerly on every request.
 *
 * Access is resolved lazily through a Proxy: bracket/property reads hit
 * `headers.get(key)` only for the keys a handler actually touches, so
 * header-light requests never pay for enumeration.
 */
const requestHeadersView = (headers: {
    get: (name: string) => string | null;
    has: (name: string) => boolean;
    keys: () => IterableIterator<string>;
}): Record<string, string> => {
    return new Proxy({} as Record<string, string>, {
        get(_target, prop, receiver) {
            if (typeof prop === "string") {
                const value = headers.get(prop);
                return value === null ? undefined : value;
            }
            return Reflect.get(headers, prop, headers);
        },
        has(_target, prop) {
            return typeof prop === "string" && headers.has(prop);
        },
        ownKeys() {
            return Array.from(headers.keys());
        },
        getOwnPropertyDescriptor(_target, prop) {
            if (typeof prop !== "string") return undefined;
            const value = headers.get(prop);
            if (value === null) return undefined;
            return { enumerable: true, configurable: true, value };
        },
    });
};

const convertHandlerToExpressRoute = (route: Route<any, any, any, any, any, any>) => {
    const allMiddlewares = route.allMiddlewares;
    const expressHandler: ExpressHandler = async (request, response) => {
        let responded = false;
        let logger: TransactionLogger | undefined = undefined;
        if (requestLoggingEnabled) {
            logger = new TransactionLogger("Request Logger");
        }

        try {
            if (requestLoggingEnabled) {
                const text = `
        method: ${request.method} 
        url: ${request.protocol}://${request.get("host")}${request.originalUrl} 
        Authentication: ${request.headers["authorization"]
                    ? "Has Authorization Info in headers"
                    : "Doesn't have Authorization Info in headers"
                }
        started at: ${new Date().toISOString()} 
`;
                logger?.log("blue", text);
            }

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
                body: request.body,
                headers: request.headers,
                params: request.params,
                query: request.query,
                setStatus(_statusCode) {
                    response.status(_statusCode);
                    return context;
                },
            };

            for (const middleware of allMiddlewares) {
                await middleware(context, request.body, request.query, request.params, request.headers);
                if (responded) {
                    return;
                }
            }

            await route.handler(context, request.body, request.query, request.params, request.headers);
            if (!responded) {
                logger?.warn("yellow", "You Did not respond properly to the request on", route.method, request.originalUrl);
                response.json?.({
                    msg: "OK",
                });
            }
        } catch (error) {
            if (requestLoggingEnabled) {
                logger?.error("red", "Error in route handler:", error);
            } else {
                console.error("Error in route handler:", error);
            }
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
            if (requestLoggingEnabled) {
                logger
                    ?.log(
                        "red",
                        `
        Status Code: ${response.statusCode}
        Finished At: ${new Date().toISOString()}                
`
                    )
                    .out();
            }
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
 * Kept as a fallback for patterns with optional params (`:id?`) which the
 * SegmentTrieRouter intentionally does not handle.
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


type NativeRouterInstance = InstanceType<NativeRouterModule["NativeRouter"]>;

export const handleGeneralBunRequest = async () => {
    const exactRoutesMap = new Map<string, GeneralRoute>()
    // Segment trie for O(segments) dynamic matching (no regex per request)
    const dynamicRoutesTrie = new SegmentTrieRouter<GeneralRoute>()
    // Regex fallback for optional-param patterns (`:id?`)
    const patternedRoutesList: {
        matcher: RouteMatcher;
        route: GeneralRoute;
    }[] = []
    // Native (napi-rs) trie, when opted in via `useNativeRouter`
    const useNativeRouter = await getUseNativeRouter()
    let nativeRouter: NativeRouterInstance | null = null
    let nativeRoutes: GeneralRoute[] = []
    if (useNativeRouter) {
        const nativeModule = getNativeRouter()
        if (nativeModule) {
            nativeRouter = new nativeModule.NativeRouter()
        } else {
            log.warning(
                "native router requested via `useNativeRouter` but the native module is not available; falling back to the JS router. Run `npm run build:native` in js-kt and rebuild."
            )
        }
    }


    const includeMethod = (route: string, method: string) => {
        if (method.toUpperCase() == "ALL") {
            return route
        }
        return `${method}---${route}`
    }

    // A pattern is trie-safe when every `:param`/`*wildcard` token starts its own
    // segment and uses a plain identifier. Anything else (optional `:id?`, embedded
    // tokens like `describe.:ext`) is delegated to the regex RouteMatcher.
    const trieSegment = /^:([A-Za-z0-9_]+)$/;
    const wildcardSegment = /^\*([A-Za-z0-9_]+)$/;
    const isTrieSafe = (pattern: string): boolean => {
        const segments = pattern.split("/");
        for (const segment of segments) {
            if (trieSegment.test(segment) || wildcardSegment.test(segment)) continue;
            if (segment.includes(":") || segment.includes("*")) return false;
        }
        return true;
    };

    for (const routePattern in routesRegistryMap) {
        const route = routesRegistryMap[routePattern]
        const hasTokens = routePattern.match(RouteMatcher.tokenRe)

        const fullRoutePattern = includeMethod(trimSlashes(routePattern), route.method)
        if (hasTokens) {
            if (fullRoutePattern.includes("?") || !isTrieSafe(fullRoutePattern)) {
                // optional params or exotic token placement: keep regex fallback
                const matcher = new RouteMatcher(fullRoutePattern)

                patternedRoutesList.push({
                    matcher,
                    route,
                })
            } else if (nativeRouter) {
                nativeRouter.add(fullRoutePattern, nativeRoutes.length)
                nativeRoutes.push(route)
            } else {
                dynamicRoutesTrie.add(fullRoutePattern, route)
            }
        } else {
            exactRoutesMap.set(fullRoutePattern, route)
        }
    }

    const bunHandler: BunHandler<BunRequest, any, any> = async (request) => {
        let logger: TransactionLogger | undefined = undefined;
        if (requestLoggingEnabled) {
            logger = new TransactionLogger("Request Logger");
        }
        let responded = false;
        let responseStatusCode = 200;

        try {
            const { pathname, search } = parseRequestUrl(request.url);
            const query = parseQueryString(search);
            const routePath = trimSlashes(pathname)
            const fullRoutePattern = includeMethod(routePath, request.method)
            let response: Response | null = null

            let params: any = {}
            let route: GeneralRoute | null = null

            route = exactRoutesMap.get(fullRoutePattern) || null
            const requestHeaders = requestHeadersView(request.headers)
            if (route) {
                params = {}
            } else if (nativeRouter) {
                const nativeMatch = nativeRouter.matchRoute(fullRoutePattern)
                if (nativeMatch.found) {
                    route = nativeRoutes[nativeMatch.routeId]
                    params = nativeMatch.params
                    const wildcards = nativeMatch.wildcards
                    for (const wildcardName in wildcards) {
                        params[wildcardName] = wildcards[wildcardName]
                    }
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
            } else {
                const trieMatch = dynamicRoutesTrie.match(fullRoutePattern)
                if (trieMatch) {
                    route = trieMatch.route;
                    params = trieMatch.params;
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
            }

            // Parse the body only when a route will actually consume it. This also
            // keeps 404s free of body-parsing overhead.
            const body: any = request.headers.get("content-type")?.includes("application/json") ? await request.json() : {}

            if (requestLoggingEnabled) {
                const text = `
        method: ${request.method} 
        url: ${request.url} 
        Authentication: ${requestHeaders["authorization"]
                    ? "Has Authorization Info in headers"
                    : "Doesn't have Authorization Info in headers"
                }
        started at: ${new Date().toISOString()} 
`;

                logger?.log("blue", text);
            }

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

            // Response headers are created lazily — most responses never set one.
            let responseHeaders: Headers | null = null;
            const ensureHeaders = () => responseHeaders ?? (responseHeaders = new Headers());

            const context: HandlerContext<any, any, any, any, any> = {
                locals: {},
                servedVia: "http",
                setHeader(key, value) {
                    ensureHeaders().set(key, value);
                },
                sourceStream: request.body,
                method: route.method,
                fullPath: routePath,
                respond: {
                    async file(fullPath) {
                        responded = true;
                        response = new Response(Bun.file(fullPath), {
                            headers: responseHeaders || undefined,
                            status: responseStatusCode,
                        })
                        return {
                            path: fullPath
                        }
                    },
                    html: (text) => {
                        responded = true;
                        const headers = ensureHeaders();
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
                            headers: responseHeaders || undefined,
                            status: responseStatusCode,

                        })
                        return text;
                    },
                    json: (data: any) => {
                        responded = true;
                        const headers = ensureHeaders();
                        headers.set("Content-Type", "application/json")
                        response = new Response(JSON.stringify(data), {
                            headers,
                            status: responseStatusCode,
                        });
                        return data;
                    },
                },
                body,
                headers: requestHeaders,
                params,
                query,
                setStatus(_statusCode) {
                    responseStatusCode = _statusCode
                    return context;
                },
            };

            for (const middleware of route.allMiddlewares) {
                await middleware(context, body, query, params, requestHeaders);
                if (response && responded) {
                    return response;
                }
            }

            await route.handler(context, body, query, params, requestHeaders);
            if (response && responded) {
                return response
            }

            logger?.warn("yellow", "You Did not respond properly to the request on", route.method, request.url);
            return new Response(JSON.stringify({
                msg: "OK",
            }));
        } catch (error) {
            if (responded) {
                return;
            }
            if (requestLoggingEnabled) {
                logger?.error("red", "Error in route handler:", error);
            } else {
                console.error("Error in route handler:", error);
            }
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
            if (requestLoggingEnabled) {
                logger
                    ?.log(
                        "red",
                        `
        Status Code: ${responseStatusCode}
        Finished At: ${new Date().toISOString()}                
`
                    )
                    .out();
            }
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
            
            if ((multithreading && !cluster.isPrimary) || (!multithreading && cluster.isPrimary)) {
                const engine = await runBun();
                const routerHandler = await handleGeneralBunRequest()
                const maxRequestBodySize = await getMaxRequestBodySize()
                const socketPath = trimSlashes(engine.opts.path)
               
                serve({
                    reusePort: multithreading,
                    port,
                    ...engine.handler(),
                    ...(maxRequestBodySize !== undefined ? { maxRequestBodySize } : {}),
                    error: bunErrorHandler,
                    fetch: async (req, server: any) => {
                        const { pathname } = parseRequestUrl(req.url);
                        if (trimSlashes(pathname) === socketPath) {
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
