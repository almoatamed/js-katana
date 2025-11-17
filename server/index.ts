import { runSingle } from "./utils/loadConfig/index.js";
import { maybeSignalTypeProcessor } from "./utils/typesScanner/signal.js";

export const runServer = async () => {
    if (await runSingle()) {
        await import("./utils/main/single.js");
    } else {
        await import("./utils/main/threaded.js");
    }
    maybeSignalTypeProcessor();

};
export {
    createFormDataHandler, 
    MultipartParser
} from "./utils/multipartProcessor/index.js";
export * from "./utils/router/index.js";
export * from "./utils/channelsBuilder/index.js";
export * from "./utils/main/app.js";
export * from "./utils/main/errorHandler.js";
export * from "./utils/main/requestLogger.js";
export * from "./utils/loadConfig/index.js";
export * from "./utils/typesScanner/index.js";
export * from "./utils/renderDescriptionFile/index.js";
export * from "./utils/renderDescriptionFile/processMdToHtml.js";
export * from "./utils/mainRouterBuilder/index.js";
export * from "./utils/channelsBuilder/sucketRouter/index.js";

export {
    describeEvent,
    eventsDescriptionMap,
    type EventDescriptionProps,
} from "./utils/channelsHelpers/describe/emitter/index.js";
export {
    describeChannel,
    type ChannelDescriptionProps,
    channelsDescriptionsMap,
} from "./utils/channelsHelpers/describe/listener/index.js";
export { type RouteDescriptionProps, describeRoute, routesDescriptionMap } from "./utils/routersHelpers/describe/index.js";
export * from "./utils/routersHelpers/matchers.js";
export * from "./utils/routersHelpers/expressRouteManipulation/index.js";
export * from "./utils/startup/index.js";
