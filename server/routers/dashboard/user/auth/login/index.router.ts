import client from "../../../../../modules/index.js";

const express = (await import("$/server/utils/express/index.js")).default;
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
// const pq = (await import("\$/server/database/helpers/promiseQuery.db.js")).default;

// env
;

//router instance
const router = express.Router();
router.servedTypes = ["Http"];
router.post("/", async (req, res, next) => {
    try {
        const result = await client.user.auth.login(req.body.username, req.body.password);

        const returnResponse = {
            result,
        };
        return res.status(200).json(returnResponse).end();
    } catch (error: any) {
        next(error);
    }
});

(await import("./index.describe.js")).describeLogin(import.meta.url);

export default router;
