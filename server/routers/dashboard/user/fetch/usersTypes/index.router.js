import { $Enums } from "../../../../../../prisma/client/index.js";

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;
const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,

        allow: {
            or: [
                {
                    keyName: "viewUserSettings",
                },
            ],
        },
    }),
    async (request, response, next) => {
        try {
            response
                .status(200)
                .json({
                    results: Object.values($Enums.UserType),
                })
                .end();
        } catch (error) {
            next(error);
        }
    },
);

export default router;
