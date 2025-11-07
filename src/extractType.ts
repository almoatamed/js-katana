import path from "path";
import { processRoutesForTypes } from "../server/utils/mainRouterBuilder";

await processRoutesForTypes({
    [path.join(import.meta.dirname, "./routes/index.router.ts")]: "/",
});
