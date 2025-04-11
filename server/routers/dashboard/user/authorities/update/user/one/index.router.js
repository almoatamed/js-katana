;
import client from "$/server/modules/index.js";
import overwrite from "$/server/modules/User/static/utils/authorities/user/overwrite.js";

// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

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
            await overwrite({
                useProfile: !!request.body.usingProfile,
                overwrite: true,
                profileId: request.body.profileId,
                authorities: request.body.authorities,
                userId: request.body.userId,
                requesterUser: request.user,            
            });
            console.log(request.body);

            if (request.body.to) {
                await client.user.update({
                    where: {
                        userId: request.body.userId,
                    },
                    data: {
                        defaultHomePageName: request.body.to,
                    },
                });
            }

            return response.status(200).end();
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
);

export default router;
