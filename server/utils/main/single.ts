const startTime = Date.now();

import { hostingConfig } from "../../config/hosting/index.js";
import { routerConfig } from "../../config/routing/index.js";
import { forceLog } from "../log/index.js";
import { createApp } from "./app.js";
const logUtil = await import("../log/index.js");
const llog = await logUtil.localLogDecorator("MAIN_SERVER", "red", true, "Info");
const startup = (await import("../startup/index.js")).default;
const startJobs = (await import("$/server/utils/jobs/run.js")).run;
llog("finished importing");

const { app, makeServer } = await createApp();

llog("Attempting to run startups");
await startup(app);
await startJobs();

const port = hostingConfig.getPort();
const server = (await makeServer()).listen(port);
server.keepAliveTimeout = routerConfig.getKeepAliveTimeout();
server.headersTimeout = routerConfig.getHeadersTimeout();
// llog("started the server", `Port: ${port}`, `Worker PID: ${process.pid}`);
forceLog("in", Date.now() - startTime, "ms");
forceLog("Started server on port", port, " PID", process.pid);
export default app;
