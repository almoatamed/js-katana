import express from "express";
import cors from "cors";
import { collectRoutesFiles, collectRoutesFilesAndDeleteDescriptions, useContextToProcessTypes } from "./index.js";
import { readFile } from "fs/promises";
import ts from "typescript";
import { getDescriptionPreExtensionSuffix, getTypeScannerBatchingPeriod } from "../loadConfig/index.js";
import { removeFilesFromEventsDescriptionMap } from "../channelsHelpers/describe/emitter/index.js";
import { createHash } from "crypto";
import { removeFilesFromChannelsDescriptionMap } from "../channelsHelpers/describe/listener/index.js";
import { removeFilesFromRoutesDescriptionMap } from "../routersHelpers/describe/index.js";
import { routerSuffixRegx } from "../routersHelpers/matchers.js";
import { execSync } from "child_process";
import { createLogger } from "kt-logger";

const log = await createLogger({
    color: "yellow", 
    logLevel: "Info", 
    name: "Type Scanner", 
    worker: false, 
})

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

// Track file state for change detection
let previousFileHashes = new Map<string, string>();
let previousFilePaths = new Set<string>();

// Helper to compute content hash for change detection
const computeFileHash = (content: string): string => {
    return createHash("sha256").update(content).digest("hex");
};

// Check if files have changed by comparing paths and content hashes
const hasFilesChanged = (currentFilePaths: string[], currentFileContents: Map<string, string>): boolean => {
    const currentPathsSet = new Set(currentFilePaths);

    // Check if file set changed (new files added or removed)
    if (currentPathsSet.size !== previousFilePaths.size) {
        return true;
    }

    // Check for new files (in current but not in previous)
    for (const path of currentPathsSet) {
        if (!previousFilePaths.has(path)) {
            return true; // New file added
        }
    }

    // Check for deleted files (in previous but not in current)
    for (const path of previousFilePaths) {
        if (!currentPathsSet.has(path)) {
            return true; // File removed
        }
    }

    // Check if any existing file content changed
    for (const [filePath, content] of currentFileContents.entries()) {
        const currentHash = computeFileHash(content);
        const previousHash = previousFileHashes.get(filePath);

        if (previousHash === undefined || previousHash !== currentHash) {
            return true; // File content changed
        }
    }

    return false;
};

// Update file tracking state
const updateFileTracking = (filePaths: string[], fileContents: Map<string, string>) => {
    previousFilePaths = new Set(filePaths);
    previousFileHashes.clear();

    for (const [filePath, content] of fileContents.entries()) {
        previousFileHashes.set(filePath, computeFileHash(content));
    }
};

const createTypeManager = async (
    routesFilesMap: { [key: string]: string },
    fileContents: Map<string, string>,
    invalidateSourceFiles?: Set<string>
) => {
    // Basic compiler options
    const options = {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
    };

    // Create a CompilerHost with optimized caching
    const host = ts.createCompilerHost(options);

    // Reuse existing sourceFileMap if context exists, otherwise create new
    const sourceFileMap = context?.sourceFileMap || new Map<string, ts.SourceFile>();

    // Clear invalidated source files from cache
    if (invalidateSourceFiles) {
        for (const filePath of invalidateSourceFiles) {
            sourceFileMap.delete(filePath);
        }
    }

    host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions) => {
        // Always get fresh content from fileContents map to ensure we have latest
        const content = fileContents.get(fileName);

        // If we have a cached source file and content hasn't changed, reuse it
        if (sourceFileMap.has(fileName) && !invalidateSourceFiles?.has(fileName)) {
            const cached = sourceFileMap.get(fileName);
            if (cached) {
                // Verify content matches (defensive check)
                const cachedContent = cached.getFullText();
                if (cachedContent === content) {
                    return cached;
                }
            }
        }

        // Create new source file from current content
        const fileContent = content || ts.sys.readFile(fileName) || "";
        const sourceFile = ts.createSourceFile(fileName, fileContent, languageVersion);
        sourceFileMap.set(fileName, sourceFile);
        return sourceFile;
    };

    host.readFile = (fileName) => {
        // Always return latest content from fileContents map
        return fileContents.get(fileName) || ts.sys.readFile(fileName);
    };
    host.fileExists = (fileName) => {
        return fileContents.has(fileName) || ts.sys.fileExists(fileName);
    };

    // Create program - always create fresh to pick up changes
    const program = ts.createProgram(Object.keys(routesFilesMap), options, host);
    const checker = program.getTypeChecker();
    return {
        checker,
        host,
        program,
        sourceFileMap,
    };
};

