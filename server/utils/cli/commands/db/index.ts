const runSubCommandLine = (await import("./handle/index.js")).runSubCommandLine;

const createCommand = (program: import("commander").Command) => {
    const dbCommand = program.command("database").alias("db").description("database set of commands");
    runSubCommandLine(dbCommand);
};
export { createCommand };
