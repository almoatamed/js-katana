const multer = (await import("multer")).default;
const moment = (await import("moment")).default;
const path = (await import("path")).default;

import createLogger from "$/server/utils/log/index.js";
import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
const log = await createLogger("create storage for multer middleware", "white", true, "Info");
const mimeTypes = (await import("mime-types")).default;

function randoms(n = 2) {
    let returnString = "";
    for (let i = 0; i < 2; i++) {
        returnString += String(Math.floor(Math.random() * 10));
    }
    return returnString;
}

const _Dirname = dirname(fileURLToPath(import.meta.url));
/**
 * @description
 * storage is the multer storage utility, specifies
 *  - the callback for creating file name
 *  - the callback for specifying storage directory (public)
 *
 */
const createStorage = function (params = {}) {
    let savePath = path.join(_Dirname, "../../public/uploads");
    if (params.directory) {
        savePath = path.join(savePath, params.directory);
    }
    fs.mkdirSync(savePath, {
        recursive: true,
    });
    const finalSavePath = savePath;
    const storage = multer.diskStorage({
        destination: async function (req, file, cb) {
            cb(null, finalSavePath);
        },
        filename: function (req, file, cb) {
            if (params.filename) {
                return cb(null, params.filename);
            }
            let date = params.date || moment().toISOString().replace(/\-/g, "_").replace(/:/g, "-").replace(".", "-");
            let name =
                (params.prefix || file.fieldname) +
                "_" +
                (params.randoms === 0 ? "" : randoms(Math.floor(params.randoms) || 2) + "_") +
                date +
                "." +
                (mimeTypes.extension(file.mimetype) || params.suffix || file.mimetype.split("/")[1]);
            return cb(null, name);
        },
    });
    return storage;
};

export default createStorage;
