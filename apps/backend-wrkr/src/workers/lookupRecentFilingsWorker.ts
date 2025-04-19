import { CacheFileOptions, CacheSvc, 
    FilingDataConfig, HTTPStatusCodes, 
    Log, LoggingService, 
    RedisService, 
    SECOperationError, SECOperationFailureCodes } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils";


const recent_filing: CacheFileOptions = {
    fileURL: 'https://data.sec.gov/submissions/CIK{paddedcik}.json',
    fileName: 'CIK{cik}.json',
    subDir: '{ticker}',
    canRefresh:true,
    refreshAfterDays:30 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
}

export const wrkrLookupRecentFilings = async (redisSvc:RedisService,cacheSvc:CacheSvc, wrkrLogger:Log) => {
    try {
        let result = await redisSvc.getCommandClient().blpop(JobsMetadata.JobNames.recent_filings,1);
    }
    catch (error) {
        if (error instanceof SECOperationError) {
            wrkrLogger.error(`[RECOVERABLE]`)
        }
    }
}