import fs from "fs";
import path from "path";
import logger from "../../logger.js";
import { srcPath } from "../../utils/srcPath/index.js";

/**
 *
 * @param {boolean} prod
 * @returns {Object.<string,string>}
 */
const seedersDirectoryPath = path.join(srcPath, "startup", "_0Seed", "seeders");
const seedersDevDirectoryPath = path.join(srcPath, "startup", "devSeed", "seeders");

/**
 *
 * @param {string} item
 * @returns {boolean}
 */
function isSeeder(item) {
    return !!item.match(/\.seeder\.(?:js|ts)$/);
}

/**
 *
 * @param {string} dirPath
 * @param {Object.<string,string>} list
 */
function listSeeders(dirPath = seedersDirectoryPath, list = {}) {
    if (!fs.existsSync(dirPath)) {
        return {};
    }
    const content = fs.readdirSync(dirPath);
    for (const item of content) {
        const itemPath = path.join(dirPath, item);
        const itemStats = fs.statSync(itemPath);
        if (itemStats.isDirectory()) {
            listSeeders(itemPath);
        } else {
            if (isSeeder(item)) {
                list[item.split(".seeder")[0]] = itemPath;
            }
        }
    }
}

const seedersList = {} as any;
listSeeders(seedersDirectoryPath, seedersList);

const seedersDevList = {};
listSeeders(seedersDevDirectoryPath, seedersDevList);

async function runSeeder(seederPath) {
    const seederRunner = (await import(seederPath))?.run;
    if (seederRunner) {
        await seederRunner();
    }
}

/**
 *
 * @param {string} seederName
 *
 */
async function runDevelopmentSeeder(seederName, options) {
    if (options.all) {
        const files = Object.values(seedersDevList);
        if (!files.length) {
            logger.warning("no seeders found!");
            return;
        }
        for (const seeder of files) {
            await runSeeder(seeder);
        }
    }

    const seederPath = seedersDevList[seederName];
    if (!seederPath) {
        logger.error("Development Seeder Not Found");
        logger.warning(`
available development seeders: 
${JSON.stringify(seedersList, null, 4)}
        `);
        return;
    }

    await runSeeder(seederPath);
}

/**
 * @param {string} seederName
 *
 */
async function runProductionSeeder(seederName, options) {
    if (options.all) {
        const files = Object.values(seedersList);
        if (!files.length) {
            logger.warning("no seeders found!");
            return;
        }
        for (const seeder of files) {
            await runSeeder(seeder);
        }
    }

    const seederPath = seedersList[seederName];
    if (!seederPath) {
        logger.error("Production Seeder Not Found");
        logger.warning(`
available production seeders: 
${JSON.stringify(seedersList, null, 4)}
        `);
        return;
    }

    await runSeeder(seederPath);
}

/**
 *
 * @param {import("commander").Command} program
 */
const createCommand = (program) => {
    program
        .command("seed")
        .alias("s")
        .description(`Seed components by providing the name of the seeder. `)
        .addHelpText(
            "after",
            `
know that by default seeders run on server launch.

Example:> rest s superAdmin

which will run superAdmin.seeder.js

available production seeders are: 
${JSON.stringify(seedersList, null, 4)}



available development seeders are: 
${JSON.stringify(seedersDevList, null, 4)}
        
        `,
        )
        .argument(
            "<seeder-name>",
            `
The name of the seeder file. It should end with ".seeder.js", 
and should exist in "server/startup/_0Seed" for production seeders or 
"server/startup/devSeed" for development only seeders (mock data)         
        `,
        )
        .option("-d,--dev", "seed a development mock data file")
        .option("-a,--all", "run all seeders")
        .action((seederFileName, options) => {
            if (options.dev) {
                runDevelopmentSeeder(seederFileName, options);
            } else {
                runProductionSeeder(seederFileName, options);
            }
        });
};
export { createCommand };
