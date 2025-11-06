process.setMaxListeners(30);
const cluster = (await import("cluster")).default;
const os = (await import("os")).default;

import { createLogger, forceLog } from "kt-logger";
import { createApp } from "./app.js";
import { getHeadersTimeout, getKeepAliveTimeout, getMaxForks, getPort } from "../loadConfig/index.js";
import { sleep } from "kt-common";

const log = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "MAIN_SERVER",
    worker: true,
});

let startWorking = false;

if (cluster.isPrimary) {
    cluster.setupPrimary({
        serialization: "advanced",
    });

    const numberOfCpus = os.cpus().length;
    const mem = os.totalmem() / 2 ** 30 - 2;

    log("initiation of primary thread");
    for (let i = 0; i < Math.min(numberOfCpus, Math.floor(mem / 0.5), await getMaxForks()); i++) {
        const worker = cluster.fork();
        worker.setMaxListeners(30);
        const listener = () => {
            if (startWorking) {
                worker.send("go ahead");
                worker.removeListener("message", listener);
            }
            worker.send("no wait");
        };
        worker.on("message", listener);
    }
    cluster.on("exit", (worker, code, signal) => {
        log.error(`A worker Died`, `Worker PID ${worker.process.pid}`, `exit code: ${code}`, `signal: ${signal}`);
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
    const listener = (msg) => {
        if (msg == "start" || msg == "go ahead") {
            startWorking = true;
        }
    };
    process.on("message", listener);

    const start = async () => {
        process.removeListener("message", listener);

        log("started", process.pid);
        const { makeServer } = await createApp(true);

        const port = await getPort();
        const server = (await makeServer()).listen(port);

        forceLog("Started server on port", port, " PID", process.pid);

        server.keepAliveTimeout = await getKeepAliveTimeout();
        server.headersTimeout = await getHeadersTimeout();
    };

    const waitForMaster = async () => {
        while (!startWorking) {
            process.send?.("what now");
            await sleep(1e2);
        }
    };

    log("Stared A Fork On PID:", process.pid);

    await waitForMaster();
    await start();
} else {
    log("Attempting to run startups");
    const { app, makeServer } = await createApp(true);
    const startup = (await import("../startup/index.js")).default;
    await startup(app);

    await makeServer();

    startWorking = true;

    for (const worker of Object.values(cluster.workers || {})) {
        worker?.send("start");
    }
}
