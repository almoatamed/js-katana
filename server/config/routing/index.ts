import { RoutingConfig } from "./routingConfigType.js";

export const routerConfig = {
    getSocketPrefix() {
        return "/server/channelling";
    },
    getChannelsDirectory() {
        return "/channels";
    },
    getApiPrefix() {
        return "/server/api";
    },
    getChannelSuffix() {
        return ".channel.ts";
    },
    embedModifiedVersionOfModulesInRequest() {
        return false;
    },
    getStaticDirs: () => {
        return [
            {
                local: "public",
                remote: "/server/files",
            },
            {
                local: "assets",
                remote: "/server/assets",
            },
            {
                local: "templates",
                remote: "/server/templates",
            },
            {
                local: "static/privateFiles",
                remote: "/server/private-files",
                middleware: "middlewares/staticResources/privateFiles.js",
            },
        ];
    },
    getChannelSuffixRegx() {
        return "\\.channel\\.(?:js|ts)$";
    },
    getDescriptionSuffixRegx() {
        return "\\.description\\.[a-zA-Z]{1,10}$";
    },
    getDirectoryAliasSuffixRegx() {
        return "\\.directoryAlias\\.js$";
    },
    getDirectoryAliasSuffix() {
        return ".directoryAlias.js";
    },
    getKeepAliveTimeout() {
        return 110000;
    },
    getHeadersTimeout() {
        return 120000;
    },
    getMiddlewareSuffixRegx() {
        return "\\.middleware\\.(?:js|ts)$";
    },
    getRouterSuffixRegx() {
        return "\\.router\\.(?:js|ts)$";
    },
    getRouteSuffix() {
        return ".router.ts";
    },
    getEmptyRoutePath() {
        return "/routers/emptyRoute.ts";
    },
    getDescriptionPreExtensionSuffix() {
        return ".description";
    },
    getRouterDirectory() {
        return "/routers";
    },
} satisfies RoutingConfig;
