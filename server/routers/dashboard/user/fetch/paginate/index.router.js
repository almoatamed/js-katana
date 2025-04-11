const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,
        allow: { or: ["viewListOfUsers"] },
    }),
    async (request, response, next) => {
        try {
            const fullData = await client.user.findMany({
                where: {
                    AND: {
                        deleted: false,
                        archived: false,

                        // search
                        OR: !request.body.search
                            ? undefined
                            : [
                                  !Math.floor(request.body.search)
                                      ? undefined
                                      : {
                                            userId: {
                                                equals: Math.floor(request.body.search),
                                            },
                                        },
                                  {
                                      fullName: {
                                          contains: request.body.search,
                                      },
                                  },
                                  {
                                      phone: {
                                          contains: request.body.search,
                                      },
                                  },
                                  {
                                      email: {
                                          contains: request.body.search,
                                      },
                                  },
                                  {
                                      username: {
                                          contains: request.body.search,
                                      },
                                  },
                              ].filter((e) => !!e),
                    },
                },
                orderBy: request.body.orderBy || [
                    {
                        createdAt: "desc",
                    },
                ],
                include: {
                    createdByUser: true,
                    createdUserLog: {
                        where: {
                            deleted: false,
                        },
                        take: 1,
                    },
                },
            });
            const length = fullData.length;
            const data = {
                results: fullData.splice(request.body.skip, request.body.take || length).map((u) => {
                    const { password, ...user } = u;
                    return user;
                }),
                total: length,
            };
            return response.status(200).json(data).end();
        } catch (error) {
            next(error);
        }
    },
);

export default router;
