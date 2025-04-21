import { CacheFileOptions, CacheSvc, 
    FilingDataConfig, HTTPStatusCodes, 
    Log, LoggingService, 
    RedisJobsSvc, 
    RedisService, 
    replaceTokens, 
    SECOperationError, SECOperationFailureCodes, 
    JobsMetadata } from "@finalysis-app/shared-utils";


const recentFilingsConfig: CacheFileOptions = {
    fileURL: 'https://data.sec.gov/submissions/CIK{paddedcik}.json',
    fileName: 'CIK{cik}.json',
    subDir: '{ticker}',
    canRefresh:true,
    refreshAfterDays:30 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
}

export const wrkrFetchFilingSummaries = async (redisJobs:RedisJobsSvc, cacheSvc:CacheSvc, wrkrLogger:Log) => {
    try {
        let result:string = await redisJobs.getNextJob(JobsMetadata.JobNames.recent_filings);
        // force the datatype
        let filingsDTO = JSON.parse(result);

        const fileURL = replaceTokens(recentFilingsConfig.fileURL, filingsDTO);
        
        
        //console.log(fileURL);
    }
    catch (error) {
        if (error instanceof SECOperationError) {
            wrkrLogger.error(`[RECOVERABLE]`)
        }
    }
}