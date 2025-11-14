import express from "express";
import cors from "cors";
import { collectRoutesFilesAndDeleteDescriptions, createTypeManager, useContextToProcessTypes } from "./index.js";
import { readFile } from "fs/promises";
import ts from "typescript";
import { getTypeScannerBatchingPeriod } from "../loadConfig/index.js";
import { clearEventsDescriptionMap } from "../channelsHelpers/describe/emitter/index.js";
import { clearChannelsDescriptionMap } from "../channelsHelpers/describe/listener/index.js";
import { clearRoutesDescriptionMap } from "../routersHelpers/describe/index.js";

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let context: {
    checker: ts.TypeChecker;
    host: ts.CompilerHost;
    program: ts.Program;
    sourceFileMap: Map<string, ts.SourceFile>;
} | null = null;

const getTypeManager = async (
    routesFilesMap: {
        [filePath: string]: string;
    },
    fileContents: Map<string, string>
) => {
    if (context) {
        return context;
    }

    context = await createTypeManager(routesFilesMap, fileContents);
    return context;
};

let timeout: null | NodeJS.Timeout | number = null;

const batchCycle = async () => {
    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
        if (running) {
            batchCycle();
            return;
        }
        runProcessorCycle();
    }, await getTypeScannerBatchingPeriod());
};

const fileContents = new Map<string, string>();
const readFiles = async (fileMap: { [fileFullPath: string]: string }) => {
    const filePaths = Object.keys(fileMap);
    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                const content = await readFile(filePath, "utf-8");
                fileContents.set(filePath, content);
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
            }
        })
    );
};

let running = false;
const runProcessorCycle = async () => {
    if (running) {
        return;
    }
    running = true;
    console.log("Running process cycle");
    try {
        console.time("Collecting routes");
        const routesFilesMap = await collectRoutesFilesAndDeleteDescriptions();
        await readFiles(routesFilesMap);
        console.timeEnd("Collecting routes");
        const tsContext = await getTypeManager(routesFilesMap, fileContents);
        clearChannelsDescriptionMap();
        clearRoutesDescriptionMap();
        clearEventsDescriptionMap();
        await useContextToProcessTypes(tsContext, Object.keys(routesFilesMap));
    } catch (error) {
        console.error("type processor cycle error", error);
    } finally {
        running = false;
    }
};

app.get("/process", async (_request, response) => {
    await batchCycle();
    console.log("Received process request");
    response.status(200);
});

app.listen(3751);
