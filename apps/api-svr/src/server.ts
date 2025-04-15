/** @import - standard imports to start servers */
import express, { Express, Request, Response, Router } from "express";
import { configDotenv } from "dotenv";

/** @import - all local servers */
import {createAPIRouter as APIRouter} from "./routes/api-router.js";
import { createSocketServer } from "./web-sockets/web-socket-server.js";

/** @import - shared packages */
import { RedisServiceConfig, RedisService, createRedisSvc, replaceTokens, createRemoteFetchSvc } from "@finalysis-app/shared-utils";
import {createLoggerSvc, LoggingService, LoggingServiceConfigOptions} from "@finalysis-app/shared-utils";
import { RemoteFileSvcConfig } from "@finalysis-app/shared-utils/dist/utils/remotefetch.types.js";

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

    const fileSvc = createRemoteFetchSvc({
        url:url,
        retryDelay:1000,
        retry:3,
        backOff:2,
        timeout:3000
    } as RemoteFileSvcConfig,
    createLoggerSvc({
        type:"both",
        env:"dev",
        filename:'remote-fetch',
        maxLogSize:102400,
        compress:true,
        backups:2
    }));
    let content:string = await fileSvc.getRemoteFile();
    console.log(content.substring(0,100));
    res.status(200).send({
        'success':true,
        'string':`fetched file ${url}`
    });
});

const [port, socketport] = [3000, 3001];

//start web serverip
app.listen(port, () => {
    (`Api-Svr is listening on ${port}`);
});

// start websocket server
createSocketServer(socketport);
// start API endpoints
app.use('/api', APIRouter(redisSvc, apiLogger));
