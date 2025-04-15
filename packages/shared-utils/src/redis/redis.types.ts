import { Redis, RedisOptions } from "ioredis";

export interface RedisServiceConfig {
    commandConnectionOptions:RedisOptions;
    subscriberOptions?:RedisOptions;
}

export interface RedisService {
    /**
     * @returns {Redis} - gets the redis in queue manager 
     */
    getCommandClient():Redis;

    /**
     * @returns {Redis} - the subscriber redis options
     */
    getSubscriberClient():Redis;

    /**
     * @returns {Promise<void>} - disconnection returns a promise to close connection
     */
    disconnect():Promise<void>;
}