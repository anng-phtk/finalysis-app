import {createLoggerSvc, createRedisSvc, Log, LoggingService, LoggingServiceConfigOptions, RedisService, RedisServiceConfig} from '@finalysis-app/shared-utils';
import { configDotenv } from 'dotenv';

configDotenv({path:'../../.env'});

const redisConfig:RedisServiceConfig= {
    commandConnectionOptions: {
        host:process.env.REDIS_HOST, 
        port: Number(process.env.REDIS_PORT)
    },
    subscriberOptions: {
        host:process.env.REDIS_HOST, 
        port: Number(process.env.REDIS_PORT)
    }
};


const loggingOptions:LoggingServiceConfigOptions = {
    env:'dev',
    type:'both',
    level:'debug',
    maxLogSize:10000,
    backups:2,
    compress:true
}

const wrkrLoggerSvc:LoggingService = createLoggerSvc(loggingOptions);
const redisSvc:RedisService = createRedisSvc(redisConfig, wrkrLoggerSvc); 
const workerLogger = wrkrLoggerSvc.getLogger('worker-svc');
    

const channels:string[] = ['ticker:cik']
redisSvc.getSubscriberClient().on('connect', ()=> {

    workerLogger.debug('redis has connected in subscriber mode');

    redisSvc.getSubscriberClient().subscribe(...channels, (err, count)=> {
        workerLogger.debug(`Subscribing to ${count} channels`);        
    });

    redisSvc.getSubscriberClient().on('message', (channel, message)=> {
        workerLogger.debug(`Got a message from  ${channel} :  ${message}`);
    })
});