import { UserConfig } from "./userConfigTypes.js";

const appToUserRolesMap = {
    "main-app": ["USER", "ADMIN", "SYSTEM"],
};

export const userConfig = {
    appUserTypesMap(appKey: string): string[] {
        return appToUserRolesMap[appKey] || [];
    },
    getUserTypeApps: (userType: string) => {
        const apps: string[] = [];
        for (const appKey in appToUserRolesMap) {
            if (appToUserRolesMap[appKey].includes(userType)) {
                apps.push(appKey);
            }
        }
        return apps;
    },
} satisfies UserConfig;
