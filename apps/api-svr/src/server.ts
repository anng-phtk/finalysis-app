/** @import - standard imports to start servers */
import express, { Express, Request, Response, Router } from "express";
import { configDotenv } from "dotenv";

/** @import - all local servers */
import {createAPIRouter as APIRouter} from "./routes/api-router.js";
import { createWebSocketSvc, WebSocketService } from "./web-sockets/WebSocketServerImpl.js";

/** @import - shared packages */
import { createRedisSvc,  RedisService, RedisServiceConfig} from "@finalysis-app/shared-utils"
import {createRemoteFetchSvc, RemoteFileSvc, RemoteFileSvcConfig } from "@finalysis-app/shared-utils";
import {createLoggerSvc, LoggingService, LoggingServiceConfigOptions} from "@finalysis-app/shared-utils";
import { createCacheSvc, CacheSvc, CacheSvcConfig, CacheFileOptions } from "@finalysis-app/shared-utils";
import {replaceTokens} from "@finalysis-app/shared-utils";

// read the env vars
configDotenv({path:'../../.env'})

// new express server
const app:Express = express();


/**
 * Initialize Logging Service
 */
const loggingOptions:LoggingServiceConfigOptions = {
    env:'dev',
    filename:'api-svc.log',
    type:'both',
    level:'debug',
    maxLogSize:10240,
    backups:2,
    compress:true
}
const logger:LoggingService = createLoggerSvc(loggingOptions);

/**
 * Initialize Redis
 */
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
const redisSvc:RedisService = createRedisSvc(redisConfig, logger); 


/**
 * Initialize the Remote File Fetcher Svc
 * Pass this as a dependency into File Fetcher to get file from remote location if it is not found locally.
 */
const remotefetcher:RemoteFileSvc = createRemoteFetchSvc({
    // url:url,
    retry:3,
    retryDelay:1000,
    backOff:3,
} as RemoteFileSvcConfig, logger); 

/**
 * Initialize fetching file from local disk
 * 
 */
const cachedFileConfig:CacheSvcConfig = {
    cacheBaseDir:'finalysis-app',   // will stay unchanged through out the life of our app
    maxCacheWriteRetry:2
};
const cachedFile:CacheSvc = createCacheSvc(cachedFileConfig, remotefetcher, logger);


// run endpoint to test
app.get('/test', async (req:Request, res:Response)=> {
    const apiLogger = logger.getLogger('api-server');
    apiLogger.debug('[START] /test');

    let paddedCIK:string = '2488'.padStart(10, '0');
    //let url:string = replaceTokens("https://data.sec.gov/submissions/CIK{paddedCIK}.json", {"paddedCIK":'2488'.padStart(10, '0')});

    let url:string = replaceTokens("https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{file}.htm", {
        file:'R1',
        accession:'000000248825000012',
        cik:'2488'
    });

    await cachedFile.getFileFromCache({
        fileName:'R1.htm',
        fileURL:url,
        subDir:'AMD',
        canRefresh:false
    } as CacheFileOptions);
    
    res.status(200).send({
        'success':true,
        'string':`fetched file ${url}`
    });
});

const port:number = Number(process.env.API_SVR_PORT)
const socketport:number = Number(process.env.WS_SVR_PORT);

//start web serverip
app.listen(port, () => {
    (`Api-Svr is listening on ${port}`);
});

// start websocket server
const wss: WebSocketService = createWebSocketSvc(socketport, logger);
//wss.
// start API endpoints
app.use('/api', APIRouter(redisSvc, logger));
