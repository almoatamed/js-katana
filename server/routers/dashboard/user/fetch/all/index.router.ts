import { describeRoute } from "../../../../../utils/routersHelpers/describe/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const express = (await import("$/server/utils/express/index.js")).default;

const router = express.Router();

await describeRoute({
    fileUrl: import.meta.url, 
    method: "post", 
    responseBodyTypeString:`{
    results: {
        createdByUserId: number | null;
        createdByUserUsername: string | null;
        createdByUserFullName: string | null;
        updatedByUserId: number | null;
        updatedByUserUsername: string | null;
        updatedByUserFullName: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        deleted: boolean | null;
        userId: number;
        archived: boolean;
        active: boolean;
        phone: string | null;
        defaultHomePageName: string | null;
        authorizationProfileId: number | null;
        email: string | null;
        regionId: number | null;
        fullName: string;
        lastOnline: Date | null;
        lastOffline: Date | null;
        username: string;
        unverifiedEmail: string | null;
        unverifiedPhone: string | null;
        userType: $Enums.usersTypes;
        nearestPoint: string | null;
    }[];
}`, 
})

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
            const users = await client.user.findMany({ where: { deleted: false } });
            const sanitizedUsers = users.map((user) => {
                const { password, ...rest } = user;
                return rest;
            });

            const result = {
                results: sanitizedUsers,
            };
            return response.status(200).json(result).end();
        } catch (error: any) {
            next(error);
        }
    },
);
export default router;
