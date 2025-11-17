import { createLogger } from "kt-logger";
import { createRequestError, extractRequestError } from "../../router/index.js";
import { Socket } from "socket.io";

const log = await createLogger({
    worker: false,
    color: "green",
    logLevel: "Info",
    name: "Socket-Manager",
});

export type ChannelHandlerFunction<B, R> = (
    body: B,
    respond: ((response: R) => void) | undefined,
    ev: string,
    params: Record<string, any>
) => any;
export type _ChannelHandler<B, R> = ChannelHandler<B, R>[];
export type ChannelHandler<B, R> = ChannelHandlerFunction<B, R> | _ChannelHandler<B, R>;
export type Respond<T> = (response: T) => void;

// Cache for compiled patterns (shared across all routers) - prevents recompilation
const patternCache = new Map<string, { regex: RegExp; keys: string[]; segmentCount: number; hasWildcards: boolean }>();

// Pre-compile regex for cleaning strings (reused across calls) - avoids recompilation overhead
const LEADING_TRAILING_SLASHES = /^\/+|\/+$/g;
const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

// Pre-allocated error response template (reused to reduce allocations)
const UNKNOWN_ERROR_TEMPLATE = { error: "Unknown Socket error", data: null as any };

// Optimized handler execution - avoids recursion overhead for deep nesting
export const perform = async (
    body: any,
    respond: Respond<any> | undefined,
    handler: ChannelHandler<any, any>,
    ev: string,
    params: Record<string, any>
) => {
    if (typeof handler === "function") {
        await handler(body, respond, ev, params);
        return;
    }

    if (Array.isArray(handler)) {
        // Process handlers sequentially using iteration instead of recursion
        // This avoids stack overflow for deeply nested handlers and reduces call overhead
        const stack: ChannelHandler<any, any>[] = [];
        let idx = handler.length;

        // Push handlers in reverse order so we process them in original order
        while (idx-- > 0) {
            stack.push(handler[idx]);
        }

        while (stack.length > 0) {
            const current = stack.pop()!;
            if (typeof current === "function") {
                await current(body, respond, ev, params);
            } else if (Array.isArray(current)) {
                // Push array items in reverse to maintain order
                idx = current.length;
                while (idx-- > 0) {
                    stack.push(current[idx]);
                }
            }
        }
    }
};

function escapeRegex(s: string): string {
    return s.replace(REGEX_ESCAPE, "\\$&");
}

function normalizePath(path: string): string {
    // Fast path for common cases (most paths don't need normalization)
    if (path.length === 0) return path;
    const first = path.charCodeAt(0);
    const last = path.charCodeAt(path.length - 1);
    // Check if starts or ends with '/' (charCode 47)
    if (first !== 47 && last !== 47) return path;
    return path.replace(LEADING_TRAILING_SLASHES, "");
}

function compilePattern(pattern: string): {
    regex: RegExp;
    keys: string[];
    segmentCount: number;
    hasWildcards: boolean;
} {
    // Check cache first - this is a major performance win for repeated patterns
    const cached = patternCache.get(pattern);
    if (cached) {
        return cached;
    }

    const clean = normalizePath(pattern);
    let segmentCount = 0;
    let hasWildcards = false;

    if (clean === "") {
        const result = { regex: /^$/, keys: [], segmentCount: 0, hasWildcards: false };
        patternCache.set(pattern, result);
        return result;
    }

    const parts = clean.split("/");
    segmentCount = parts.length;
    const keys: string[] = [];
    const regexParts: string[] = [];

    // Pre-allocate arrays and use for loop instead of map for better performance
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "*") {
            hasWildcards = true;
            keys.push("*");
            regexParts.push("(.+)");
        } else if (part.startsWith(":")) {
            hasWildcards = true;
            const name = part.slice(1);
            keys.push(name);
            regexParts.push("([^/]+)");
        } else {
            regexParts.push(escapeRegex(part));
        }
    }

    const regex = new RegExp("^" + regexParts.join("/") + "$");
    const result = { regex, keys, segmentCount, hasWildcards };
    patternCache.set(pattern, result);
    return result;
}

