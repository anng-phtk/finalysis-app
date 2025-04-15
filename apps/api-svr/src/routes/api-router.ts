
import { Log, LoggingService, RedisService } from "@finalysis-app/shared-utils";
import express, {Router, Express, Request, Response } from "express";

import {BaseAppError, ValidationError, NotFoundError, AuthenticationError } from "@finalysis-app/shared-utils";

/**
 * function to start a job from ticker to find a CIK
 * @param redisSvc 
 * @returns {Router}
 */
export function createAPIRouter (redisSvc:RedisService, apiLogger:Log):Router {
    const router:Router = express.Router();
    router.get('/v1/cik/:ticker', async (req:Request, res:Response)=> {

        const ticker:string = req.params.ticker ?? '';
        // Basic Sanity Check (Example: Not empty, allows letters, numbers, dot, hyphen)
        const basicTickerRegex = /^[A-Z0-9.-]+$/i; // i for case-insensitive
        if (!ticker || !basicTickerRegex.test(ticker)){ 
            throw new ValidationError(`Validation failed for ticker '${ticker}'.`);
        }
        apiLogger.debug(`received and validated ticker ${ticker}`);

        try {
            apiLogger.debug(`Adding 'ticker':${ticker} in set`);
            await redisSvc.getCommandClient().sadd('tickers', `${ticker}`);
            
            apiLogger.debug(`Publishing a message for our worker to start searching for CIK:fetch for ${ticker}`);
            await redisSvc.getCommandClient().publish('tickers', `${ticker}`);
            
        } catch (error) {
            
        }res.status(200).send({
            success:true,
            message:'success from router',
            data:[0,1,2]
        });
    });
    return router
}