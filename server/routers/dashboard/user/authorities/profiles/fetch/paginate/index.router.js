const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const multirule = (await import("../../../../../../../utils/rules/multirules.js")).default;

;

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
            const fullData = await client.authoritiesProfile.findMany({
                where: {
                    AND: {
                        deleted: false,
                        // search
                        OR: !request.body.search
                            ? undefined
                            : [
                                  !Math.floor(request.body.search)
                                      ? undefined
                                      : {
                                            profileId: {
                                                equals: Math.floor(request.body.search),
                                            },
                                        },
                                  {
                                      name: {
                                          contains: request.body.search,
                                      },
                                  },
                              ].filter(e=>!!e),
                    },
                },
                orderBy: request.body.orderBy || [
                    {
                        createdAt: "desc",
                    },
                ],
                include: {
                    createdByUser: true,
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
                    users: {
                        take: 1,
                        where: { deleted: false },
                    },
                },
            });
            const length = fullData.length;
            const data = {
                results: fullData.splice(request.body.skip, request.body.take || length),
                total: length,
            };
            return response.status(200).json(data).end();
        } catch (error) {
            next(error);
        }
    },
);

export default router;
