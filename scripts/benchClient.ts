import { parentPort, workerData } from "worker_threads";

const { baseUrl, path, requests, concurrency } = workerData;

async function run() {
    await Promise.all(Array.from({ length: 10 }, () => fetch(baseUrl + path).then((r) => r.arrayBuffer())));
    const started = performance.now();
    let done = 0;
    let errors = 0;

    async function worker() {
        while (done < requests) {
            try {
                await fetch(baseUrl + path);
            } catch {
                errors++;
            }
            done++;
        }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const elapsedMs = performance.now() - started;
    parentPort!.postMessage({ elapsedMs, errors });
}

run();
