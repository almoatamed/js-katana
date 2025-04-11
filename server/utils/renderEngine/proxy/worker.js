import render from "$/server/utils/renderEngine/index.js";
import { parentPort } from "worker_threads";
console.log("about to import the engine");

parentPort?.on("message", async (skeleton) => {
    try {
        const doc = await render(skeleton);
        if (skeleton?.dontRespond) {
            parentPort?.postMessage("Done");
        } else {
            parentPort?.postMessage(doc);
        }
    } catch (error) {
        console.log(error);
        parentPort?.postMessage({ error });
    }
});
console.log("started render engine listener");
