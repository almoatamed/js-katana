import { loadConfig } from "../loadConfig/index.js";

const routerConfig = await loadConfig();

export const directoryAliasSuffixRegx = RegExp(
    routerConfig.getDirectoryAliasSuffixRegx?.() || "\\.directoryAlias\\.(?:js|ts)$"
);

export const routerSuffixRegx = RegExp(routerConfig.getRouterSuffixRegx?.() || "\\.router\\.(?:js|ts)$");
export const descriptionSuffixRegx = RegExp(routerConfig.getDescriptionSuffixRegx?.() || "\\.description\\.[a-zA-Z]{1,10}$");
export const middlewareSuffixRegx = RegExp(routerConfig.getMiddlewareSuffixRegx?.() || "\\.middleware\\.(?:js|ts)$");
