/** @import - standard imports to start servers */
import express, { Express, Request, Response, Router } from "express";
import { configDotenv } from "dotenv";

/** @import - all local servers */
import {createAPIRouter as APIRouter} from "./routes/api-router.js";
import { createSocketServer } from "./web-sockets/web-socket-server.js";

/** @import - shared packages */
import { RedisServiceConfig, RedisService, createRedisSvc, replaceTokens, createRemoteFetchSvc } from "@finalysis-app/shared-utils";
import {createLoggerSvc, LoggingService, LoggingServiceConfigOptions} from "@finalysis-app/shared-utils";
import { RemoteFileSvcConfig } from "@finalysis-app/shared-utils";
import { CacheSvc, CacheSvcConfig, CacheSvcImpl } from "@finalysis-app/shared-utils";
import { homedir } from "os";
import path from "path";

configDotenv({path:'../../.env'})

const app:Express = express();
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
    filename:'api-svc.log',
    type:'both',
    level:'debug',
    maxLogSize:10240,
    backups:2,
    compress:true
}
const logger:LoggingService = createLoggerSvc(loggingOptions);
const apiLogger = logger.getLogger('apiserver');

app.get('/test', async (req:Request, res:Response)=> {
    apiLogger.debug('debug', 'test my log');

    let paddedCIK:string = '2488'.padStart(10, '0');
    //let url:string = replaceTokens("https://data.sec.gov/submissions/CIK{paddedCIK}.json", {"paddedCIK":'2488'.padStart(10, '0')});
    let url:string = replaceTokens("https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{file}.htm", {
        file:'R1',
        accession:'000000248825000012',
        cik:'2488'
    });

    const dirPath = homedir();
    const cachedFileConfig:CacheSvcConfig = {
        cacheDir:"AMD",
        fileName:'R1.htm',
        fileURL:url,
        refreshAfter:300
    }
    const cacheLogger:LoggingService = createLoggerSvc({
        type:'both',
        env:'dev'
    });
    const cachedFile = new CacheSvcImpl(cachedFileConfig, cacheLogger);
    cachedFile.getFileFromCache();
    
    res.status(200).send({
        'success':true,
        'string':`fetched file ${url}`
    });
});

const port:number = Number(process.env.API_SVR_PORT) || 3000
const socketport:number = Number(process.env.WS_SVR_PORT) || 3001;

//start web serverip
app.listen(port, () => {
    (`Api-Svr is listening on ${port}`);
});

// start websocket server
createSocketServer(socketport);
// start API endpoints
app.use('/api', APIRouter(redisSvc, apiLogger));
