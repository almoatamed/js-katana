import path from "path";
import url from "url";

const srcPath: string = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../../."));
export { srcPath };
