import fs from "fs";
import path from "path";
import url from "url";
import rootPaths from "../../../utils/dynamicConfiguration/rootPaths.js";
import { zipDirectory } from "../../../utils/storage/compress/zip/directory/index.js";

// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();
const current_dir = url.fileURLToPath(new url.URL("./", import.meta.url));

const compressedClientPath = path.join(current_dir, "compress_client.zip");
const prismaClientDirectoryPath = path.join(rootPaths.appPath, "prisma/client");
router.post("/", async (_, response, next) => {
    try {
        const found = fs.existsSync(compressedClientPath);

        if (!found) {
            await zipDirectory(prismaClientDirectoryPath, compressedClientPath, "client");
        }

        response.status(200).sendFile(compressedClientPath);
    } catch (error: any) {
        next(error);
    }
});

export default router;
