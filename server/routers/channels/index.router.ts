import { handlers } from "../../utils/channelsBuilder/index.js";
import { describe } from "../../utils/routersHelpers/describe/index.js";

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();
;

router.get("/", async (request, response, next) => {
    try {

        const channels = handlers.map((h) => h.path);
        
        return response.status(200).json(channels);
    } catch (error: any) {
        next(error);
    }
});

await describe({
    fileUrl: import.meta.url,
    method: "get",
    descriptionText: "The list of channels events available",
    requiresAuth: false,
    responseBodyTypeString: "string[]",
});

export default router;
