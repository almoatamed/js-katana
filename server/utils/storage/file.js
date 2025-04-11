// @ts-nocheck
const createStorage = (await import("./storage.js")).default;
const multer = (await import("multer")).default;
const fm = (await import("$/server/middlewares/file.middleware.js")).default;

/**
 *
 * @param {Number} limit
 * @param {Number} size
 * @returns {Object}
 * returns an object contains
 *   - "files", the maximum number of files (default 1)
 *   - "fileSize", maximum size of a single file in bytes (default 1MB)
 *
 */
var limits = (limit, size) => ({
    files: limit || 1,
    fileSize: size || 1024 * 1024,
});

/**
 * @functions
 * check if the pass files type satisfies one or several mimetypes required
 *
 * @param {String | Array<String> | null | undefined} mimetypes
 * @param {Object} file
 * @returns {Boolean}
 * validity of the file mimetype
 *
 * @process
 * - if mimetypes is an array then check if the array includes the file mimetype
 * - if the mimetypes is a string we check if it equals the file mimetype
 * - if no mimetypes then the return true
 *
 */
const mimeCondition = (mimetypes, file) => {
    let mimeCondition = false;
    if (typeof mimetypes == "object") {
        mimetypes = Object.values(mimetypes);
        mimeCondition = mimetypes.length == 0 || mimetypes.includes(file?.mimetype);
    } else if (typeof mimetypes == "string") {
        mimeCondition = mimetypes == file?.mimetype;
    } else if (!mimetypes) {
        mimeCondition = true;
    }
    return mimeCondition;
};

/**
 *
 * @param {String} fieldName // multer field name selector
 * @param {Boolean} required // flag true or false
 * @param {Number} fileSize // maximum file size in Bytes
 * @param {Array<String> | String} mimetypes // required mimetype of file
 * @param {Number} limit // maximum number of files
 * @returns {Array<Function>}
 * middleware stack to validate and save the files
 *
 * @example
 * file('profilePicture',true,1024*1024,["image/jpeg","image/jpg"],1)
 */
const file = (
    fieldName,
    required,
    fileSize,
    mimetypes,
    limit,
    storageParams = {
        prefix: undefined,
        date: undefined,
        filename: undefined,
        randoms: 2,
        suffix: undefined,
        directory: undefined,
    },
) => {
    return [
        multer({
            storage: createStorage(storageParams),
            fileFilter: (req, file, cb) => {
                if (mimeCondition(mimetypes, file)) {
                    cb(null, true);
                } else {
                    const error = { error: { msg: "Required Field messing", name: "File Error" } };
                    error.statusCode = 400;
                    cb(error, false);
                }
            },
            limits: {
                files: limit,
                fileSize: fileSize,
            },
        }).array(fieldName, limit),
        // make sure that the file is required or not
        async (request, response) => {
            if (!Object.values(request.files || {}).length && required) {
                const error = { error: { msg: `Required File Field messing ${fieldName}`, name: "File Error" } };
                error.statusCode = 400;
                throw error;
            } else {
                return;
            }
        },
        fm.register,
    ];
};

export default file;
