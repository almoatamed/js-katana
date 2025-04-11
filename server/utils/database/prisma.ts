import { Prisma, PrismaClient } from "$/prisma/client/index.js";
import { cap } from "$/server/utils/common/index.js";
import cluster from "cluster";
import fs from "fs";
import path from "path";
import { srcPath } from "../../utils/cli/utils/srcPath/index.js";
import dbModels from "../dynamicConfiguration/dbModels.js";

const utilsPath = path.join(srcPath, "/utils");
const client = new PrismaClient({ errorFormat: "minimal" });

export type Client = any;

client.$use(async (params, next) => {
    if (params.args == undefined) {
        params.args = {};
    }
    if (params.action == "findUnique" || params.action == "findFirst") {
        params.action = "findFirst";
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where.deleted === undefined) {
            params.args.where["deleted"] = false;
        }
    } else if (params.action == "findMany") {
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where.deleted === undefined) {
            params.args.where["deleted"] = false;
        }
    }
    return next(params);
});

// if updateMany check deleted flag
// remember that you cant set update since it only take id in where
client.$use(async (params, next) => {
    if (params.args === undefined) {
        params.args = {};
    }
    if (params.action == "updateMany") {
        if (params.args["where"] === undefined) {
            params.args["where"] = {};
        }
        if (params.args.where["deleted"] === undefined) {
            params.args.where["deleted"] = false;
        }
    }
    return next(params);
});

// on delete change action to update or update many
client.$use(async (params, next) => {
    if (params.args === undefined) {
        params.args = {};
    }
    // Check incoming query type
    if (params.action == "delete") {
        // Delete queries
        // Change action to an update
        params.action = "update";
        if (params.args.data != undefined) {
            params.args.data["deleted"] = true;
        } else {
            params.args["data"] = { deleted: true };
        }
    }
    if (params.action == "deleteMany") {
        // Delete many queries
        params.action = "updateMany";
        if (params.args.data != undefined) {
            params.args.data["deleted"] = true;
        } else {
            params.args["data"] = { deleted: true };
        }
    }
    return next(params);
});

if (cluster.isPrimary && process.env.NODE_ENV !== "test") {
    await dbModels.set("db", "models", {});

    const models: string[] = [];
    const capModels: string[] = [];
    for (const model in client) {
        if (typeof client[model] == "object" && !!client[model].findFirst) {
            await dbModels.set("db.models", model, model);
            models.push(model);
            capModels.push(cap(model));
        }
    }

    await dbModels.set("db", "modelsArray", models);
    await dbModels.set("db", "capModelsArray", capModels);

    fs.writeFileSync(
        `${utilsPath}/JsDoc/assets/models.js`,
        `

/**
 * @typedef {${Object.values(dbModels.db.models)
     .map((el) => `"${el}"`)
     .join("|")}} Model
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utilsPath}/JsDoc/assets/where.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Where
${Object.values(dbModels.db.capModelsArray)
    .map((el) => ` * @property {Prisma.${el}WhereInput} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );

    let preFindOrCreate: string[] = [];
    const findOrCreate: string[] = [];
    for (const model in client) {
        if (!!client[model] && client[model].findFirst) {
            preFindOrCreate.push(
                `
    /**
     * @callback [model]FindOrCreate
     * @param {{
     *      where: Prisma.[model]WhereInput, 
     *      create: Prisma.[model]CreateInput,
     * }} options - options
     * @returns {[model]} - created or found object
     */

`.replaceAll("[model]", model),
            );
            findOrCreate.push(`${model}:{ findOrCreate:${model}FindOrCreate }`);
        }
    }

    fs.writeFileSync(
        `${utilsPath}/JsDoc/assets/findOrCreate.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

${preFindOrCreate.join("\n")}

/**
 * @typedef {{${findOrCreate.join(",")}}} FindOrCreateExtension
 * 
 * 
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utilsPath}/JsDoc/assets/include.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Include
${Object.values(dbModels.db.capModelsArray)
    .map((el) => ` * @property {Prisma.${el}Include} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );

    fs.writeFileSync(
        `${utilsPath}/JsDoc/assets/select.js`,
        `
    import { Prisma } from '$/prisma/client/index.js';

/**
 * @typedef {Object} Select
${Object.values(dbModels.db.capModelsArray)
    .map((el) => ` * @property {Prisma.${el}Select} [${cap(el)}]`)
    .join("\n")}
 * 
 * 
 */
export default {}
`,
    );
}

const extendedClient = client
    .$extends({
        query: {
            $allModels: {
                async findFirst({ model, operation, args, query }) {
                    args.orderBy = args.orderBy || {
                        createdAt: "desc",
                    };
                    return await query(args);
                },

                async findMany({ model, operation, args, query }) {
                    args.orderBy = args.orderBy || {
                        createdAt: "desc",
                    };

                    return await query(args);
                },
            },
        },
    })
    .$extends({
        name: "BaseExtension",
        model: {
            $allModels: {
                async findOrCreate<T, A>(
                    this: T,
                    args: Prisma.Exact<A, Prisma.Args<T, "findFirst">> & Prisma.Exact<A, Prisma.Args<T, "create">>,
                ): Promise<Prisma.Result<T, A, "create">> {
                    const ctx = Prisma.getExtensionContext(this);
                    const model = (ctx.$parent as any)[ctx.$name as any];
                    const result = await model.findFirst({
                        where: (args as any).where,
                        include: (args as any).include,
                        select: (args as any).select,
                    });
                    if (result) {
                        return result;
                    } else {
                        const result = await model.create({
                            data: (args as any).data,
                            include: (args as any).include,
                            select: (args as any).select,
                        });
                        return result;
                    }
                },
            },
        },
    });

await extendedClient.$connect();
export default extendedClient;
