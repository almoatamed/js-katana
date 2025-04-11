import { InvalidArgumentError } from "commander";

import path from "path";
import { routerConfig } from "../../../../config/routing/index.js";
import logger from "../../logger.js";
import { appPath } from "../../utils/appPath/index.js";

const fs = (await import("fs")).default;

const routerDirPath = path.join(appPath, routerConfig.getRouterDirectory());

/**
 *
 * @param {import("commander").Command} program
 */
const createCommand = (program: import("commander").Command) => {
    program
        .command("create-routers-dir-alias")
        .alias("rda+")
        .description("use it to a routers directory alias")
        .argument(
            "<directory>",
            `source routers directory relative path e.g "A/someRoutes"`,
            (sourceRouterDirectory, _) => {
                if (!sourceRouterDirectory || typeof sourceRouterDirectory != "string") {
                    throw new InvalidArgumentError("Please Provide the routers directory name as in 'my/routes'");
                }

                if (sourceRouterDirectory.startsWith("./")) {
                    throw new InvalidArgumentError(
                        "the source routers directory must be relative to routers directory: " + routerDirPath,
                    );
                }
                const fullSourceRouterDirectory = path.join(routerDirPath, sourceRouterDirectory);

                if (!fs.existsSync(fullSourceRouterDirectory)) {
                    throw new InvalidArgumentError(
                        `${sourceRouterDirectory} does not exists, please make sure its valid`,
                    );
                }

                const stats = fs.statSync(fullSourceRouterDirectory);
                if (!stats.isDirectory()) {
                    throw new InvalidArgumentError(
                        `${fullSourceRouterDirectory} is not a directory, please make sure its valid`,
                    );
                }

                return sourceRouterDirectory;
            },
        )
        .argument(
            "<alias>",
            `where to put the alias, it must be relative to the routers directory and not in the source routers directory e.g. /B/someRoutesAlias`,
            (aliasPath, p) => {
                if (!aliasPath || typeof aliasPath != "string") {
                    throw new InvalidArgumentError("Please Provide the alias name as in 'my/new/alias'");
                }

                if (!aliasPath.endsWith(routerConfig.getDirectoryAliasSuffix())) {
                    aliasPath += routerConfig.getDirectoryAliasSuffix();
                }

                if (aliasPath.startsWith("./")) {
                    throw new InvalidArgumentError(
                        "the source routers directory must be relative to routers directory: " + routerDirPath,
                    );
                } else {
                    aliasPath = path.join(routerDirPath, aliasPath);
                }

                if (fs.existsSync(aliasPath)) {
                    throw new InvalidArgumentError(`Alias ${aliasPath} already exists, please check it`);
                }

                return aliasPath;
            },
        )
        .option("-r, --recursive", "Create the alias path recursively", false)
        .action(
            /**
             *
             * @param {string} directory
             * @param {string} alias
             */
            async (directory: string, alias: string, options) => {
                const fullSourceRouterDirectory = path.join(routerDirPath, directory);
                if (alias.match(RegExp(`${fullSourceRouterDirectory}(?:$|\\/)`))) {
                    return logger.error(
                        `Can not create alias ${alias} within ${directory}, this will cause infinite loop.`,
                    );
                }

                if (options.recursive) {
                    fs.mkdirSync(path.dirname(alias), { recursive: true });
                }

                if (!fs.existsSync(path.dirname(alias))) {
                    return logger.error(
                        "the target directory does not exists, use -r if you want to make the directory recursively",
                    );
                }
                fs.writeFileSync(alias, `export default "${directory}"`);
            },
        );
};
export { createCommand };
