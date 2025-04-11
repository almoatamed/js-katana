// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// database pool
const client = (await import("$/server/utils/database/prisma.js")).default;

// rules
const multirules = (await import("../../../../../../../utils/rules/multirules.js")).default;

// env
;

// authorities
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;
const { authorize } = (await import("$/server/middlewares/authorize.middleware.js")).default;

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,

        allow: {
            or: ["changeUserAuthorities"],
        },
    }),
    async (request, response, next) => {
        try {
            return response.status(200).json({
                results: await client.authoritiesProfile.findMany({ where: { deleted: false } }),
            });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
