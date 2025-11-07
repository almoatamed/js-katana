import { CorsOptions, CorsOptionsDelegate, CorsRequest } from "cors";
import findRoot from "find-root-kt";
import { getConfigPath } from "locate-config-kt";
import path from "path";
import os from "os";
import { Handler } from "express";
import type { Redis } from "ioredis";

type MaybePromise<T> = (() => Promise<T> | T) | T;

export type RoutingConfig = {
    /**
     * Default is true
     */
    runSingle?: MaybePromise<boolean>;
    isDev?: MaybePromise<boolean>;
    getRedisClient?: MaybePromise<Redis>;
    getMaxForks?: MaybePromise<number>;
    getTypesPlacementDir?: MaybePromise<string>;
    getStartupDirPath?: MaybePromise<string>;
    getDirectoryAliasSuffixRegx?: MaybePromise<string>;
    getMiddlewareSuffixRegx?: MaybePromise<string>;
    getDescriptionSuffixRegx?: MaybePromise<string>;
    getSocketPrefix?: MaybePromise<string>;
    /**
     *
     * the path should be from source directory, weather there is source directory or not
     *
     * for example:
     * - if there is a source directory `my-src/` and the routes directory is in there under the name `my-routes` you should return `my-routes`
     * - if there is no source directory you should also return `my-routes`
     *
     */
    getRouterDirectory?: MaybePromise<string>;
    getPort?: MaybePromise<number>;
    getApiPrefix?: MaybePromise<string>;
    getRouteSuffix?: MaybePromise<string>;
    getDescriptionPreExtensionSuffix?: MaybePromise<string>;
    getRouterSuffixRegx?: MaybePromise<string>;
    getSourceDir?: MaybePromise<string>;
    getMaxJSONSize?: MaybePromise<string | number>;
    getDirectoryAliasSuffix?: MaybePromise<string>;
    getKeepAliveTimeout?: MaybePromise<number>;
    getHeadersTimeout?: MaybePromise<number>;
    getStaticDirs?: MaybePromise<
        {
            local: string;
            remote: string;
            middleware?: Handler;
        }[]
    >;
    getCorsOptions?: <T extends CorsRequest = CorsRequest>() => CorsOptions | CorsOptionsDelegate<T>;
};

export const valueOf = async <T>(v?: MaybePromise<T>): Promise<T | undefined> => {
    if (typeof v === "function") {
        return await (v as Function)();
    }
    return v;
};

export const getTypesPlacementDir = async ()=>{
    const config = await loadConfig(); 
    return path.join(await getSourceDir(), (await valueOf(config.getTypesPlacementDir)) || "types");
}

export const getRouteSuffix = async () => {
    const config = await loadConfig();
    return (await valueOf(config.getRouteSuffix)) || ".router.ts";
}

export const getDescriptionPreExtensionSuffix = async () => {
    const config = await loadConfig();
    return (await valueOf(config.getDescriptionPreExtensionSuffix)) || ".description";
}

export const isDev = async () => {
    const config = await loadConfig();
    return (
        (await valueOf(config.isDev)) ??
        (String(process.env.NODE_ENV).toLowerCase() == "dev" || String(process.env.ENV).toLowerCase() == "dev")
    );
};

export async function getMaxForks() {
    const config = await loadConfig();
    return (await valueOf(config.getMaxForks)) || 6;
}

export async function gerRedisClient() {
    const config = await loadConfig();
    const client = await valueOf(config.getRedisClient);
    return client;
}

export async function getSocketPrefix() {
    const config = await loadConfig();
    return (await valueOf(config.getSocketPrefix)) ?? "channel";
}

export async function getHeadersTimeout() {
    const config = await loadConfig();
    return (await valueOf(config.getHeadersTimeout)) || 120000;
}

export async function getKeepAliveTimeout() {
    const config = await loadConfig();
    return (await valueOf(config.getKeepAliveTimeout)) || 110000;
}

export async function getPort() {
    const config = await loadConfig();
    return (await valueOf(config.getPort)) ?? 3000;
}

export async function getMaxJsonSize() {
    const config = await loadConfig();
    return (await valueOf(config.getMaxJSONSize)) || "10mb";
}

export async function getRouterDirectory() {
    const config = await loadConfig();
    const pathFromSource = (await valueOf(config.getRouterDirectory)) || "routes";
    const srcPath = await getSourceDir();
    return path.join(srcPath, pathFromSource);
}

export async function getCorsOptions() {
    const config = await loadConfig();
    return await valueOf(config.getCorsOptions);
}

export async function getApiPrefix() {
    const config = await loadConfig();
    return (await valueOf(config.getApiPrefix)) ?? "/api";
}

export async function getStaticDirs() {
    return (await valueOf((await loadConfig()).getStaticDirs)) || [];
}

export async function runSingle() {
    let result: boolean;

    const numberOfCpus = os.cpus().length;
    const mem = os.totalmem() / 2 ** 30 - 2;

    const config = await loadConfig();
    result = (await valueOf(config.runSingle)) ?? true;

    const systemResult = numberOfCpus == 1 || Math.floor(mem / 0.5) <= 1;
    if (systemResult && !result) {
        console.warn(
            "Running in single thread mode due to system resources limitations even though config recommends multithread mode"
        );
    }

    return result || systemResult;
}

export const getSourceDir = async () => {
    const config = await loadConfig();
    const configuredSrcPath = await valueOf(config.getSourceDir);

    if (configuredSrcPath === undefined) {
        return path.join(await findRoot(), "./src");
    }

    return path.join(await findRoot(), configuredSrcPath);
};

export const loadConfig = async (): Promise<RoutingConfig> => {
    const defaultConfig: RoutingConfig = {};

    const configPath = await getConfigPath({
        configFileNameWithExtension: "router.kt.config.ts",
    });

    if (configPath) {
        return await import(configPath);
    }
    return defaultConfig;
};
