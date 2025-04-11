import { program } from "commander";

program.name("aramRest").description("set of commands to make rest api development easy.").version("1.0.0");

import { createCommands } from "./commands/index.js";
import logger from "./logger.js";
import { appPath } from "./utils/appPath/index.js";
if (!process.cwd().match(RegExp(`${appPath}(?:$|\\/)`))) {
    logger.error("Your Are not inside the project");
    logger.warning("the app path is: ", appPath);
    console.log();
    logger.text(
        "If you are in Rest project use 'npm i -g' to install the command line for that project, or use 'npx rest'",
    );
    process.exit(1);
}

createCommands(program);

program.parse();
