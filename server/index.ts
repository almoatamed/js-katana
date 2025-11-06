import { runSingle } from "./utils/loadConfig/index.js";

export const RunServer = async () => {
    if (await runSingle()) {
        await import("./utils/main/single.js");
    } else {
        await import("./utils/main/threaded.js");
    }
};
