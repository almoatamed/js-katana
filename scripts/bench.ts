import { spawn } from "child_process";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import path from "path";

const PORT = Number(process.env.PORT || 3001);
const BASE_URL = `http://localhost:${PORT}`;
const TOTAL_REQUESTS = Number(process.env.REQUESTS || 100000);
const WORKERS = Number(process.env.BENCH_WORKERS || 4);
const CONCURRENCY = Number(process.env.CONCURRENCY || 50);
const TARGET_PATH = process.env.TARGET_PATH || "/api/";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 20000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(BASE_URL + "/api/");
            if (res.ok) return;
        } catch {
            // not up yet
        }
        await sleep(100);
    }
    throw new Error("server did not start in time");
}

function loadInWorker(workerIndex: number, requests: number): Promise<{ elapsedMs: number; errors: number }> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(fileURLToPath(new URL("./benchClient.ts", import.meta.url)), {
            workerData: {
                baseUrl: BASE_URL,
                path: TARGET_PATH,
                requests,
                concurrency: CONCURRENCY,
            },
        });
        worker.once("message", resolve);
        worker.once("error", reject);
        worker.once("exit", (code) => {
            if (code !== 0) reject(new Error(`worker ${workerIndex} exited with code ${code}`));
        });
    });
}

async function runLoad(): Promise<number> {
    // warmup
    await Promise.all(Array.from({ length: 50 }, () => fetch(BASE_URL + TARGET_PATH).then((r) => r.text())));
    await sleep(2000);

    const perWorker = Math.ceil(TOTAL_REQUESTS / WORKERS);
    const started = performance.now();
    const results = await Promise.all(Array.from({ length: WORKERS }, (_, i) => loadInWorker(i, perWorker)));
    const elapsedMs = performance.now() - started;
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    const reqsPerSec = Math.round((TOTAL_REQUESTS / elapsedMs) * 1000);
    console.log(
        JSON.stringify({
            path: TARGET_PATH,
            totalRequests: TOTAL_REQUESTS,
            workers: WORKERS,
            concurrencyPerWorker: CONCURRENCY,
            elapsedMs: Math.round(elapsedMs),
            reqsPerSec,
            errors: totalErrors,
        })
    );
    return reqsPerSec;
}

async function main() {
    const useBun = process.env.USE_BUN !== "0";
    const serverCpus = process.env.SERVER_CPUS;
    const serverCmd = serverCpus ? ["taskset", "-c", serverCpus, useBun ? "bun" : "node"] : [useBun ? "bun" : "node"];
    const server = spawn(serverCmd[0], [...serverCmd.slice(1), "run.ts"], {
        cwd: new URL("../benchmark", import.meta.url).pathname,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PORT: String(PORT) },
    });

    let stdout = "";
    let stderr = "";
    server.stdout.on("data", (d) => (stdout += d.toString()));
    server.stderr.on("data", (d) => (stderr += d.toString()));

    try {
        await waitForServer();
        console.log(`[bench] server up (${useBun ? "bun" : "node"})`);
        await runLoad();
    } catch (e) {
        console.error("[bench] failed:", e);
        console.error("--- stdout ---\n", stdout.slice(-3000));
        console.error("--- stderr ---\n", stderr.slice(-3000));
        process.exitCode = 1;
    } finally {
        server.kill("SIGTERM");
        await sleep(500);
        server.kill("SIGKILL");
    }
}

await main();
