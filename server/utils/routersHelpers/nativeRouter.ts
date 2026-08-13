import { createRequire } from "module";
import path from "path";
import { createLogger } from "kt-logger";

const log = await createLogger({
    worker: true,
    color: "magenta",
    logLevel: "Info",
    name: "Native-Router",
});

/**
 * Loads the opt-in native (napi-rs) segment-trie router.
 *
 * The module is searched for in, in order:
 *  1. a user-provided path via `JS_KT_NATIVE_PATH`
 *  2. the packaged module shipped with js-kt (`dist/native/`)
 *  3. the development build output (`native/target/release/`)
 *
 * Returns `null` (and never throws) when the module is not available, so the
 * framework can transparently fall back to the JS router.
 */
export type NativeRouterModule = {
    NativeRouter: {
        new (): {
            add(pattern: string, routeId: number): void;
            matchRoute(path: string): {
                found: boolean;
                routeId: number;
                params: Record<string, string>;
                wildcards: Record<string, string[]>;
            };
        };
    };
};

let cached: NativeRouterModule | null | undefined = undefined;

export const getNativeRouter = (): NativeRouterModule | null => {
    if (cached !== undefined) {
        return cached;
    }
    cached = null;

    const platform = process.platform;
    const arch = process.arch;
    const libExtension = platform === "darwin" ? "dylib" : platform === "win32" ? "dll" : "so";
    const fileName = `js-kt-native.${platform}-${arch}.node`;

    const candidates: string[] = [];
    if (process.env.JS_KT_NATIVE_PATH) {
        candidates.push(process.env.JS_KT_NATIVE_PATH);
    }
    // packaged: <pkg>/dist/native/js-kt-native.<platform>-<arch>.node
    candidates.push(path.join(import.meta.dirname, "../../native", fileName));
    // development: <repo>/native/target/release/libjs_kt_native_router.so
    candidates.push(
        path.join(
            import.meta.dirname,
            "../../../../..",
            "native",
            "target",
            "release",
            `libjs_kt_native_router.${libExtension}`
        )
    );

    const require = createRequire(import.meta.url);
    for (const candidate of candidates) {
        try {
            const loaded = require(candidate) as NativeRouterModule;
            if (typeof loaded?.NativeRouter === "function") {
                cached = loaded;
                return cached;
            }
        } catch {
            // try the next candidate
        }
    }

    return null;
};

export const isNativeRouterAvailable = (): boolean => {
    return getNativeRouter() !== null;
};

export { log };
