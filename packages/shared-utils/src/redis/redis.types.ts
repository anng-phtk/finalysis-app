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
     * @returns {Promise<void>} - disconnection returns a promise to close connection */
    disconnect():Promise<void>;
}



export interface RedisJobsSvc {
    /** @returns {Promise<string>} - gets the redis in queue manager */
    getNextJob(jobName:string):Promise<string|null>
    addJob(jobName:string, jobData:string):Promise<void>
    clearActiveTicker(ticker:string):void
    publishJob(channelName:string, message:string):Promise<void>
}