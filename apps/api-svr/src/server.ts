/** @import - standard imports to start servers */
import express, { Express, Request, Response, Router } from "express";
import cors from "cors";
import { configDotenv } from "dotenv";

/** @import - all local servers */
import {createAPIRouter as APIRouter} from "./routes/api-router.js";
import { createWebSocketSvc, WebSocketService } from "./web-sockets/WebSocketServerImpl.js";

/** @import - shared packages */
import { RedisService, StatementDao, LoggingService, CacheFileOptions, CacheSvc } from "@finalysis-app/shared-utils";
import {replaceTokens} from "@finalysis-app/shared-utils";
import { bootstrapApiServices } from "./bootstrap-svcs.js";

// read the env vars
configDotenv({path:'../../.env'})

// new express server
const app:Express = express();

app.use(cors());

// initialize and boot strap all services
const bootstrap = await bootstrapApiServices();
const logger:LoggingService = bootstrap.loggingSvc;
const redisSvc:RedisService = bootstrap.redisSvc; 
const cachedFile:CacheSvc = bootstrap.cacheSvc;
const statementDao: StatementDao = bootstrap.stmtDao;

// initialize all deps - done
// ------------------------------------------------------------------------------------------------

// run endpoint to test
app.get('/test', async (req:Request, res:Response)=> {
    const apiLogger = logger.getLogger('api-server');
    apiLogger.debug('[START] /test');

    let paddedCIK:string = '2488'.padStart(10, '0');

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
app.use('/api', APIRouter(redisSvc, statementDao, logger));
