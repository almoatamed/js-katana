import { getFromEnv } from "../dotEnv.js";
import { JobsConfig } from "./jobsConfigTypes.js";

export const jobsConfig: JobsConfig = {
    getJobCheckoutIntervalMs() {
        return Number(getFromEnv("JOB_PERIOD_IN_MS")) || 2e3;
    },

    getJobs() {
        return {};
    },
};
