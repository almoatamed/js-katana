const fs = (await import("fs")).default;
const { dirname, join } = (await import("path")).default;
const { fileURLToPath } = (await import("url")).default;

const client = (await import("$/server/utils/database/prisma.js")).default;

import path from "path";
import url from "url";
import { routerConfig } from "../../config/routing/index.js";
import ObjectError from "../ObjectError/index.js";

const srcPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../."));

export interface File {
    data: Buffer | string;
    mimetype?: string;
    staticDir?: string;
    dir?: string;
    name?: string;
    path?: string;
}

export interface ReturnFile {
    data: Buffer | string;
    buffer: Buffer;
    mimetype: string;
    dir: string;
    staticDir: string;
    name: string;
    path: string;
    saved: boolean;
}

export interface Options {
    files: Array<File> | Options;
    dir?: string;
    namePrefix?: string;
    staticDir?: string;
    mimetype?: string;
    fileExtension?: string;
    userId?: string;
    overwrite?: boolean;
    recursive?: boolean;
}

/**
 *
 * used to save files as a programmatic api
 *
 * @param {Array<File>|Options} files // list of files each has data to be saved
 * @param {string} dir // the directory where to save all given files under public folder
 * @param {string} namePrefix // name prefix to use on all given files
 * @param {string} mimetype // mimetype to use on all given files
 * @param {string} fileExtension // file extension of all given files
 * @param {string} staticDir static directory key specified in env map
 * @param {string} userId // the creator of all given files
 * @param {boolean} recursive // use recursive folder creation or not on all given files
 * @param {boolean} overwrite // overwrite original if exists
 * @returns {Promise<Array<ReturnFile>>} gives output of Array
 *
 *
 * each returned file has
 *   - dir (under public dir)
 *   - data (raw data to be saved (any))
 *   - saved (boolean)
 *   - mimetype
 *   - name (full name)
 *   - path (full path)
 *   - buffer (data buffer)
 *   - size (bytes)
 *   - userId (creator)
 *
 * @example
 *  const pdfFile = (await save({
 *          files:[{data:pdfBuffer}],
 *          dir:dir, // documents/pdf/
 *          namePrefix:namePrefix, // emails_
 *          mimetype:"application/pdf",
 *          fileExtension:"pdf",
 *          userId:userId,
 *          recursive:true
 *          overwrite = false,
 *      }))[0] // saves one file returns array of length 1
 */
export default async function (
    files: Array<File>,
    dir: string = "",
    namePrefix: string = "_",
    mimetype: string = "text/plain",
    fileExtension: string = ".txt",
    userId: string | number = 1,
    recursive: boolean = true,
    overwrite: boolean = false,
    staticDir: string = "public",
): Promise<any[]> {
    /*
     *
     * takes input of
     *
     *
     * - params
     *   - files // list of files each has data to be saved
     *   - dir // the directory where to save all given files under static directory key specified in env map folder
     *   - namePrefix // name prefix to use on all given files
     *   - mimetype // mimetype to use on all given files
     *   - fileExtension // file extension of all given files
     *   - userId // the creator of all given files
     *   - recursive // use recursive folder creation or not on all given files
     *
     *
     */

    if (arguments.length == 1) {
        const params = arguments[0];
        dir = params.dir || dir; // the directory where to save all given files under static directory key specified in env map folder
        namePrefix = params.namePrefix || namePrefix; // name prefix to use on all given files
        mimetype = params.mimetype || mimetype; // mimetype to use on all given files
        fileExtension = params.fileExtension || fileExtension; // file extension of all given files
        userId = params.userId || userId; // the creator of all given files
        recursive = params.recursive || recursive; // use recursive folder creation or not on all given files
        files = params.files || []; // all given files
        overwrite = params.overwrite || overwrite;
        staticDir = params.staticDir || staticDir || "public";
    }
    const staticDirectoryDescriptor = routerConfig.getStaticDirs().find((d) => {
        return d.local == staticDir;
    });
    if (!staticDirectoryDescriptor) {
        throw new ObjectError({
            statusCode: 500,
            error: {
                msg: "invalid static directory for saving file",
                staticDir,
                available: routerConfig.getStaticDirs(),
            },
        });
    }

    const savedFiles: any[] = []; // all saved files
    for (const file of files as any[]) {
        file.saved = false;
        try {
            file.dir || (file.dir = dir); // the directory where to save given file under static directory key specified in env map folder
            file.mimetype || (file.mimetype = mimetype); // mimetype to use on given file
            file.name ||
                (file.name = `${namePrefix}${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)}${new Date().toISOString()}.${
                    file.fileExtension || fileExtension || file.mimetype.split("/")[1]
                }`); // file full name formed of namePrefix, 2 random numbers, and isoTimestamp, and file extension
            file.path || (file.path = join(srcPath, staticDir, file.dir, file.name)); // full path of file formed of server folder path, directory, file full name
            const buffer = Buffer.from(file.data || "");
            file.buffer = buffer; // data buffer
            file.size = buffer.length || Number.isNaN(Math.floor(file.size)) ? 0 : Math.floor(file.size); // file size from data buffer
            file.userId = file.userId || userId; // creator id

            const unique = await client.file.findFirst({
                where: {
                    path: file.path,
                },
            });

            if (unique && !overwrite) {
                throw {
                    error: {
                        name: "file registration error",
                        msg: "file path is not unique",
                    },
                    statusCode: 409,
                };
            }
            file.data &&
                recursive &&
                fs.mkdirSync(file.path.split("/").slice(0, -1).join("/"), {
                    recursive: true,
                }); // create nested dir under public folder if not exists if data and recursive
            file.data && fs.writeFileSync(file.path, buffer); // write file to full path if data
            file.userId = Number(file.userId);
            if (!unique) {
                await client.file.create({
                    data: {
                        name: file.name,
                        mimetype: file.mimetype,
                        size: file.size,
                        path: file.path,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        deleted: false,
                        createdByUser: !file.userId
                            ? undefined
                            : {
                                  connect: {
                                      userId: Number(file.userId),
                                  },
                              },
                        updatedByUser: !file.userId
                            ? undefined
                            : {
                                  connect: {
                                      userId: file.userId,
                                  },
                              },
                    },
                });
            } else {
                await client.file.update({
                    where: {
                        fileId: unique.fileId,
                    },
                    data: {
                        name: file.name,
                        mimetype: file.mimetype,
                        size: file.size,
                        path: file.path,
                        updatedAt: new Date(),
                        deleted: false,
                        updatedByUser: !file.userId
                            ? undefined
                            : {
                                  connect: {
                                      userId: file.userId,
                                  },
                              },
                    },
                });
            }
            file.data && (file.saved = true); // set saved file to true if data
            savedFiles.push(file);
        } catch (error) {
            console.log(error);
            file.data && file.saved && fs.rmSync(file.path);
        }
    }
    /*
     * gives output of
     *
     *
     * each returned file has
     *   - dir (under static directory key specified in env map dir)
     *   - data (raw data to be saved (any))
     *   - saved (boolean)
     *   - mimetype
     *   - name (full name)
     *   - path (full path)
     *   - buffer (data buffer)
     *   - size (bytes)
     *   - userId (creator)
     */
    return savedFiles;
}
