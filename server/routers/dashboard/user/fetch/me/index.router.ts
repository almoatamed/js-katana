import { Prisma } from "../../../../../../prisma/client/index.js";
import { describe } from "../../../../../utils/routersHelpers/describe/index.js";

// router instance
const express = (await import("$/server/utils/express/index.js")).default;
const router = express.Router();

// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;

type Requester = Prisma.UserGetPayload<{
    include: {
        employmentPosition: {
            include: {
                employee: true;
                department: true;
                authorizationProfile: {
                    include: {
                        profileAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorities: {
                                    where: {
                                        deleted: false;
                                    };
                                    include: {
                                        dynamicAuthorityValues: {
                                            where: {
                                                deleted: false;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                authorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        userAuthorities: {
            where: {
                deleted: false;
            };
            include: {
                dynamicAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorityValues: {
                            where: {
                                deleted: false;
                            };
                        };
                    };
                };
            };
        };
        authorizationProfile: {
            include: {
                profileAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
}>;

await describe({
    fileUrl: import.meta.url,
    method: "post",
    requiresAuth: true,
    // requiresAuthorities: [],
    responseBodyTypeString: `Prisma.UserGetPayload<{
    include: {
        employmentPosition: {
            include: {
                employee: true;
                department: true;
                authorizationProfile: {
                    include: {
                        profileAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorities: {
                                    where: {
                                        deleted: false;
                                    };
                                    include: {
                                        dynamicAuthorityValues: {
                                            where: {
                                                deleted: false;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                authorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        userAuthorities: {
            where: {
                deleted: false;
            };
            include: {
                dynamicAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorityValues: {
                            where: {
                                deleted: false;
                            };
                        };
                    };
                };
            };
        };
        authorizationProfile: {
            include: {
                profileAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
}>`,
});
router.post("/", auth, async (request, response, next) => {
    try {
        const { password, ...user } = request.user;
        const result = {
            ...user,
        };
        response.status(200).json(result).end();
    } catch (error: any) {
        next(error);
    }
});

export default router;
