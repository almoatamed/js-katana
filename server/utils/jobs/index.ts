import * as prisma from "$/prisma/client/index.js";
import { jobsConfig } from "../../config/jobs/index.js";
import { RecursiveReadable } from "../common/index.js";

const logUtil = await import("$/server/utils/log/index.js");
const log = await logUtil.localLogDecorator("JOB", "green", true, "Info", true);

const client = (await import("../../utils/database/prisma.js")).default;
const cronParser = (await import("cron-parser")).default;

type Job = prisma.Prisma.JobGetPayload<{}>;

async function insertJob(
    job: {
        cronSchedule: string | null;
        handler: string;
        handlerType: prisma.$Enums.JobHandlerType;
        argumentJson?: RecursiveReadable[];
    },
    request?: import("$/server/utils/express/index.js").Req,
): Promise<void> {
    const cron = cronParser.parseExpression(job.cronSchedule || "");
    const nextDate = cron.next().toDate();

    await client.job.create({
        data: {
            createdAt: new Date(),
            createdByUser: !request?.user?.userId
                ? undefined
                : {
                      connect: {
                          userId: request?.user?.userId,
                      },
                  },
            createdByUserUsername: request?.user?.fullName,
            createdByUserFullName: request?.user?.username,
            updatedAt: new Date(),
            updatedByUser: !request?.user?.userId
                ? undefined
                : {
                      connect: {
                          userId: request?.user?.userId,
                      },
                  },
            updatedByUserFullName: request?.user?.fullName,
            updatedByUserUsername: request?.user?.username,

            deleted: false,

            designatedDate: nextDate,
            handler: job.handler,
            argumentJson: Buffer.from(JSON.stringify(job.argumentJson || [])).toString("base64"),
            title: job.handler,
            status: "PENDING",
            cronSchedule: job.cronSchedule,
            handlerType: job.handlerType,
        },
    });
    return;
}

async function scheduleNext(job) {
    if (job.repeatCount == -1) {
        await insertJob(job);
    } else if (job.repeatCount > 1) {
        job.repeatCount = Math.floor(job.repeatCount) - 1;
        await insertJob(job);
    }
}

async function runner(job: Job) {
    try {
        log("Running Job", job.jobId, job.title);
        !!job.cronSchedule && (await scheduleNext(job));
        await client.job.update({
            where: {
                jobId: job.jobId,
            },
            data: {
                status: "DONE",
            },
        });
        try {
            let output = "";
            if (job.handlerType == "FUNCTION_STRING") {
                const handler = eval(job.handler);
                const args = JSON.parse(Buffer.from(job.argumentJson || "", "base64").toString("utf-8"));
                output = await handler(...args);
            } else {
                const handler = jobsConfig.getJobs()[job.handler].handler;
                if (!handler) {
                    throw {
                        msg: "Handler not found",
                        handler: job.handler,
                        title: job.title,
                        schedule: job.cronSchedule,
                    };
                }
                const args = !job.argumentJson
                    ? []
                    : JSON.parse(Buffer.from(job.argumentJson, "base64").toString("utf-8"));

                output = await handler(...args);
            }
            await client.job.update({
                where: {
                    jobId: job.jobId,
                },
                data: {
                    output: Buffer.from(JSON.stringify(output || {})).toString("base64"),
                },
            });
        } catch (error) {
            console.log(error);
            log(error);
            await client.job.update({
                where: {
                    jobId: job.jobId,
                },
                data: {
                    status: "FAILED",
                    output: Buffer.from(JSON.stringify(error || {})).toString("base64"),
                },
            });
        }
    } catch (error) {
        console.log(error);
        log(error);
    }
}

async function maintain() {
    for (const job of Object.values(jobsConfig.getJobs())) {
        if (job.getRepeatCount() != -1) {
            continue;
        }

        const scheduledJob = await client.job.findFirst({
            where: {
                designatedDate: {
                    gt: new Date(),
                },
                title: job.getJobName(),
            },
        });
        if (!scheduledJob) {
            await insertJob({
                cronSchedule: job.getCronSchedule(),
                handler: job.getJobName(),
                handlerType: "HANDLER_NAME",
                argumentJson: [],
            });
        }
    }
}

async function loop() {
    try {
        log("running jobs");
        const jobs = await client.job.findMany({
            where: {
                status: "PENDING",
                deleted: false,
                designatedDate: {
                    lte: new Date(),
                },
            },
        });

        for (const job of jobs) {
            await runner(job);
        }

        await maintain();
    } catch (error) {
        console.log(error);
        log(error);
    }
    setTimeout(loop, jobsConfig.getJobCheckoutIntervalMs());
}

loop();

export default {};
