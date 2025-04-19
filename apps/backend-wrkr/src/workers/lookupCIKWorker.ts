import { CacheFileOptions, CacheSvc, FilingDataConfig, HTTPStatusCodes, Log, LoggingService, RedisService, SECOperationError, SECOperationFailureCodes } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils";

const lookUpCIKFileConfig = ():CacheFileOptions => {
    return {
        subDir: './', 
        fileName:'company_tickers_exchange.json',
        fileURL: 'https://www.sec.gov/files/company_tickers_exchange.json',
        canRefresh:true,
        refreshAfterDays:120 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
    } as CacheFileOptions
}



export const wrkrLookupCIK = async (redisSvc:RedisService,cacheSvc:CacheSvc, wrkrLogger:Log) => {
    const log:Log = wrkrLogger;
    let ticker:string = '';

    wrkrLogger.debug(`[START] CIK Lookup for 1st item in the queue`)
    try {
    
        const result = await redisSvc.getCommandClient().blpop(JobsMetadata.JobNames.lookup_cik, 1);
        if (!result) throw new SECOperationError('Job cannot be parsed', HTTPStatusCodes.NotAcceptable, SECOperationFailureCodes.Unknown);
        
        let [queueName,job] = result;
        
        ticker = JSON.parse(job).ticker;

        const lookupFile = await cacheSvc.getFileFromCache(lookUpCIKFileConfig());
        const CIKData = JSON.parse(lookupFile);
        const tickerIndex: number = CIKData.fields.indexOf('ticker');

        if (tickerIndex === -1) throw new SECOperationError('Ticker column is not defined in SEC database. ', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);

        const dataItem = CIKData.data.find((val: string[]) => val[tickerIndex] === ticker.toUpperCase());
        log.debug(`[LOOKUP CIK] ${dataItem.toString()} found`);

        if (!dataItem) {
            log.error(`[THROWING ERROR] No CIK found for your ticker`);
            throw new SECOperationError('CIK was not found SEC database. Get the latest  mappings from SEC and try again?', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);
        }

        let [cik, foundTicker, name, exchange] = dataItem
        const filingDataDTO:FilingDataConfig = {
            ticker:foundTicker, 
            cik:cik,
            name:name, 
            exchange:exchange};

        await redisSvc.getCommandClient().rpush(JobsMetadata.JobNames.recent_filings, JSON.stringify(filingDataDTO));

    } catch (error) {
        if (error instanceof SECOperationError && error.statusCode === HTTPStatusCodes.NotFound) {
            redisSvc.getCommandClient().publish(ticker, `{
                    "message":"${error.message}",
                    "statusCode":"${error.statusCode}",
                    "detail": "${error}"
                }`);

                log.error(`${error.message}`);
        }
        else if (error instanceof SECOperationError && error.statusCode === HTTPStatusCodes.NotAcceptable) {
            redisSvc.getCommandClient().publish(ticker, `{
                "message":"${error.message}",
                "statusCode":"${error.statusCode}",
                "detail": "${error}"
            }`);
            log.error(`${error.message}`);
        }
        else {
            log.error(`[UNRECOVERABLE] Generic error: ${error}`);
            throw error;
        }
        
    }
}