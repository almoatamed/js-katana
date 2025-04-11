export type Job = {
    handler: (...args: any) => any;
    getCronSchedule(): string;
    getRepeatCount(): number;
    getJobName: () => string;
};

export type JobsConfig = {
    getJobCheckoutIntervalMs(): number;

    /**
     *
     * @example
     *   return {
     *       log: {
     *           async handler() {
     *               console.log("hi there");
     *           },
     *           getCronSchedule() {
     *               return "* /10 * * * * *" // remove the space between * and /10;
     *           },
     *           getRepeatCount() {
     *               return -1;
     *           },
     *           getJobName() {
     *               return "log";
     *           },
     *       },
     *   } satisfies {
     *       [key: string]: Job;
     *   };
     */
    getJobs: () => {
        [key: string]: Job;
    };
};
