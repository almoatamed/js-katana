import { getFromEnv } from "../dotEnv.js";
import { RedisConfig } from "./redisConfigTypes.js";

export const redisConfig: RedisConfig = {
    getRedisHost() {
        return getFromEnv("REDIS_HOST");
    },
    getRedisPassword() {
        return getFromEnv("REDIS_PASSWORD");
    },
    getRedisPort() {
        return getFromEnv("REDIS_PASSWORD") || undefined;
    },
    useRedis() {
        return !!(this.getRedisHost() && this.getRedisPort());
    },
};
