export type UserConfig = {
    appUserTypesMap: (appKey: string) => string[];
    getUserTypeApps: (userType: string) => string[];
};
