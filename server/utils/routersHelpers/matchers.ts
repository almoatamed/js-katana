import { loadConfig, valueOf } from "../loadConfig/index.js";

const routerConfig = await loadConfig();

export const directoryAliasSuffixRegx = RegExp(
    (await valueOf(routerConfig.getDirectoryAliasSuffixRegx)) || "\\.directoryAlias\\.(?:js|ts)$"
);

export const routerSuffixRegx = RegExp((await valueOf(routerConfig.getRouterSuffixRegx)) || "\\.router\\.(?:js|ts)x?$");
export const descriptionSuffixRegx = RegExp(
    (await valueOf(routerConfig.getDescriptionSuffixRegx)) || "\\.description\\.[a-zA-Z]{1,10}$"
);
export const middlewareSuffixRegx = RegExp(
    (await valueOf(routerConfig.getMiddlewareSuffixRegx)) || "\\.middleware\\.(?:js|ts)$"
);
