// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// database pool
const client = (await import("$/server/modules/index.js")).default;

const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;

router.post("/", auth, async (request, response, next) => {
    try {
        const fullData = await client.userNotification.findMany({
            where: {
                deleted: false,
                userId: request.user.userId,

                // search
                OR: (!request.body.search
                    ? undefined
                    : [
                          {
                              title: {
                                  contains: request.body.search,
                              },
                          },
                          {
                              contents: {
                                  contains: request.body.search,
                              },
                          },
                      ].filter(e=>!!e)) as any,
            },
            orderBy: request.body.orderBy || [
                {
                    createdAt: "desc",
                },
            ],
            include: {
                createdByUser: true,
                tags: {
                    where: {
                        deleted: false,
                    },
                    include: {
                        tag: true,
                    },
                },
                notificationResource: {
                    include: {
                        tags: {
                            include: {
                                tag: true,
                            },
                        },
                    },
                },
            },
        });
        const length = fullData.length;
        const data = {
            results: fullData.splice(request.body.skip, request.body.take || length),
            total: length,
        };
        return response.status(200).json(data).end();
    } catch (error: any) {
        next(error);
    }
});

export default router;
