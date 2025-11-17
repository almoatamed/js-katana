const startTime = Date.now();

import { createLogger } from "kt-logger";
import { createApp } from "./app.js";
import { getHeadersTimeout, getKeepAliveTimeout, getPort } from "../loadConfig/index.js";

const log = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "SERVER",
    worker: true,
});

const startup = (await import("../startup/index.js")).default;

log("finished importing");

const { makeServer } = await createApp();

log("Attempting to run startups");
await startup();
log("Finished running startups");

const port = await getPort();
const server = (await makeServer()).listen(port);

server.keepAliveTimeout = await getKeepAliveTimeout();
server.headersTimeout = await getHeadersTimeout();

log(
    "started server in single thread mode",
    `Port: ${port}`,
    `PID: ${process.pid}`,
    "in",
    Date.now() - startTime,
    "ms",
    "\n",
    "Port:",
    port,
    ", PID:",
    process.pid
);
