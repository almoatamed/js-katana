await import("./utils/dynamicConfiguration/load.js");
import os from "os";
import { multithreadingConfig } from "./config/multithreading/index.js";

const numberOfCpus = os.cpus().length;
const mem = os.totalmem() / 2 ** 30 - 2;

if (multithreadingConfig.runSingle() || numberOfCpus == 1 || Math.floor(mem / 0.5) <= 1) {
    await import("./utils/main/single.js");
} else {
    await import("./utils/main/threaded.js");
}
