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
            or: ["changeUserAuthorities"],
        },
    }),
    async (request, response, next) => {
        try {
            // validation
            await multirule([
                [
                    ["required", "number", "exists"],
                    request.body.userId,
                    "User ID",
                    {
                        number: {
                            min: 0,
                        },
                        exists: {
                            model: "user",
                            idKey: "userId",
                            parseInt: true,
                            include: {
                                User: {
                                    userAuthorities: {
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
                                    authorizationProfile: {
                                        include: {
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
                        },
                    },
                    {
                        exists: {
                            obj: request.body,
                            key: "user",
                        },
                    },
                ],
            ]);

            const { password, ...user } = request.body.user;

            return response.status(200).json({ user }).end();
        } catch (error) {
            next(error);
        }
    },
);

export default router;
