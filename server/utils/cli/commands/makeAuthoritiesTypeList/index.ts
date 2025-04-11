
const createCommand = (program: import("commander").Command) => {
    program
        .command("@authoritiesTypes")
        .alias("@at")
        .description("create the list of authorities types")
        .action(async (options) => {
            const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;
            const buildAuthorities = (
                await import("$/server/modules/User/static/utils/authorities/buildAuthorities.js")
            ).seedAuthorities;
            await buildAuthorities(authorities);
        });
};
export { createCommand };
