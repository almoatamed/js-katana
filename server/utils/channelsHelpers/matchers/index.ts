import { routerConfig } from "../../../config/routing/index.js";

export const directoryAliasSuffixRegx = RegExp(routerConfig.getDirectoryAliasSuffixRegx() || "\\.directoryAlias\\.js$");
export const channelsSuffixRegx = RegExp(routerConfig.getChannelSuffixRegx() || "\\.channel\\.js$");
export const descriptionSuffixRegx = RegExp(routerConfig.getDescriptionSuffixRegx() || "\\.description\\.[a-zA-Z]{1,10}$");
export const middlewareSuffixRegx = RegExp(routerConfig.getMiddlewareSuffixRegx() || "\\.middleware\\.(?:js|ts)$");
