import { Command } from "commander";

const { createCommands } = await import("./commands/index.js");

const runSubCommandLine = (program: Command) => {
    program.name("db").description("set of database commands.").version("1.0.0");

    createCommands(program);
};

export { runSubCommandLine };
