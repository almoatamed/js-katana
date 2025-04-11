import path from "path";
import url from "url";

const appPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../."));
const srcPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../."));

const rootPaths = {
    srcPath,
    appPath,
};

export default rootPaths;
export { rootPaths };
