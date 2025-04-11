// @ts-nocheck
const fs = (await import("fs")).default;

const client = (await import("$/server/utils/database/prisma.js")).default;
/**
 * @explanation
 * remove on file record identified either by its id (number) in database record or
 * by its full path (string) in database record
 *
 * @param {Number | String } file
 * @returns {Promise<undefined>}
 */
const rmOne = async (file) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (typeof file == "number") {
                // find
                const fileId = file;
                const fileRecord = await client.file.findFirst({
                    where: {
                        fileId: fileId,
                    },
                });
                if (!fileRecord) {
                    console.log("File not Found", fileId);
                } else {
                    fs.rmSync(fileRecord.path);
                    await client.file.update({
                        where: {
                            fileId: fileRecord.fileId,
                        },
                        data: {
                            deleted: true,
                        },
                    });
                }
            } else {
                const filePath = file;
                const fileRecord = await client.file.findFirst({
                    where: {
                        path: String(filePath).trim(),
                    },
                });
                if (!fileRecord) {
                    console.log("File not Found", String(filePath));
                } else {
                    fs.rmSync(fileRecord.path);
                    await client.file.update({
                        where: {
                            fileId: fileRecord.fileId,
                        },
                        data: {
                            deleted: true,
                        },
                    });
                }
            }
        } catch (error) {
            reject(error);
        }
    });
};
export default {
    one: rmOne,

    /**
     *
     * @param {import("fastify").FastifyRequest} request
     * @returns {undefined}
     *
     * @explanation
     * delete all files received with a request and saved by multer
     *
     *
     */
    array: async (request) => {
        return new Promise(async (resolve, reject) => {
            if (request.isFile) {
                for (const file of request.savedFiles) {
                    try {
                        await rmOne(file.path);
                    } catch (error) {
                        console.log(error.message);
                    }
                }
                resolve();
            } else {
                resolve();
            }
        });
    },
};
