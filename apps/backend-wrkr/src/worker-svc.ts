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

const redisLoggerSvc:LoggingService =  createLoggerSvc({
    env:'dev',
    type:'both',
    filename:'redis'
});
const redisSvc:RedisService = createRedisSvc(redisConfig, redisLoggerSvc); 


const loggingOptions:LoggingServiceConfigOptions = {
    env:'dev',
    filename:'worker-svc.log',
    type:'both',
    level:'debug',
    maxLogSize:'10K',
    backups:2,
    compress:true
}

const logger:LoggingService = createLoggerSvc(loggingOptions);
const workerLogger = logger.getLogger('worker');


const channels:string[] = ['ticker']

redisSvc.getSubscriberClient().on('connect', ()=> {
    workerLogger.debug('redis has connected in subscriber mode');

    redisSvc.getSubscriberClient().subscribe(...channels, (err, count)=> {
        workerLogger.debug(`Subscribing to ${count} channels`);

        
    });


    redisSvc.getSubscriberClient().on('message', (channel, message)=> {
        workerLogger.debug(`Got a message from  ${channel} :  ${message}`);
    })
});