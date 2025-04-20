import { CacheFileOptions, CacheSvc, 
    FilingDataConfig, HTTPStatusCodes, 
    Log, LoggingService, 
    RedisJobsSvc, 
    RedisService, 
    replaceTokens, 
    SECOperationError, SECOperationFailureCodes } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils";




export const wrkrLookupRecentFilings = async (redisJobSvc:RedisJobsSvc,cacheSvc:CacheSvc, wrkrLogger:Log) => {
    let ticker:string = '';
    try {
        let result:string = await redisJobSvc.getNextJob(JobsMetadata.JobNames.recent_filings);
                
        // force the datatype
        let filingsDTO = JSON.parse(result);
        ticker = filingsDTO.ticker;
        
        const filingDetailsConfig: CacheFileOptions = {
            fileURL: replaceTokens('https://data.sec.gov/submissions/CIK{paddedcik}.json', filingsDTO),
            fileName: replaceTokens('CIK{cik}.json',filingsDTO),
            subDir: replaceTokens('{ticker}', filingsDTO),
            canRefresh:true,
            refreshAfterDays:30 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
        }
        wrkrLogger.info(`[RECENT FILINGS] : filingDetailsConfig contains values:  
            \n\tfileURL: ${filingDetailsConfig.fileURL},
            \n\tfileName: ${filingDetailsConfig.fileName}, 
            \n\tsubdir: ${filingDetailsConfig.subDir} 
            \nGetting recentFiling data from SEC.`);

        const filingDetailsStr:string = await cacheSvc.getFileFromCache(filingDetailsConfig);
        if (!filingDetailsStr) {
                throw new SECOperationError(`No JSON data for ${filingsDTO.ticker}. Check if data is available at ${filingDetailsConfig.fileURL} `, HTTPStatusCodes.BadRequest, SECOperationFailureCodes.Unknown);
        }
        const recentFilings = JSON.parse(filingDetailsStr).filings.recent;
        const filings:{
            accession: string;
            formType: string;
            filingDate: string;
        }[] = [];
        recentFilings.form.forEach((formType: string, index: number) => {
            if (formType === "10-K" || formType === "10-Q") {
                filings.push({
                    accession: recentFilings.accessionNumber[index].replace(/-/g, ''),
                    formType: formType,
                    filingDate: recentFilings.filingDate[index]
                });
            }
        });
    }
    catch (error) {
        if (error instanceof SECOperationError) {
            wrkrLogger.error(`[RECOVERABLE]: Check ${ticker} exists and try again`);
            // make sure to remove ticker from active tickers list
            await redisJobSvc.clearActiveTicker(ticker);
        }
    }
}