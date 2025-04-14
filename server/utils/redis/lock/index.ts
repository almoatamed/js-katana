import { Redis } from "ioredis";
import { redisClient } from "../index.js";

export class DistributedLock {
    private redis: Redis;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    /**
     * Acquire a distributed lock
     * @param lockName - Name of the lock
     * @param ttl - Time to live in milliseconds
     * @param retryDelay - Delay between retries in milliseconds
     * @param maxRetries - Maximum number of retry attempts
     * @returns Lock identifier if acquired, null otherwise
     */
    async acquire(
        lockName: string,
        ttl: number = 10000,
        retryDelay: number = 100,
        maxRetries: number = 30,
    ): Promise<string | null> {
        ttl = ttl > 0 ? ttl + Math.random() * 30 : 0;
        retryDelay = retryDelay + Math.random() * 30;

        const lockId = Math.random().toString(36).substring(2, 15);
        const key = `lock:${lockName}`;

        let retries = 0;

        while (retries < maxRetries) {
            const result = await this.redis.set(key, lockId, "PX", ttl, "NX");

            if (result === "OK") {
                return lockId;
            }

            if (retries < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }

            retries++;
        }

        return null;
    }

    /**
     * Release a distributed lock
     * @param lockName - Name of the lock
     * @param lockId - Lock identifier to validate ownership
     * @returns True if lock was successfully released
     */
    async release(lockName: string, lockId: string): Promise<boolean> {
        const key = `lock:${lockName}`;

        const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

        const result = (await this.redis.eval(luaScript, 1, key, lockId)) as number;
        return result === 1;
    }

    /**
     * Try to acquire a lock once without retrying
     * @param lockName - Name of the lock
     * @param ttl - Time to live in milliseconds
     * @returns Lock identifier if acquired, null otherwise
     */
    async tryAcquire(lockName: string, ttl: number = 10000): Promise<string | null> {
        return this.acquire(lockName, ttl, 0, 1);
    }
}

export const redisLock = new DistributedLock(redisClient);
