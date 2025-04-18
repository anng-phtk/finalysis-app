import { CacheFileOptions, CacheSvc, FilingDataConfig, HTTPStatusCodes, Log, LoggingService, RedisService, SECOperationError, SECOperationFailureCodes } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils/dist/app-config/ApplicationConfig";

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
    const ticker = 'AMD';

    wrkrLogger.debug(`[START] CIK Lookup for 1st item in the queue`)
    try {
    
        const queue = await redisSvc.getCommandClient().blpop(JobsMetadata.JobNames.lookup_cik, 1);
        console.log(queue);

        const lookupFile = await cacheSvc.getFileFromCache(lookUpCIKFileConfig());
        const CIKData = JSON.parse(lookupFile);
        const tickerIndex: number = CIKData.fields.indexOf('ticker');

        if (tickerIndex === -1) throw new SECOperationError('Ticker column is not defined in SEC database. ', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);


        const dataItem = CIKData.data.find((val: string[]) => val[tickerIndex] === ticker.toUpperCase());
        log.debug(`[LOOKUP CIK] ${dataItem.toString()} found`);
        if (!dataItem) {
            log.error(`[LOOKUP CIK] no CIK found for your ticker`);
            throw new SECOperationError('CIK was not found SEC database. Get the latest  mappings from SEC and try again?', HTTPStatusCodes.NotFound, SECOperationFailureCodes.Unknown);
        }
    } catch (error) {
        throw error;
    }
}