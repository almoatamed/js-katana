import { Redis } from "ioredis";
import { redisConfig } from "../../config/redis/index.js";

export const redisClient = new Redis({
    password: redisConfig.getRedisPassword(),
    host: redisConfig.getRedisHost(),
    port: redisConfig.getRedisPort(),
});
