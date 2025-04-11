import Logger from "../../logger.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("link")
        .alias("l")
        .option("-d, --delete", "Delete Base Tag", false)
        .description("use it to run basetag link")
        .action(async (options) => {
            try {
                const fs = (await import("fs")).default;
                const url = (await import("url")).default;
                const path = (await import("path")).default;
                const fileExists = function (path) {
                    try {
                        fs.accessSync(path);
                        return true;
                    } catch (e) {
                        return false;
                    }
                };
                const appPath = path.resolve(
                    path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../../../."),
                );
                const envPath = path.join(appPath, "server/env.json");
                const basePath = appPath;
                const modulesDir = "node_modules";
                const modulesPath = path.resolve(appPath, modulesDir);
                if (!fs.existsSync(modulesPath)) {
                    throw new Error(`${modulesDir} directory does not exist`);
                }
                const linkPath = path.join(appPath, "node_modules", "$");
                if (options?.delete) {
                    if (fileExists(linkPath)) {
                        fs.unlinkSync(linkPath);
                    } else {
                        Logger.warning("there is no link");
                    }
                    return;
                }
                if (fileExists(linkPath)) {
                    if (basePath === fs.realpathSync(linkPath)) {
                        if (options?.delete) {
                            fs.unlinkSync(linkPath);
                            return;
                        }
                        Logger.warning("symlink already points to base");
                        return;
                    }
                    Logger.error(`file already exists: ${linkPath}`);
                }
                fs.symlinkSync("..", linkPath, "junction");
                Logger.success(`created $ symlink to ${basePath}`);
            } catch (error) {
                console.log(error);
                Logger.error(`${error}\n\nsymlink not created`);
            }
        });
};
export { createCommand };
