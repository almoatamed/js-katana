/**
 * SegmentTrieRouter
 *  - `add(pattern, route)` registers a route pattern (static segments, `:param`,
 *    and a trailing `*wildcard`).
 *  - `match(path)` returns `{ route, params }` or `null` in O(segments) time with
 *    no regular expressions.
 *
 * Matching priority: static segment > param segment > wildcard.
 * Patterns with optional segments (`:name?`) are not supported here on purpose;
 * callers fall back to `RouteMatcher` for those.
 */

type TrieNode = {
    staticChildren: Map<string, TrieNode>;
    paramChild: TrieNode | null;
    paramName: string | null;
    wildcardChild: TrieNode | null;
    wildcardName: string | null;
    route: unknown;
};

const createNode = (): TrieNode => ({
    staticChildren: new Map(),
    paramChild: null,
    paramName: null,
    wildcardChild: null,
    wildcardName: null,
    route: undefined,
});

const decodeSegment = (s: string): string => {
    try {
        return decodeURIComponent(s.replace(/\+/g, " "));
    } catch {
        return s;
    }
};

export type TrieMatchOptions = {
    /** Decode percent-encoding (+ for space) on captured segments. Default: true */
    decode?: boolean;
    /** How to expose a `*` wildcard capture. Default: "array" (per-segment). */
    wildcardAs?: "array" | "joined";
};

export class SegmentTrieRouter<T = unknown> {
    private root: TrieNode = createNode();
    private routeCount = 0;

    get size(): number {
        return this.routeCount;
    }

    add(pattern: string, route: T): void {
        const segments = pattern.split("/");
        let node = this.root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];

            if (segment.startsWith("*")) {
                if (i !== segments.length - 1) {
                    throw new Error("wildcard segment must be the last segment of a pattern");
                }
                if (!node.wildcardChild) {
                    node.wildcardChild = createNode();
                    // a bare `*` token keeps the "*" param name (socket.io convention)
                    node.wildcardName = segment === "*" ? "*" : segment.slice(1);
                }
                node = node.wildcardChild;
                break;
            }

            if (segment.startsWith(":")) {
                if (!node.paramChild) {
                    node.paramChild = createNode();
                    node.paramName = segment.slice(1);
                }
                node = node.paramChild;
            } else {
                let child = node.staticChildren.get(segment);
                if (!child) {
                    child = createNode();
                    node.staticChildren.set(segment, child);
                }
                node = child;
            }
        }

        if (node.route === undefined) {
            this.routeCount++;
        }
        node.route = route;
    }

    match(path: string, options: TrieMatchOptions = {}): { route: T; params: Record<string, any> } | null {
        if (!path) return null;
        const decode = options.decode !== false;
        const joined = options.wildcardAs === "joined";
        const segments = path.split("/");
        const params: Record<string, any> = {};
        return matchRecursive(this.root, segments, 0, params, decode, joined) as {
            route: T;
            params: Record<string, any>;
        } | null;
    }
}

function matchRecursive(
    node: TrieNode,
    segments: string[],
    index: number,
    params: Record<string, any>,
    decode: boolean,
    joined: boolean
): { route: unknown; params: Record<string, any> } | null {
    const segment = index < segments.length ? segments[index] : null;

    if (segment !== null) {
        // 1. static child takes priority over params
        const staticChild = node.staticChildren.get(segment);
        if (staticChild) {
            const result = matchRecursive(staticChild, segments, index + 1, params, decode, joined);
            if (result) return result;
        }

        // 2. param child (single segment)
        if (node.paramChild) {
            const name = node.paramName!;
            const saved = params[name];
            params[name] = decode ? decodeSegment(segment) : segment;
            const result = matchRecursive(node.paramChild, segments, index + 1, params, decode, joined);
            if (result) return result;
            if (saved === undefined) {
                delete params[name];
            } else {
                params[name] = saved;
            }
        }
    }

    // 3. wildcard child consumes the rest of the path (possibly empty)
    if (node.wildcardChild) {
        const name = node.wildcardName!;
        const rest = segment === null ? [] : segments.slice(index);
        if (joined) {
            params[name] = rest.length ? rest.join("/") : "";
        } else {
            params[name] = rest.length ? (decode ? rest.map(decodeSegment) : rest.slice()) : [];
        }
        const result = matchRecursive(node.wildcardChild, segments, segments.length, params, decode, joined);
        if (result) return result;
        delete params[name];
    }

    // 4. terminal route
    if (segment === null && node.route !== undefined) {
        return { route: node.route, params };
    }

    return null;
}
