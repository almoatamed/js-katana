<!-- --start-- /dashboard/user/fetch/me/ -->

# Route Description 
No description Text Provided

## Route Path: 
/dashboard/user/fetch/me/

## Route Method:
post




## route Request Headers type definition:
```ts
type RequestHeader = any
```

## route Request Params type definition:
```ts
type RequestQueryParams = any
```

## route Request Body type definition:
```ts
type RequestBody = any
```

## Response Content Mimetype: 
application/json

## Response Content Type Definition: 
```ts
type Response = Prisma.UserGetPayload<{
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
}>
```



<!-- --end-- /dashboard/user/fetch/me/ -->