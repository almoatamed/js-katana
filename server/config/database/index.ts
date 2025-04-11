import { getFromEnv } from "../dotEnv.js";
import { DbConfig } from "./databaseConfigTypes.js";

export const dbConfig = {
    getDbName() {
        return getFromEnv("DATABASE_NAME");
    },
} satisfies DbConfig;
