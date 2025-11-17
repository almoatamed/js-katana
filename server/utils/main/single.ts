import { createLogger } from "kt-logger";
import { createApp } from "./app.js";

const log = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "SERVER",
    worker: true,
});

const startup = (await import("../startup/index.js")).default;

log("finished importing");

const { startServer } = await createApp();

log("Attempting to run startups");
await startup();
log("Finished running startups");

await startServer();
