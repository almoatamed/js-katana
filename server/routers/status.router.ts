// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

router.get("/", async (request, response, next) => {
    try {
        return response.status(200).send("Everything is fine today!!");
    } catch (error: any) {
        next(error);
    }
});

export default router;
