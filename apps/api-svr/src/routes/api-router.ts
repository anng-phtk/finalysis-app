
import { HTTPStatusCodes, Log, LoggingService, RedisService, SECOperationError, SECOperationFailureCodes, StatementDao, StatementDoc, StatementTypes } from "@finalysis-app/shared-utils";
import express, { Router, Express, Request, Response, response } from "express";

import { ValidationError, NotFoundError, AuthenticationError } from "@finalysis-app/shared-utils";
import { JobsMetadata, MessageConfig } from "@finalysis-app/shared-utils";

/**
 * function to start a job from ticker to find a CIK
 * @param {RedisService} redisSvc  
 * @param {LoggingService} loggingSvc
 * @returns {Router}
 */

export function createAPIRouter(redisSvc: RedisService, stmtDao: StatementDao, loggingSvc: LoggingService): Router {
    const router: Router = express.Router();
    const apiLogger: Log = loggingSvc.getLogger('route-logger');


    router.get('/v1/lookup/cik/:ticker', async (req: Request, res: Response) => {
        const ticker: string = (req.params.ticker ?? '').toUpperCase();
        apiLogger.debug(`[START] lookup CIK from ticker ${ticker}`);

        try {

            // Basic Sanity Check (Example: Not empty, allows letters, numbers, dot, hyphen)
            //const basicTickerRegex = /^[A-Z0-9.-]+$/i; // basic validation.
            const tickerValidation: RegExp = /^[A-Z]+([\-\.]*)([0-9A-Z]*)$/; // validation for most US based stocks

            // if basic sanity does not pass, throw error and get out
            if (!ticker || ticker === '' || !tickerValidation.test(ticker)) {
                apiLogger.error(`[THROW] Bad ticker ${ticker}. Throwing validation error`);
                throw new ValidationError(`Validation failed for ticker '${ticker}'.`);
            }

            // if validation works, we should check for active jobs
            apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1. check if this ticker is in progress \n\t2. if yes, show 2xx and tell user to check sockets \n\t3. if no, add to active job`);

            let dedupeCheckFlag: boolean = (process.env.JOB_DEDUPE_FLAG === "true") ? true : false;
            apiLogger.debug(`Setting the check for duplicate job to ${dedupeCheckFlag}. \n\tprocess.env.JOB_DEDUPE_FLAG=${process.env.JOB_DEDUPE_FLAG}\n\ttoggle value in .env`);

            if (dedupeCheckFlag) {
                let activeJob = await redisSvc.getCommandClient().sismember(JobsMetadata.ActiveJobs.ticker, ticker);
                if (activeJob) {
                    apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1.Job is in progress.\n\t2. Check job progess on websockets`);
                    throw new SECOperationError(`Job is already in progress for ${ticker}`, HTTPStatusCodes.AlreadyReported, SECOperationFailureCodes.ActiveJobInProgress);
                }
            }

            // add the ticker to a set so we work only on unique jobs
            apiLogger.debug(`[IN PROGRESS] REDIS Job: Adding 'ticker':${ticker} in set ${JobsMetadata.ActiveJobs.ticker}`);
            await redisSvc.getCommandClient().sadd(JobsMetadata.ActiveJobs.ticker, ticker);


            // add a job to lookup cik from ticker
            apiLogger.debug(`[IN PROGRESS] REDIS Job: Adding 'ticker':${ticker} in set set:ticker`);
            const job = {
                ticker: ticker
            }
            await redisSvc.getCommandClient().rpush(JobsMetadata.JobNames.lookup_cik, JSON.stringify(job));

            // if we accepted the job, return a 200 ok to the user
            apiLogger.debug(`[IN PROGRESS] Success job added; let the use know.`);
            res.status(HTTPStatusCodes.Accepted).send({
                success: true,
                message: 'Added ticker to set and started the job to fetch recent filings.',
                data: ticker
            });


            apiLogger.debug(`[IN PROGRESS] received and validated ticker ${ticker}.\n\t1. Accept ticker.\n\t2. Publish the job \n\t3. Update status via set`);

        }
        catch (error) {

            if (error instanceof ValidationError) {
                res.status(HTTPStatusCodes.BadRequest).send({
                    success: false,
                    message: 'Ticker failed validation',
                    data: ticker
                });
            }
            else if (error instanceof SECOperationError && (error.statusCode === HTTPStatusCodes.AlreadyReported)) {
                res.status(HTTPStatusCodes.AlreadyReported).send({
                    success: true,
                    message: 'A download job for this ticker is already in progress.',
                    data: ticker
                });
            }
            else {
                apiLogger.error(`[FAILED] received and validated ticker ${ticker}.\n\t1. Accept ticker.\n\t2. Publish the job \n\t3. Update status via set`);
                res.status(HTTPStatusCodes.InternalServerError).send({
                    success: false,
                    message: 'An internal server error occured',
                    data: ticker
                });
            }
        }
        /**
         * We are no longer running a listener on the worker side. 
         * Instead we will be running an endless loop
         *  
        finally {
            // publish a message (anyone can listen but...) to the worker to start processing our job

            // publish this message in spit of errors as we want to make sure that a job in progress is actively worked on
            // we may get in a situation where a job is on the queue, but a previous message was dropped by the wroker listner.
            // the act of publishing a meesage simply wakes up our workers who will then check if there is a job in the queue that needs work
            apiLogger.debug(`[IN PROGRESS] Publishing a message for our worker to start searching for CIK: ${ticker}`);
            await redisSvc.getCommandClient().publish(JobsMetadata.ChannelNames.lookup_cik, `${ticker}`);
        }
        */
    });

    router.get('/v1/statements/:ticker', async (req: Request, res: Response) => {
        const ticker: string = (req.params.ticker ?? '').toUpperCase();
        const stmtType = req.query.type as string | undefined;
        const formType = req.query.formType as string | '';     // todo: integrate
        const limit = parseInt(req.query.limit as string || '50', 10);
        const sortParam = req.query.sort as string || 'desc';
        const sortOrder = sortParam.toLowerCase() === 'asc' ? 1 : -1;

        apiLogger.debug(`[START] fetchting ${stmtType} for ${ticker}`);
        try {

            // Basic Sanity Check (Example: Not empty, allows letters, numbers, dot, hyphen)
            //const basicTickerRegex = /^[A-Z0-9.-]+$/i; // basic validation.
            const tickerValidation: RegExp = /^[A-Z]+([\-\.]*)([0-9A-Z]*)$/; // validation for most US based stocks

            // if basic sanity does not pass, throw error and get out
            if (!ticker || ticker === '' || !tickerValidation.test(ticker)) {
                apiLogger.error(`[THROW] Bad ticker ${ticker}. Throwing validation error`);
                throw new ValidationError(`Validation failed for ticker '${ticker}'.`);
            }

            // which statement does the client want?
            if (!stmtType ) {
                apiLogger.error(`[THROW] Statement type was not specified`);
                throw new ValidationError(`Validation failed, Statement Type was '${stmtType}'.`);
            }

            console.log(`Got ${stmtType}`)
            let statementType:StatementTypes;
            switch (stmtType.toLowerCase()) {
                case (StatementTypes.equity):
                    statementType = StatementTypes.equity;
                    break;
                case (StatementTypes.income):
                    statementType = StatementTypes.income;
                    break;
                case (StatementTypes.cashflow):
                    statementType = StatementTypes.cashflow;
                    break;
                case (StatementTypes.balance):
                default:
                    statementType = StatementTypes.balance;
            }

            // Call the DAO method with parameters from the request
            const statements: StatementDoc[] = await stmtDao.findStatementsByTicker(
                ticker,
                statementType,
                formType,
                limit,
                sortOrder
            );

            if (!statements || statements.length === 0) {
                apiLogger.warn(`No statements found for ticker: ${ticker}`, { statementType });
                // Send 404 if nothing found for the specific query
                // Use MessageConfig for consistency
                const notFoundMsg: MessageConfig = {
                    statusCode: HTTPStatusCodes.NotFound,
                    messageTxt: `No statements found for ticker ${ticker}` + (statementType ? ` of type ${statementType}` : ''),
                    msgType: 'info', // Or 'warning'
                    data: []
                };
                res.status(HTTPStatusCodes.NotFound).json(notFoundMsg);
            }

            // Construct the success response using MessageConfig
            const successMsg: MessageConfig = {
                statusCode: HTTPStatusCodes.OK,
                messageTxt: `Statements retrieved successfully for ${ticker}`,
                msgType: 'success', // Example type
                data: statements // Embed the actual data
            };

            // Send successful response with the data using the standard structure
            res.type('application/json');
            res.status(HTTPStatusCodes.OK).json(successMsg);
            
        }
        catch (error) {
            if (error instanceof ValidationError) {

                // helps with standard messaging
                let errorMsgDetail: MessageConfig = {
                    messageTxt: error.message,
                    statusCode: HTTPStatusCodes.BadRequest
                };

                res.status(HTTPStatusCodes.BadRequest).json(errorMsgDetail);
            }
        }
    });

    // return the router
    return router;
}