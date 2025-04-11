export type AppIdentity = {
    getName: () => string;
    getLogo: () => string | null;
    getLogoUrl: () => string | null;
};
