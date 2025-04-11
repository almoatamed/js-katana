import { createCommand as deploy } from "./deploy/index.js";
import { createCommand as migrate } from "./migrate/index.js";
import { createCommand as migrateGenerate } from "./migrateGenerate/index.js";
import { createCommand as prismaGenerate } from "./prismaGenerate/index.js";
import { createCommand as prismaGenerateMainSchema } from "./prismaGenerateMainSchema/index.js";

const createCommands = (program: import("commander").Command) => {
    prismaGenerate(program);
    prismaGenerateMainSchema(program);
    migrate(program);
    deploy(program);
    migrateGenerate(program);
};

export { createCommands };
