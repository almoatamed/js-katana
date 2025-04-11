// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// database pool
const client = (await import("$/server/utils/database/prisma.js")).default;

// rules
const multirules = (await import("../../../../../../../utils/rules/multirules.js")).default;

// env
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
            // validation

            /**
             * @type {import("$/server/utils/rules/multirules.js").Multirules }
             */
            const validationList = [
                [
                    ["required", "number", "exists"],
                    request.body.profileId,
                    "Authorities Profile ID",
                    {
                        number: {
                            min: 0,
                        },
                        exists: {
                            model: "authoritiesProfile",
                            idKey: "profileId",
                            parseInt: true,
                            include: {
                                AuthoritiesProfile: {
                                    users: {
                                        where: {
                                            deleted: false,
                                        },
                                        take: 1,
                                    },
                                },
                            },
                        },
                    },
                    {
                        exists: {
                            obj: request.body,
                            key: "profile",
                        },
                    },
                ],
            ];
            await multirules(validationList);

            if (request.body.profile.users?.length) {
                throw {
                    statusCode: 400,
                    error: {
                        msg: "Profiel Cannot be deleted, it is used by users",
                        body: request.body,
                    },
                };
            }

            await client.authoritiesProfile.update({
                where: {
                    profileId: request.body.profile.profileId,
                },
                data: {
                    updatedAt: new Date(),
                    updatedByUser: {
                        connect: {
                            userId: request.user.userId,
                        },
                    },
                    updatedByUserUsername: request.user.username,
                    updatedByUserFullName: request.user.fullName,
                    deleted: true,
                },
            });

            return response.status(200).json({
                result: {
                    msg: "ok",
                },
            });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
