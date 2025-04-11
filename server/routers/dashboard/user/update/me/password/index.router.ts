// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;

router.post("/", auth, async (request, response, next) => {
    try {
        await (request as any).user.updatePassword(
            {
                confirmPassword: request.body.confirmPassword,
                password: request.body.password,
                requireOldPassword: true,
                oldPassword: request.body.oldPassword,
            },
            request.user,
        );

        return response.status(200).json({
            msg: "ok",
        });
    } catch (error: any) {
        next(error);
    }
});

export default router;
