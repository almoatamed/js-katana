// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// database pool
const client = (await import("$/server/modules/index.js")).default;

// rules
const multirules = (await import("$/server/utils/rules/multirules.js")).default;

// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;
const { authorize } = (await import("$/server/middlewares/authorize.middleware.js")).default;

router.post("/", async (request, response, next) => {
    try {
    } catch (error: any) {
        next(error);
    }
});

export default router;
