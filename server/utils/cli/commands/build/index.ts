
const createCommand = (program: import("commander").Command) => {
    program
        .command("build")
        .alias("b")
        .option("--debase")
        .description("use it to run basetag link")
        .action(async (options) => {
            const build = (await import("../../utils/build/index.js")).build
            await build({debase: options?.debase})
        });
};
export { createCommand };
