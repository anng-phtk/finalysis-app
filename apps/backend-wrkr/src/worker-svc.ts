import {CacheSvc, CacheSvcConfig, createCacheSvc, 
    createLoggingSvc, Log, LoggingService, LoggingServiceConfigOptions,
    createRedisSvc, RedisService, RedisServiceConfig,
    createRemoteFetchSvc, RemoteFileSvc, RemoteFileSvcConfig,
    FilingDataConfig,
    JobsMetadata,
    RedisJobsSvc,
    createRedisJobsSvc} from '@finalysis-app/shared-utils';

import { configDotenv } from 'dotenv';
import { wrkrLookupCIK } from './workers/lookupCIK.js';
import { wrkrLookupRecentFilings } from './workers/lookupRecentFilings.js';
import { wrkrFetchFilingSummaries } from './workers/fetchFilingSummaries.js';
import { wrkrFetchStatments } from './workers/fetchStatements.js';

// define env
configDotenv({path:'../../.env'});


// initialize Logger
const loggingOptions:LoggingServiceConfigOptions = {
    env:'dev',
    type:'both',
    level:'debug',
    maxLogSize:10000,
    backups:2,
    compress:true
};
const loggingSvc:LoggingService = createLoggingSvc(loggingOptions);
// is this needed here?


// init Redis Connection
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
const redisSvc:RedisService = createRedisSvc(redisConfig, loggingSvc); 
const redisJobSvc:RedisJobsSvc = createRedisJobsSvc(redisSvc, loggingSvc);


// initialize remoteFile fetcher, its needed for our cache file fetcher
const fetchConfig:RemoteFileSvcConfig = {
    timeout:2000,
    retryDelay:1000,
    retry:3,
    backOff:2
};
const remotefetchSvc:RemoteFileSvc = createRemoteFetchSvc(fetchConfig, loggingSvc);

// initialize local cache fetching
const cacheConfig:CacheSvcConfig = {
    cacheBaseDir:'finalysis-app',
    maxCacheWriteRetry:2,
};
const fileSvc:CacheSvc = createCacheSvc(cacheConfig, remotefetchSvc,loggingSvc);
// --------------- done



// start worker-listener and listen on these channels:
const channels:string[] = [];
Object.values(JobsMetadata.ChannelNames).forEach(val => {
    channels.push(val)
})
console.debug(channels);


/**
 * @todo -  move this to its own class and factory function. then call it here and pass all the dependencies into it
 * 
 * */ 
redisSvc.getSubscriberClient().on('connect', ()=> {
    // this wrkrLogger must be passed in
    const wrkrLogger:Log = loggingSvc.getLogger('worker-svc');

    wrkrLogger.debug('redis has connected in subscriber mode');
    wrkrLogger.debug(`subscribing to ${channels}`);
    redisSvc.getSubscriberClient().subscribe(...channels, (err, count)=> {
        wrkrLogger.debug(`Subscribing to ${count} channels`);        
    });

    redisSvc.getSubscriberClient().on('message', (channel, message)=> {
        if (!message || message === '') {
            wrkrLogger.error(`[LISTENING FOR MESSAGE] Got an empty message from  ${channel} :  ${message}`);
            //throw new Error('Message does not have a valid job');
        }
        wrkrLogger.debug(`Got a message from  ${channel} :  ${message}`);
        
        switch (channel) {
            case JobsMetadata.ChannelNames.lookup_cik:
                wrkrLogger.debug(`[CALL Worker]: wrkrLookupCIK(${message})`);
                    // start the call
                wrkrLookupCIK(redisSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.recent_filings:
                wrkrLogger.debug(`[CALL Worker]:wrkrLookupRecentFilings(${message})`);

                // start the call
                wrkrLookupRecentFilings(redisJobSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.fetch_summaries:
                wrkrLogger.debug(`[CALL Worker]:fetchFilingSummaries(${message})`);

                // start the call
                wrkrFetchFilingSummaries(redisJobSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.fetch_financial_stmts:
                wrkrLogger.debug(`[CALL Worker]:fetchFilingSummaries(${message})`);

                // start the call
                wrkrFetchStatments(redisJobSvc, fileSvc, wrkrLogger);
            break;
        }
    })
});
