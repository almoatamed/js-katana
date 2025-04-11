import { createCommand as auth } from "./auth/index.js";
import { createCommand as bench } from "./bench/index.js";
import { createCommand as build } from "./build/index.js";
import { createCommand as createRoute } from "./createRoute/index.js";
import { createCommand as createRoutersDirectoryAlias } from "./createRoutersDirectoryAlias/index.js";
import { createCommand as db } from "./db/index.js";
import { createCommand as dev } from "./dev/index.js";
import { createCommand as format } from "./fmt/index.js";
import { createCommand as basetagLink } from "./link/index.js";
import { createCommand as makeAuthoritiesTypeList } from "./makeAuthoritiesTypeList/index.js";
import { createCommand as postinstall } from "./postinstall/index.js";
import { createCommand as removeAllMarkdownDescriptions } from "./removeAllMarkdownDescriptions/index.js";
import { createCommand as seed } from "./seed/index.js";
import { createCommand as start } from "./start/index.js";
import { createCommand as test } from "./test/index.js";

const createCommands = (program: import("commander").Command) => {
    createRoute(program);
    postinstall(program);
    basetagLink(program);
    test(program);
    build(program);
    makeAuthoritiesTypeList(program);
    db(program);
    auth(program);
    dev(program);
    createRoutersDirectoryAlias(program);
    start(program);
    seed(program);
    format(program);
    bench(program);
    removeAllMarkdownDescriptions(program);
};

export { createCommands };
