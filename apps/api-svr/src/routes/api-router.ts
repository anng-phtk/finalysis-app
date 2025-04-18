
import { HTTPStatusCodes, Log, LoggingService, RedisService, SECOperationError, SECOperationFailureCodes } from "@finalysis-app/shared-utils";
import express, {Router, Express, Request, Response } from "express";

import {BaseAppError, ValidationError, NotFoundError, AuthenticationError } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils/dist/app-config/ApplicationConfig.js";

/**
 * function to start a job from ticker to find a CIK
 * @param {RedisService} redisSvc  
 * @param {LoggingService} loggingSvc
 * @returns {Router}
 */

export function createAPIRouter (redisSvc:RedisService, loggingSvc:LoggingService):Router {
    const router:Router = express.Router();
    const apiLogger:Log = loggingSvc.getLogger('route-logger');

    
    router.get('/v1/lookup/cik/:ticker', async (req:Request, res:Response)=> {
        const ticker:string = (req.params.ticker ?? '').toUpperCase();
        apiLogger.debug(`[START] lookup CIK from ticker ${ticker}`);
        
        try {

            // Basic Sanity Check (Example: Not empty, allows letters, numbers, dot, hyphen)
            //const basicTickerRegex = /^[A-Z0-9.-]+$/i; // basic validation.
            const tickerValidation:RegExp = /^[A-Z]+([\-\.]*)([0-9A-Z]*)$/; // validation for most US based stocks
            
            // if basic sanity does not pass, throw error and get out
            if (!ticker || ticker === '' || !tickerValidation.test(ticker)) { 
                apiLogger.error(`[THROW] Bad ticker ${ticker}. Throwing validation error`);
                throw new ValidationError(`Validation failed for ticker '${ticker}'.`);
            }

            // if validation works, we should check for active jobs
            apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1. check if this ticker is in progress \n\t2. if yes, show 2xx and tell user to check sockets \n\t3. if no, add to active job`);
            
            let activeJob = await redisSvc.getCommandClient().sismember(JobsMetadata.ActiveJobs.ticker,ticker);
            if (activeJob) {
                apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1.Job is in progress.\n\t2. Check job progess on websockets`);
                throw new SECOperationError(`Job is already in progress for ${ticker}`, HTTPStatusCodes.AlreadyReported ,SECOperationFailureCodes.ActiveJobInProgress);
            }
            
            // add the ticker to a set so we work only on unique jobs
            apiLogger.debug(`[IN PROGRESS] REDIS Job: Adding 'ticker':${ticker} in set ${JobsMetadata.ActiveJobs.ticker}`);
            await redisSvc.getCommandClient().sadd(JobsMetadata.ActiveJobs.ticker, ticker);
        
            
            // add a job to lookup cik from ticker
            apiLogger.debug(`[IN PROGRESS] REDIS Job: Adding 'ticker':${ticker} in set set:ticker`);
            await redisSvc.getCommandClient().rpush(JobsMetadata.JobNames.lookup_cik, `${ticker}`);

            // if we accepted the job, return a 200 ok to the user
            apiLogger.debug(`[IN PROGRESS] Success job added; let the use know.`);
            res.status(HTTPStatusCodes.Accepted).send({
                success:true,
                message:'Added ticker to set and started the job to fetch recent filings.',
                data:ticker
            });


            apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1. Accept ticker.\n\t2. Publish the job \n\t3. Update status via set`);
           
        }
        catch (error) {

            if (error instanceof ValidationError) {
                res.status(HTTPStatusCodes.BadRequest).send({
                    success:false,
                    message:'Ticker failed validation',
                    data:ticker
                });
            }
            else if (error instanceof SECOperationError && (error.statusCode === HTTPStatusCodes.AlreadyReported)) {
                res.status(HTTPStatusCodes.AlreadyReported).send({
                    success:true,
                    message:'A download job for this ticker is already in progress.',
                    data:ticker
                });
            }
            else {
                apiLogger.error(`[FAILED] received and validated ticker ${ticker}.\n\t1. Accept ticker.\n\t2. Publish the job \n\t3. Update status via set`);
                res.status(HTTPStatusCodes.InternalServerError).send({
                    success:false,
                    message:'An internal server error occured',
                    data:ticker
                });   
            }
        }
        finally {
            // publish a message (anyone can listen but...) to the worker to start processing our job

            // publish this message in spit of errors as we want to make sure that a job in progress is actively worked on
            // we may get in a situation where a job is on the queue, but a previous message was dropped by the wroker listner.
            // the act of publishing a meesage simply wakes up our workers who will then check if there is a job in the queue that needs work
            apiLogger.debug(`[IN PROGRESS] Publishing a message for our worker to start searching for CIK: ${ticker}`);
            await redisSvc.getCommandClient().publish(JobsMetadata.ChannelNames.lookup_cik, `${ticker}`);
        }
    });


    return router
}