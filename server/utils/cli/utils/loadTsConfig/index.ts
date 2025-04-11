import path from "path";
import { appPath } from "../appPath/index.js";
import { loadJson } from "../loadJson/index.js";
/**
 *
 * @returns {import("$/tsconfig.json")}
 */
const loadTsConfig = () => {
    // loading ts config
    const tsConfigPath = path.join(appPath, "tsconfig.json");
    return loadJson(tsConfigPath);
};

export { loadTsConfig };
