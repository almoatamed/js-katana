export type RedisConfig = {
    getRedisPort: ()=>number|undefined;
    getRedisHost: ()=>string|undefined;
    getRedisPassword: ()=>string|undefined;
    useRedis: ()=>boolean;
}