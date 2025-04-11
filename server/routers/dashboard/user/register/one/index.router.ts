// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// database pool
const client = (await import("$/server/modules/index.js")).default;


// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;
const { authorize } = (await import("$/server/middlewares/authorize.middleware.js")).default;

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,

        allow: {
            or: ["addUser"],
        },
    }),
    async (request, response, next) => {
        try {
            await client.user.register(request.user, request.body);

            return response.status(200).json({
                msg: "ok",
            });
        } catch (error: any) {
            next(error);
        }
    },
);

export default router;
