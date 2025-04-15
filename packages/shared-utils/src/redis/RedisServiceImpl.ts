import { RedisServiceConfig, RedisService } from "./redis.types.js";
import { Redis, RedisOptions } from "ioredis";
import { Log, LoggingService } from "../logging/logging.types.js";
import { createLoggerSvc } from "../logging/LoggingSvcImpl.js";
/**
 * this is our service for connecting to redis either in command-mode or subscriber-mode.
 * @param {RedisServiceConfig} config 
 * @param {Logger}? logger // no logger yet, we will create one later
 * @returns {RedisService}
 */

class RedisServiceImpl implements RedisService {
    private commandClient:Redis;
    private subscriberClient:Redis;
    private log:Log;
    
    /** @todo: private logger: // no logger yet */
    public constructor(config:RedisServiceConfig, logger:LoggingService) {
        this.log = logger.getLogger('redis');
        // create command client
        this.commandClient = new Redis(config.commandConnectionOptions);
        
        // create a subscriber mode 
        this.subscriberClient = new Redis(config.subscriberOptions??config.commandConnectionOptions);

        // attach and register listenrs
        this.registerListeners()
    }

    /**
     * @implements {getCommandClient} // 
     */
    public getCommandClient(): Redis {
        return this.commandClient;
    }

    /**
     * @implements {getSubscriberClient} 
     */
    public getSubscriberClient(): Redis {
        return this.subscriberClient;
    }

    /** 
     * @todo {logger} // implement logger
     * @implements {disconnect} // disconnect both clients
     */
    public async disconnect(): Promise<void> {
        await Promise.all([this.commandClient.quit(), this.subscriberClient.quit()]).catch(()=> {
            this.log.debug(`Disconnecting Redis command client and subscriber client`);
        });
    }

    private registerListeners():void {
        this.commandClient.on('connecting', ()=> {
            this.log.debug(`[Redis Command Client]: connecting `);
        });
        this.commandClient.on('connect', ()=> {
            this.log.debug(`[Redis Command Client]: connected `);
        });
        
        this.commandClient.on('reconnecting', ()=> {
            this.log.debug(`[Redis Command Client]: reconnecting `);
        });
        
        this.commandClient.on('error', (error:Error) => {
            this.log.debug(`[Redis Command Client]: encountered an error. ${error} `);
        });
        this.commandClient.on('ready', ()=> {
            this.log.debug(`[Redis Command Client]: connection is ready.`);
        });
        
        this.commandClient.on('close', ()=> {
            this.log.debug(`[Redis Command Client]: closed `);
        });
        this.commandClient.on('end', ()=> {
            this.log.debug(`[Redis Command Client]: session ended.`);
        });


        // subscriber client
        this.subscriberClient.on('connecting', ()=> {
            this.log.debug(`[Redis Subscriber Client]: connecting `);
        });
        this.subscriberClient.on('connect', ()=> {
            this.log.debug(`[Redis Subscriber Client]: connected `);
        });
        this.subscriberClient.on('reconnecting', ()=> {
            this.log.debug(`[Redis Subscriber Client]: reconnecting `);
        });
        this.subscriberClient.on('error', (error:Error) => {
            this.log.debug(`[Redis Subscriber Client]: encountered an error. ${error} `);
        });
        this.subscriberClient.on('ready', ()=> {
            this.log.debug(`[Redis Subscriber Client]: connection is ready.`);
        });
        this.subscriberClient.on('close', ()=> {
            this.log.debug(`[Redis Subscriber Client]: closed `);
        });
        this.subscriberClient.on('end', ()=> {
            this.log.debug(`[Redis Subscriber Client]: session ended.`);
        });
    }

}

// control instance creation
let redisSvsInstance:RedisService|null;
export function createRedisSvc(config:RedisServiceConfig, logger:LoggingService):RedisService {
    if (!redisSvsInstance) redisSvsInstance = new RedisServiceImpl(config, logger);
    return redisSvsInstance;
}