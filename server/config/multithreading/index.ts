import { getFromEnv } from "../dotEnv.js";
import { MultithreadingConfig } from "./multithreadingConfig.js";

export const multithreadingConfig = {
    getMaxForks() {
        return 6;
    },
    runSingle() {
        return !["yes", "y", "1", "true"].includes(String(getFromEnv("MULTITHREADED") || "no").toLowerCase());
    },
    workerJobs() {
        return !this.runSingle();
    },
    workerRenderEngine() {
        return false;
    },
} satisfies MultithreadingConfig;
