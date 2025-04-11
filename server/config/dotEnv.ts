const dotEnv: any = process.env;
export const getFromEnv = (key: string): any => {
    return dotEnv[key] || dotEnv[key.toLowerCase()] || dotEnv[key.toUpperCase()];
};