function matchPattern(
    compiled: { regex: RegExp; keys: string[] },
    eventName: string,
    cleanedEventCache?: Map<string, string>
): Record<string, any> | null {
    // Use cache if provided to avoid repeated normalization
    let cleanName: string;
    if (cleanedEventCache) {
        cleanName = cleanedEventCache.get(eventName) ?? normalizePath(eventName);
        if (!cleanedEventCache.has(eventName)) {
            cleanedEventCache.set(eventName, cleanName);
        }
    } else {
        cleanName = normalizePath(eventName);
    }

    const m = compiled.regex.exec(cleanName);
    if (!m) return null;

    // Pre-allocate object - know the size upfront
    const params: Record<string, any> = {};
    const keysLength = compiled.keys.length;
    for (let i = 0; i < keysLength; i++) {
        params[compiled.keys[i]] = m[i + 1];
    }
    return params;
}

interface Route {
    pattern: string;
    compiled: { regex: RegExp; keys: string[]; segmentCount: number; hasWildcards: boolean };
    handler: ChannelHandler<any, any>;
}

// Create a router per socket
export function createSocketRouter(socket: Socket) {
    // Separate exact matches (no wildcards/params) for O(1) lookup
    const exactRoutes = new Map<string, Route>();
    // Dynamic routes (with params/wildcards) stored in array
    const dynamicRoutes: Route[] = [];

    // Cache for cleaned event names (per socket instance) - reduces repeated normalization
    const cleanedEventCache = new Map<string, string>();

    let attached = false;

    function ensureAttached() {
        if (attached) return;
        attached = true;

        socket.onAny(async (eventName: string, body: any, cb?: Respond<any>) => {
            // Normalize event name once and cache it for potential reuse
            const normalizedEvent = normalizePath(eventName);
            cleanedEventCache.set(eventName, normalizedEvent);

            // Fast path: check exact matches first (O(1) lookup)
            const exactRoute = exactRoutes.get(normalizedEvent) || exactRoutes.get(eventName);

            if (exactRoute) {
                try {
                    await perform(body, cb, exactRoute.handler, eventName, {});
                } catch (error: any) {
                    log.error("Channel Error", eventName, error);
                    if (cb) {
                        const e = extractRequestError(error);
                        if (e) {
                            cb(e);
                        } else {
                            cb(createRequestError(500, [{ ...UNKNOWN_ERROR_TEMPLATE, data: error }]));
                        }
                    }
                }
                return;
            }

            // Dynamic route matching - only iterate through routes that could match
            // The cleanedEventCache is already populated, so matchPattern will reuse it
            const routeCount = dynamicRoutes.length;
            for (let i = 0; i < routeCount; i++) {
                const r = dynamicRoutes[i];
                const params = matchPattern(r.compiled, eventName, cleanedEventCache);
                if (params !== null) {
                    try {
                        await perform(body, cb, r.handler, eventName, params);
                    } catch (error: any) {
                        log.error("Channel Error", eventName, error);
                        if (cb) {
                            const e = extractRequestError(error);
                            if (e) {
                                cb(e);
                            } else {
                                cb(createRequestError(500, [{ ...UNKNOWN_ERROR_TEMPLATE, data: error }]));
                            }
                        }
                    }
                    return;
                }
            }

            if (cb) {
                console.log(eventName)
                cb(
                    createRequestError(404, [
                        {
                            error: "event not found",
                            data: {
                                event: eventName,
                            }
                        },
                    ])
                );
            }
        });
    }

    return {
        on(pattern: string, handler: ChannelHandler<any, any>) {
            const compiled = compilePattern(pattern);
            const route: Route = { pattern, compiled, handler };

            // Separate exact matches from dynamic routes for faster lookup
            if (!compiled.hasWildcards) {
                const normalizedPattern = normalizePath(pattern);
                exactRoutes.set(normalizedPattern, route);
                // Also store original pattern if it differs (handles both '/path' and 'path')
                if (normalizedPattern !== pattern) {
                    exactRoutes.set(pattern, route);
                }
            } else {
                dynamicRoutes.push(route);
            }

            return this;
        },
        ensureAttached,
    };
}
