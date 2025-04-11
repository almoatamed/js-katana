import Logger from "../../logger.js";

interface Options {
    debase?: boolean;
}

const build = async (options: Options = {}) => {
    const fs = (await import("fs")).default;
    const path = (await import("path")).default;
    const execSync = (await import("child_process")).execSync;
    const tsConfig = (await import("../../utils/loadTsConfig/index.js")).loadTsConfig();
    const appPath = (await import("../../utils/appPath/index.js")).appPath;

    const outDir = tsConfig.compilerOptions?.outDir;
    if (!outDir) {
        Logger.error("Build directory not specified");
        process.exit(1);
    }

    console.log("Deleting build directory", outDir, "...")
    execSync(`rm -rf ${outDir}`, {
        cwd: appPath,
        stdio: "inherit",
    });

    console.log("copying server to", outDir)
    execSync(`cp -R server ${outDir}`, {
        cwd: appPath,
        stdio: "inherit",
    });


    console.log("building.....")
    execSync("bunx tsc", {
        cwd: appPath,
        stdio: "inherit",
    });

    function changeBaseTagSymbol(prefix = path.join(appPath, outDir)) {
        const buildContent = fs.readdirSync(prefix);
        for (const item of buildContent) {
            const itemPath = path.join(prefix, item);
            const itemStat = fs.statSync(itemPath);
            if (itemStat.isDirectory()) {
                changeBaseTagSymbol(itemPath);
            } else {
                if ((item.endsWith(".ts") && !item.endsWith(".d.ts")) ||  item.endsWith(".test.js")) {
                    execSync(`rm  ${itemPath}`, {
                        cwd: appPath,
                        stdio: "inherit",
                    });
                } else if ((!options?.debase && item.endsWith(".js")) || item.endsWith("json")) {
                    let jsCode = fs.readFileSync(itemPath, "utf-8");
                    // import(path.join(appPath, 
                    jsCode = jsCode.replaceAll(RegExp(`(?<=import\\(path\\.join\\(appPath,.*?)server`, "g"), `/${outDir}`);
                    jsCode = jsCode.replaceAll(RegExp(`(?<=\\$)\\/server`, "g"), `/${outDir}`);
                    jsCode = jsCode.replaceAll(RegExp(`\\.ts(?='|")`, "g"), `.js`);
                    fs.writeFileSync(itemPath, jsCode, { encoding: "utf-8" });
                } else if (options?.debase && item.endsWith(".js")) {
                    let jsCode = fs.readFileSync(itemPath, "utf-8");
                    jsCode = jsCode.replaceAll(RegExp(`\\.ts(?='|")`, "g"), `.js`);
                    jsCode = jsCode.replaceAll(
                        RegExp(`('|"|\`)(\\$\\/server(.*?))\\1`, "g"),
                        (fullMatch, quote, fullPath, pathPostServer) => {
                            const toPath = path.join(appPath, outDir, pathPostServer);
                            return `"./${path.relative(path.dirname(itemPath), toPath)}"`;
                        }
                    );

                    fs.writeFileSync(itemPath, jsCode, { encoding: "utf-8" });
                }
            }
        }
    }
    changeBaseTagSymbol();
    console.log("Done!")
};

export { build };
