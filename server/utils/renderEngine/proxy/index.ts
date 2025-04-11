import { Worker } from "worker_threads";
import rootPaths from "../../dynamicConfiguration/rootPaths.js";

const renderWorker = new Worker(`${rootPaths.srcPath}/utils/renderEngine/proxy/worker.js`);

function render(
    skeleton: import("../index.js").DocumentSkeleton,
): Promise<import("../index.js").RenderedDocumentSkeleton> {
    return new Promise((resolve, reject) => {
        renderWorker.postMessage(skeleton);
        renderWorker.on("message", (result) => {
            if (result?.error) {
                reject(result.error);
            }
            resolve(result);
        });
    });
}
export default render;
