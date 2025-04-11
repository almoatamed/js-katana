import rootPaths from "../../utils/dynamicConfiguration/rootPaths.js";
import { LoggingConfig } from "./logginConfigType.js";

export const loggingConfig = {
    hideLogs() {
        return !!rootPaths.srcPath.match(/\/dist\/?$/);
    },
} satisfies LoggingConfig;
