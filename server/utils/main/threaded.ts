// express engine
process.setMaxListeners(30);
const logUtil = await import("../log/index.js");
const cluster = (await import("cluster")).default;
const os = (await import("os")).default;
const forceLog = logUtil.forceLog;
import cmn from "$/server/utils/common/index.js";
import { hostingConfig } from "../../config/hosting/index.js";
import { multithreadingConfig } from "../../config/multithreading/index.js";
import { routerConfig } from "../../config/routing/index.js";
import { createApp } from "./app.js";

const llog = await logUtil.localLogDecorator("MAIN_SERVER", "red", true, "Info", false);
const workerLlog = await logUtil.localLogDecorator("MAIN_SERVER", "red", true, "Info", true);

// create app flag
let startWorking = false;

if (cluster.isPrimary) {
    cluster.setupPrimary({
        serialization: "advanced",
    });

    const numberOfCpus = os.cpus().length;
    const mem = os.totalmem() / 2 ** 30 - 2;

    llog("initiation of primary thread");
    for (let i = 0; i < Math.min(numberOfCpus, Math.floor(mem / 0.5), multithreadingConfig.getMaxForks() || 6); i++) {
        const worker = cluster.fork();
        worker.setMaxListeners(30);
        worker.on("message", () => {
            worker.send(startWorking ? "go ahead" : "no wait");
        });
    }
    cluster.on("exit", (worker, code, signal) => {
        llog.error(`A worker Died`, `Worker PID ${worker.process.pid}`, `exit code: ${code}`, `signal: ${signal}`);
        cluster.fork();
    });

    const kill = () => {
        for (const worker of Object.values(cluster.workers || {})) {
            worker?.kill();
        }
        process.exit();
    };
    process.on("sigint", kill);
    process.on("exit", kill);
}

if (!cluster.isPrimary) {
    const start = async () => {
        workerLlog("started", process.pid);
        const { makeServer } = await createApp(true);

        const port = hostingConfig.getPort();
        const server = (await makeServer()).listen(port);

        forceLog("Started server on port", port, " PID", process.pid);

        server.keepAliveTimeout = routerConfig.getKeepAliveTimeout();
        server.headersTimeout = routerConfig.getHeadersTimeout();
    };
    process.on("message", (msg) => {
        if (msg == "start" || msg == "go ahead") {
            startWorking = true;
        }
    });

    const waitForMaster = async () => {
        while (true) {
            if (startWorking) {
                break;
            }
            await cmn.sleep(1e3);
            process.send?.("what now");
        }
    };

    workerLlog("Stared A Fork On PID:", process.pid);

    await waitForMaster();
    await start();
} else {
    llog("Attempting to run startups");
    const { app, makeServer } = await createApp(true);
    const startup = (await import("../startup/index.js")).default;
    await startup(app);
    const startJobs = (await import("$/server/utils/jobs/run.js")).run;
    await startJobs();

    await makeServer();

    startWorking = true;

    for (const worker of Object.values(cluster.workers || {})) {
        worker?.send("start");
    }
}
