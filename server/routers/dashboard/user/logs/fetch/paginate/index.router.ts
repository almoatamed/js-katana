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
        allow: {
            or: ["viewUserActivityLogs"],
        },
    }),
    async (request, response, next) => {
        try {
            const fullData = await client.userLog.findMany({
                where: {
                    AND: {
                        deleted: false,
                        createdByUserId: Math.floor(request.body.userId) || undefined,

                        // search
                        OR: !request.body.search
                            ? undefined
                            : [
                                  {
                                      summary: {
                                          contains: request.body.search,
                                      },
                                  },
                                  {
                                      title: {
                                          contains: request.body.search,
                                      },
                                  },
                                  {
                                      variables: {
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
