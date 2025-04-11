export type RoutingConfig = {
    embedModifiedVersionOfModulesInRequest: () => boolean;
    getDirectoryAliasSuffixRegx: () => string;
    getChannelSuffixRegx: () => string;
    getMiddlewareSuffixRegx: () => string;
    getDescriptionSuffixRegx: () => string;
    getSocketPrefix: () => string;
    getChannelsDirectory: () => string;
    getChannelSuffix: () => string;
    getRouterDirectory: () => string;
    getApiPrefix: () => string;
    getRouteSuffix: () => string;
    getDescriptionPreExtensionSuffix: () => string;
    getEmptyRoutePath: () => string;
    getRouterSuffixRegx: () => string;
    getDirectoryAliasSuffix: () => string;
    getKeepAliveTimeout: () => number;
    getHeadersTimeout: () => number;
    getStaticDirs: () => {
        local: string;
        remote: string;
        middleware?: string;
    }[];
};
