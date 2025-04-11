import cluster from "cluster";
import { multithreadingConfig } from "../../config/multithreading/index.js";

export const run = async () => {
    if (multithreadingConfig.workerJobs()) {
        const URL = (await import("url")).URL;
        cluster.setupPrimary({
            exec: new URL("./index.js", import.meta.url).pathname,
        });
        cluster.fork();
        cluster.setupPrimary({
            exec: new URL("../../index.js", import.meta.url).pathname,
        });
    } else {
        (await import("./index.js")).default;
    }
};
