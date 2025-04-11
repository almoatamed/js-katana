// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

const userMiddleware = (await import("$/server/middlewares/user.middleware.js")).default;
const authorizeMiddleware = (await import("$/server/middlewares/authorize.middleware.js")).default;

router.post(
    "/",
    userMiddleware.auth,
    authorizeMiddleware.authorize({
        url: import.meta.url,

        allow: {
            //or:[],
        },
    }),
    async (request, response, next) => {
        try {
            const user = await (request as any).user.updateSelf(request.body);
            
            return response
                .status(200)
                .json({ result: { msg: "user updated", user } })
                .end();
        } catch (error: any) {
            next(error);
        }
    },
);

export default router;
