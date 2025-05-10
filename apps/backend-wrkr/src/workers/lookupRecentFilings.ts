import { CacheFileOptions, CacheSvc, 
    FilingDataConfig, HTTPStatusCodes, 
    Log, LoggingService, 
    RedisJobsSvc, 
    RedisService, 
    RedisSvcError, 
    replaceTokens, 
    SECOperationError } from "@finalysis-app/shared-utils";
import { JobsMetadata } from "@finalysis-app/shared-utils";



export const wrkrLookupRecentFilings = async (redisJobSvc:RedisJobsSvc,cacheSvc:CacheSvc, wrkrLogger:Log):Promise<boolean> => {
    let ticker:string = '';
    try {
        let result:string|null = await redisJobSvc.getNextJob(JobsMetadata.JobNames.recent_filings);
        // a no result likely means we drained the queue of all 10Ks 
        if (!result) {
        
            wrkrLogger.warn('[wrkrLookupRecentFilings] No more jobs');
            
            // unreachble code, but we can decide to comment it out later
            throw new RedisSvcError('No more 10K or 10Q documents to fetch', HTTPStatusCodes.NoContent, 'NoMore10KsOr10Qs');
        } 

        // force the datatype?
        let filingsObj = JSON.parse(result);
        ticker = filingsObj.ticker;
        

        //rehydrate all the tokens and prepare to fetch the json from SEC
        const filingDetailsConfig: CacheFileOptions = {
            fileURL: replaceTokens('https://data.sec.gov/submissions/CIK{paddedcik}.json', filingsObj),
            fileName: replaceTokens('CIK{cik}.json',filingsObj),
            subDir: filingsObj.ticker,
            canRefresh:true,
            refreshAfterDays:30 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
        }

        // log it
        wrkrLogger.info(`[RECENT FILINGS] : filingDetailsConfig contains values:  
            \tfileURL: ${filingDetailsConfig.fileURL},
            \tfileName: ${filingDetailsConfig.fileName}, 
            \tsubdir: ${filingDetailsConfig.subDir} 
            Getting recentFiling data from SEC.`);

        // get recentFilings
        const filingDetailsStr:string = await cacheSvc.getFileFromCache(filingDetailsConfig);

        if (!filingDetailsStr) {
                throw new SECOperationError(`No JSON data for ${filingsObj.ticker}. 
                    Check if data is available at ${filingDetailsConfig.fileURL} `, 
                    HTTPStatusCodes.BadRequest, 'BadTickerOrCIK');
        }

        // START capturing the recent filings from json doc
        const jsonDataDoc = JSON.parse(filingDetailsStr);
        const recentFilings = jsonDataDoc.filings.recent;
        
        recentFilings.form.forEach((formType: string, index: number) => {
           if (formType === '10-K' || formType === '10-Q') {
            wrkrLogger.debug(`[LOOPING] looking for 10K and 10q in recent filings ${formType}`);
                let temp:FilingDataConfig = {
                    ticker:filingsObj.ticker,
                    cik:filingsObj.cik,
                    name:filingsObj.name,
                    exchange:filingsObj.exchange,
                    paddedcik:filingsObj.paddedCIK,
                    sic: jsonDataDoc.sic,
                    sicDescription:jsonDataDoc.sicDescription,
                    accession:String(recentFilings.accessionNumber[index]).replace(/\-/g, ''),
                    formType:formType,
                    filingDate:recentFilings.filingDate[index]
                };
               
                //wrkrLogger.debug(`${filingDoc.sic} ${recentFilings.accessionNumber[index]}`);
                wrkrLogger.debug(`adding Jobs to Redis`);
                redisJobSvc.addJob(JobsMetadata.JobNames.fetch_summaries, JSON.stringify(temp));
            }
        });

        // post an interim update for the client
        await redisJobSvc.publishJob(ticker, `{
            "messageType":"Lookup Recent Filings",
            "status":"success",
            "message":"Found Accession Numbers 10K and 10Q for ${ticker}"}`);
        return true;
    }
    catch (error) {
            if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NoContent) {
                // we are ok here. probably no more jobs left to process.
                wrkrLogger.error(`[RECOVERABLE]: Check if ${ticker} exists and try again. We could not find any SEC documents for this ticker`);
                await redisJobSvc.publishJob(ticker, `{
                    "messageType":"Lookup Recent Filings",
                    "status":"${error.statusCode}",
                    "message":"No more recent filings for  ${ticker}
                    }`);
            }
            else {
                await redisJobSvc.clearActiveTicker(ticker);
                wrkrLogger.error(`[UNRECOVERABLE]: Remove ${ticker} from active tickers list`);
               
                await redisJobSvc.publishJob(ticker, `{
                    "messageType":"Lookup Recent Filings",
                    "status":"${HTTPStatusCodes.InternalServerError}",
                    "message":"Failed to get recent filings for ${ticker}
                    }`);

                throw error;
            }

            return false;
    }
}