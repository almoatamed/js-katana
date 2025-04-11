export type MultithreadingConfig = {
    getMaxForks: () => number;
    runSingle: () => boolean;
    workerJobs: () => boolean;
    workerRenderEngine: () => boolean;
};
