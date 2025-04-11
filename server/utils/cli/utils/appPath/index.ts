import path from "path";
import url from "url";
/**
 * @type {String}
 */
const appPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../../../."));
export { appPath };
