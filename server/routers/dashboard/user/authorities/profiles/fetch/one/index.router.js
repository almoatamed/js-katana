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
            or: [
                "changeUserAuthorities",
            ],
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
                    "authorization profile id",
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
                                    profileAuthorities: {
                                        where: {
                                            deleted: false,
                                        },
                                        include: {
                                            dynamicAuthorities: {
                                                where: {
                                                    deleted: false,
                                                },
                                                include: {
                                                    dynamicAuthorityValues: {
                                                        where: {
                                                            deleted: false,
                                                        },
                                                    },
                                                },
                                            },
                                        },
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

            return response.status(200).json({
                profile: request.body.profile,
            });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
