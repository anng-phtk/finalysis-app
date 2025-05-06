import { CacheFileOptions, CacheSvc, FilingDataConfig, HTTPStatusCodes, Log, 
    RedisJobsSvc, RedisSvcError, SECOperationError } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils";
import { SECOperationFailureCodes } from "@finalysis-app/shared-utils/dist/app-config/ApplicationConfig.js";

const lookUpCIKFileConfig = ():CacheFileOptions => {
    return {
        subDir: './', 
        fileName:'company_tickers_exchange.json',
        fileURL: 'https://www.sec.gov/files/company_tickers_exchange.json',
        canRefresh:true,
        refreshAfterDays:120 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
    } as CacheFileOptions
}


export const wrkrLookupCIK = async (redisJobs: RedisJobsSvc, cacheSvc: CacheSvc, wrkrLogger:Log):Promise<boolean> => {
    let ticker:string = '';

   
    try {
    
        const result:string|null = await redisJobs.getNextJob(JobsMetadata.JobNames.lookup_cik);

        if (!result) {
            wrkrLogger.warn('[wrkrLookupCIK] No more jobs');
            return false;
            // unreachable - we can infer no work to do
            // throw new RedisSvcError('No more jobs', HTTPStatusCodes.NoContent, "No jobs to process");
        }

        wrkrLogger.debug(`[START] wrkrLookupCIK: CIK Lookup for 1st item in the queue`)
        ticker = JSON.parse(result).ticker;
        
        const lookupFile = await cacheSvc.getFileFromCache(lookUpCIKFileConfig());
        

        const CIKData = JSON.parse(lookupFile);
        const tickerIndex: number = CIKData.fields.indexOf('ticker');

        if (tickerIndex === -1) throw new SECOperationError('Ticker column is not defined in SEC database. ', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);
        

        //const dataItem = CIKData.data.find((val: string[]) => val[tickerIndex] === ticker);
        
        let dataItem:string[] = [];

        for (let foundTicker of CIKData.data) {
            if (foundTicker[tickerIndex] === ticker) {
                dataItem = foundTicker;
                break;
            }
        }

        //wrkrLogger.debug(`[LOOKUP CIK] ${dataItem} found`);

        console.log(dataItem);

        if (!dataItem) {
            wrkrLogger.error(`[THROWING ERROR] No CIK found for your ticker`);
            throw new SECOperationError('CIK was not found SEC database. Get the latest  mappings from SEC and try again?', HTTPStatusCodes.NoContent, SECOperationFailureCodes.TickerNotFound);
        }

        let [cik, name, foundTicker, exchange] = dataItem
        if (!cik) throw new SECOperationError('CIK was not found SEC database.Check ticker and try again?', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);
        let paddedCIK = (cik.toString()).padStart(10, '0');


        // make sure our data is according to the DTO object
        const filingDataDTO:FilingDataConfig = {
            ticker:foundTicker, 
            cik:cik,
            name:name, 
            exchange:exchange,
            paddedcik:paddedCIK
        
        };
        //stringify the object and store in the next job queue
        const filingDataStr:string = JSON.stringify(filingDataDTO);
        
        wrkrLogger.info(`[New JOB] adding Job: ${JobsMetadata.JobNames.recent_filings} : details ${filingDataStr}`);
        await  redisJobs.addJob(JobsMetadata.JobNames.recent_filings, filingDataStr);

        wrkrLogger.info(`[MESSAGE] channel: ${JobsMetadata.ChannelNames.recent_filings} : details ${filingDataStr}`);
        await redisJobs.publishJob(ticker, `{
            "messageType":"CIK Lookup",
            "statusCode": ${HTTPStatusCodes.Found},
            "message":"Found ${filingDataDTO.cik} for ${ticker}"
            }`);

        return true;
    } catch (error) {
        if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NotFound) {
            await redisJobs.publishJob(ticker, `{
                    "messageType":"CIK Lookup",
                    "message":"Internal server error prevented worker from processing this job",
                    "statusCode":"${error.statusCode}",
                    "data": "${error.message}"
                }`);

                wrkrLogger.error(`${error.message}`);
        }
        else if (error instanceof SECOperationError && error.statusCode === HTTPStatusCodes.NotAcceptable) {
            redisJobs.publishJob(ticker, `{
                "message":"${error.message}",
                "statusCode":"${error.statusCode}",
                "messageType": "CIK Lookup"
            }`);
            wrkrLogger.error(`Logging: ${error.message}`);
        }
        else if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NoContent) {
            redisJobs.publishJob(ticker, `{
                "message":"${error.message}",
                "statusCode":"${error.statusCode}",
                "detail": "${error}"
            }`);
            wrkrLogger.error(`Logging: ${error.message}`);
        }
        else {
            wrkrLogger.error(`[UNRECOVERABLE] Generic error.`);
            await redisJobs.publishJob(ticker, `{
                    "messageType":"CIK Lookup",
                    "message":"SEC could not find a CIK code for ${ticker}",
                    "statusCode":"${HTTPStatusCodes.NotFound}",
                    "data": "${error}"
                }`);
            throw error;
        }

        return false;
    }

    
}