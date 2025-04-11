import User from "../../../../modules/User/index.js";

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const multirule = (await import("../../../../utils/rules/multirules.js")).default;

const express = (await import("$/server/utils/express/index.js")).default;

const bcrypt = (await import("bcrypt")).default;
const router = express.Router();

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,
        allow: { or: ["archiveUser"] },
    }),
    async (request, response, next) => {
        try {
            request.body.user = await User.archive(request.user, {
                userId: request.body?.userId,
            });

            return response.status(200).json({
                result: {
                    msg: "OK",
                },
            });
        } catch (error: any) {
            next(error);
        }
    },
);

export default router;