const getTypeManager = async (
    routesFilesMap: {
        [filePath: string]: string;
    },
    fileContents: Map<string, string>
) => {
    const currentFilePaths = Object.keys(routesFilesMap);
    const filesChanged = hasFilesChanged(currentFilePaths, fileContents);

    if (context && !filesChanged) {
        // No changes detected, reuse existing context
        // But still update source files that might have been modified
        // (This is a defensive measure - the hash check should catch changes)
        return {
            context,
            filesChanged: false,
            filesToInvalidate: new Set<string>(),
            deletedFilesSet: new Set<string>(),
        };
    }

    // Files changed or context doesn't exist - recreate
    log(filesChanged ? "Files changed, recreating type manager" : "Creating initial type manager");

    // Determine which files need invalidation
    const filesToInvalidate = new Set<string>();
    const deletedFilesSet = new Set<string>();
    if (context && filesChanged) {
        // Invalidate all files that changed or are new
        for (const filePath of currentFilePaths) {
            const currentHash = computeFileHash(fileContents.get(filePath) || "");
            const previousHash = previousFileHashes.get(filePath);
            if (!previousHash || previousHash !== currentHash) {
                filesToInvalidate.add(filePath);
            }
        }
        // Also invalidate files that were removed (though they won't be in currentFilePaths)
        for (const oldPath of previousFilePaths) {
            if (!currentFilePaths.includes(oldPath)) {
                filesToInvalidate.add(oldPath);
                deletedFilesSet.add(oldPath);
            }
        }
    }

    context = await createTypeManager(routesFilesMap, fileContents, filesToInvalidate);

    // Update tracking state for next cycle
    updateFileTracking(currentFilePaths, fileContents);

    return {
        context,
        deletedFilesSet,
        filesToInvalidate,
        filesChanged: true,
    };
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
                log.error(`Failed to read file ${filePath}:`, error);
            }
        })
    );
};

let running = false;

const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
const runProcessorCycle = async () => {
    if (running) {
        return;
    }
    running = true;
    log("Running process cycle");
    try {
        const { routesFilesMap } = await collectRoutesFiles();
        await readFiles(routesFilesMap);
        const { filesChanged, context, filesToInvalidate } = await getTypeManager(routesFilesMap, fileContents);

        if (filesToInvalidate.size) {
            const list = Array.from(filesToInvalidate);

            const toBeDeletedDescriptions: string[] = [];
            for (const file of filesToInvalidate) {
                const routerMatch = file.match(routerSuffixRegx);
                if (!routerMatch) {
                    continue;
                }
                const routerName = file.slice(0, file.indexOf(routerMatch[0]));
                toBeDeletedDescriptions.push(`${routerName}${descriptionPreExtensionSuffix}.md`);
            }
            log("Deleting description files", toBeDeletedDescriptions.join(" "));
            execSync(`npx rimraf ${toBeDeletedDescriptions.join(" ")}`);

            removeFilesFromRoutesDescriptionMap(list);
            removeFilesFromEventsDescriptionMap(list);
            removeFilesFromChannelsDescriptionMap(list);
            await useContextToProcessTypes(context, list);
        } else if (filesChanged) {
            await collectRoutesFilesAndDeleteDescriptions();
            await useContextToProcessTypes(context, Object.keys(routesFilesMap));
        }
    } catch (error) {
        log.error("type processor cycle error", error);
    } finally {
        running = false;
    }
};

app.get("/process", async (_request, response) => {
    await batchCycle();
    log("Received process request");
    response.status(200);
});

app.listen(3751);
