import grant from "./grant.js";

export default async function overwrite(options: import("./grant.js").Options) {
    options.overwrite = true;
    await grant(options);
}
