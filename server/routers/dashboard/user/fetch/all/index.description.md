<!-- --start-- /dashboard/user/fetch/all/ -->

# Route Description 
No description Text Provided

## Route Path: 
/dashboard/user/fetch/all/

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
type Response = {
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
}
```



<!-- --end-- /dashboard/user/fetch/all/ -->