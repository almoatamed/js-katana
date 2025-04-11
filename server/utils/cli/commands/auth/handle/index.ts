const { createCommands } = await import("./commands/index.js");

const runSubCommandLine = (program) => {
    program.name("auth").description("set of commands for user authentication.").version("1.0.0");

    createCommands(program);
};

export { runSubCommandLine };
