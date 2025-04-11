import User from "../../../../../modules/User/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const multirule = (await import("../../../../../utils/rules/multirules.js")).default;

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,
        allow: {
            or: ["editUser"],
        },
    }),
    async (request, response, next) => {
        try {
            request.body.user = await User.updateProfile(request.user, request.body);

            return response.status(200).json({
                result: {
                    newUser: request.body.user,
                },
            });
        } catch (error: any) {
            next(error);
        }
    },
);

export default router;
