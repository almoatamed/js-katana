<!-- --start-- /dashboard/user/auth/login/ -->

# Route Description

Dashboard user Login api

## Route Path:

/dashboard/user/auth/login/

## Route Method:

post

## route Request Headers type definition:

```ts
type RequestHeader = any;
```

## route Request Params type definition:

```ts
type RequestQueryParams = any;
```

## route Request Body type definition:

```ts
type RequestBody = { username: string; password: string };
```

## Response Content Mimetype:

application/json

## Response Content Type Definition:

```ts
type Response = {
    user: Prisma.UserGetPayload<{
        include: {
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
    token: string;
};
```

<!-- --end-- /dashboard/user/auth/login/ -->
