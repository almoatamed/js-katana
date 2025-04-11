import fs from "fs";
import path from "path";
import { routerConfig } from "../../../../config/routing/index.js";
import { srcPath } from "../../utils/srcPath/index.js";

const removeMarkdownDescriptions = (currentDir: string, descriptionRegex: RegExp) => {
    const directoryContent = fs.readdirSync(currentDir);
    for (const item of directoryContent) {
        const itemFullPath = path.join(currentDir, item);
        const itemStats = fs.statSync(itemFullPath);
        if (itemStats.isDirectory()) {
            removeMarkdownDescriptions(itemFullPath, descriptionRegex);
        } else {
            if (item.match(descriptionRegex)) {
                fs.rmSync(itemFullPath);
            }
        }
    }
};

const createCommand = (program: import("commander").Command) => {
    program
        .command("removeAllMdRoutersDescriptors")
        .alias("rmrmd")
        .description("use it to remove all markdown descriptions file for routers")
        .action(async () => {
            const routerFullDirectoryPath = path.join(srcPath, routerConfig.getRouterDirectory());
            const descriptionRegex = RegExp(routerConfig.getRouterSuffixRegx());
            removeMarkdownDescriptions(routerFullDirectoryPath, descriptionRegex);

            process.exit(0);
        });
};
export { createCommand };
