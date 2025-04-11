import { describe } from "../../../../../utils/routersHelpers/describe/index.js";

export const describeLogin = async (url: string) => {
    await describe({
        fileUrl: url,
        descriptionText: "Dashboard user Login api",
        method: "post",
        requestBodyTypeString: "{ username: string; password: string; }",
        responseBodyTypeString: `{
            user: Prisma.UserGetPayload<{
        
        include: {
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
        }
        }>;
        token: string;
        }`,
        requiresAuth: false,
    });
};
