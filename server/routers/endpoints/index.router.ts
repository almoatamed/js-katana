import endpoints from "../../utils/dynamicConfiguration/endpoints.js";

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();

router.all("/", async (request, response, next) => {
    try {
        return response.status(200).json({
            result: {
                endpoints: await endpoints.get("endpoints"),
            },
        });
    } catch (error) {
        next(error);
    }
});
export default router;
