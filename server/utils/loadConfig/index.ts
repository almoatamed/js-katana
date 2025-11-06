import { CorsOptions, CorsOptionsDelegate, CorsRequest } from "cors";
import findRoot from "find-root-kt";
import { getConfigPath } from "locate-config-kt";
import path from "path";
import os from "os";
import { Handler } from "express";
import type { Redis } from "ioredis";

export type RoutingConfig = {
    /**
     * Default is true
     */
    runSingle?: (() => boolean) | boolean;
    getRedisClient?: () => Redis;
    getMaxForks?: () => number;
    getStartupDirPath?: () => string;
    getDirectoryAliasSuffixRegx?: () => string;
    getMiddlewareSuffixRegx?: () => string;
    getDescriptionSuffixRegx?: () => string;
    getSocketPrefix?: () => string;
    /**
     *
     * the path should be from source directory, weather there is source directory or not
     *
     * for example:
     * - if there is a source directory `my-src/` and the routes directory is in there under the name `my-routes` you should return `my-routes`
     * - if there is no source directory you should also return `my-routes`
     *
     */
    getRouterDirectory?: () => string;
    getPort?: () => number;
    getApiPrefix?: () => string;
    getRouteSuffix?: () => string;
    getDescriptionPreExtensionSuffix?: () => string;
    getRouterSuffixRegx?: () => string;
    getSourceDir?: () => string;
    getMaxJSONSize?: () => string | number;
    getDirectoryAliasSuffix?: () => string;
    getKeepAliveTimeout?: () => number;
    getHeadersTimeout?: () => number;
    getStaticDirs?: () => {
        local: string;
        remote: string;
        middleware?: Handler;
    }[];
    getCorsOptions?: <T extends CorsRequest = CorsRequest>() => CorsOptions | CorsOptionsDelegate<T>;
};

export async function getMaxForks() {
    return (await loadConfig()).getMaxForks?.() || 6;
}

export async function gerRedisClient() {
    const config = await loadConfig();
    return config.getRedisClient?.();
}

export async function getSocketPrefix() {
    const config = await loadConfig();
    return config.getSocketPrefix?.() ?? "channel";
}

export async function getHeadersTimeout() {
    const config = await loadConfig();
    return config.getHeadersTimeout?.() || 120000;
}

export async function getKeepAliveTimeout() {
    const config = await loadConfig();
    return config.getKeepAliveTimeout?.() || 110000;
}

export async function getPort() {
    const config = await loadConfig();
    return config.getPort?.() ?? 3000;
}

export async function getMaxJsonSize() {
    const config = await loadConfig();
    return config.getMaxJSONSize?.() || "10mb";
}

export async function getRouterDirectory() {
    const config = await loadConfig();
    const pathFromSource = (await config.getRouterDirectory?.()) || "routes";
    const srcPath = await getSourceDir();
    return path.join(srcPath, pathFromSource);
}

export async function getCorsOptions() {
    return (await loadConfig()).getCorsOptions?.();
}

export async function getApiPrefix() {
    return (await loadConfig()).getApiPrefix?.() ?? "/api";
}

export async function getStaticDirs() {
    return (await loadConfig()).getStaticDirs?.() || [];
}

export async function runSingle() {
    let result: boolean;

    const numberOfCpus = os.cpus().length;
    const mem = os.totalmem() / 2 ** 30 - 2;

    const config = await loadConfig();
    if (typeof config.runSingle == "function") {
        result = config.runSingle();
    }
    if (typeof config.runSingle == "boolean") {
        result = config.runSingle;
    }
    result = true;
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
    if (config.getSourceDir === undefined) {
        return path.join(await findRoot(), "./src");
    }
    return path.join(await findRoot(), config.getSourceDir());
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
