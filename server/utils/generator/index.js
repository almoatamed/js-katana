const build = (await import("$/server/utils/utilityBuilder/index.js")).default;
import { dirname } from "path";
import { fileURLToPath } from "url";

const _Dirname = dirname(fileURLToPath(import.meta.url));
export default await build(_Dirname, ".generator.js");
