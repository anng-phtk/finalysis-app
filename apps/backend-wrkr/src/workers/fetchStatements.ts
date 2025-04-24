import {
    CacheFileOptions, CacheSvc,
    FilingDataConfig, HTTPStatusCodes,
    Log, LoggingService,
    RedisJobsSvc,
    RedisService,
    replaceTokens,
    SECOperationError, SECOperationFailureCodes,
    JobsMetadata,
    RedisSvcError,
    DiskCacheError,
    DiskCacheFailureCodes
} from "@finalysis-app/shared-utils";

export const wrkrFetchStatments = async (redisJobs: RedisJobsSvc, cacheSvc: CacheSvc, wrkrLogger: Log) => {
    let ticker:string;
    let runAgain:boolean = true;
    try {
        while(runAgain) {
            const result:string|null = await redisJobs.getNextJob(JobsMetadata.JobNames.fetch_financial_stmts);
            if (!result) {
                // we are done, there are no further results to eval
                runAgain = false;
                continue;
            }
            // still inside while...
            wrkrLogger.debug(`[PROCESS] Read the html statements, and start downloading `);
            // force the datatype
            let filingsDTO = JSON.parse(result);
            
            for (let [stmt, stmtFiles] of Object.entries(filingsDTO.filingDocs)) {
                console.log(stmt, ":", stmtFiles);

                for (let fileName of (stmtFiles as string[])) {
                    const statementDataOptions:CacheFileOptions = {
                        fileName: fileName, // we know this file name
                        fileURL: replaceTokens(`https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/${fileName}`, filingsDTO),
                        subDir: replaceTokens(`{ticker}/{accession}/`, filingsDTO),
                        canRefresh: false
                    };
                    // downloads the HTMs from SEC
                    console.log(JSON.stringify(statementDataOptions));
                    const htmlDoc:string = await cacheSvc.getFileFromCache(statementDataOptions);

                    
                }
            }
            console.log('we are done!')
            
        } //end while loop
    } catch (error) {
        if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NotFound) {
            if (runAgain) {
                throw error;
            }
            else {
                wrkrLogger.warn('We have likely processed all the jobs in the queue')
            }
        }
        else if (error instanceof DiskCacheError && error.code === DiskCacheFailureCodes.NothingToFetch) {
            console.log("nothing to fetch", error);
        }
        
    }
}

const transformStmtAndSave = (statement:string) => {
    
};


