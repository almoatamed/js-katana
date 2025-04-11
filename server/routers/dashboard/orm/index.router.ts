import client from "$/server/utils/database/prisma.js";
const multirule = (await import("../../../utils/rules/multirules.js")).default;

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,

        allow: {
            or: ["orm"],
        },
    }),
    async (request, response, next) => {
        try {
            const queryResponse = await client[request.body.model][request.body.action](request.body.params);
            return response
                .status(200)
                .json({
                    result: {
                        queryResponse: queryResponse,
                    },
                })
                .end();
        } catch (error) {
            next(error);
        }
    },
);

export default router;
