import {
    CacheFileOptions, CacheSvc,
    FilingDataConfig, HTTPStatusCodes,
    Log,
    RedisJobsSvc,
    replaceTokens,
    JobsMetadata,
    RedisSvcError,
    DiskCacheError,
    FinancialStmtParserSvc,
    EquityStatement,
    FinancialStatement,
    StatementDao,
    StatementDoc,
    SECOperationError,
    DiskCacheFailureCodes
} from "@finalysis-app/shared-utils";


export const wrkrFetchStatments = async (
    redisJobs: RedisJobsSvc, 
    cacheSvc: CacheSvc, 
    stmtParserSvc:FinancialStmtParserSvc, 
    stmtDao:StatementDao, wrkrLogger: Log):Promise<boolean> => {


    let ticker:string='';

    try {   
            const result:string|null = await redisJobs.getNextJob(JobsMetadata.JobNames.fetch_financial_stmts);
            if (!result) {
                wrkrLogger.warn('[wrkrFetchStatments] No more jobs');
                // we are done, there are no further results to eval
                return false;
            }
            // do not log until actual work starts
            wrkrLogger.debug(`[START] wrkrFetchStatments: Find the html statements, and start downloading `);

            // force the datatype
            let filingsDTO;
            
            try {
                filingsDTO = JSON.parse(result);
                ticker = filingsDTO.ticker;
            }
            catch (parseError) {
                wrkrLogger.error(`Failed to parse job payload. Skipping job.payload: ${result}, error: ${parseError}`);
                return false;
                
                // TODO: Potentially move to a failed queue?
                //throw new DiskCacheError("No jobs found", DiskCacheFailureCodes.NothingToFetch);
            }

            // Validate essential context data needed for processing
            if (!filingsDTO.cik || !filingsDTO.accession || !filingsDTO.formType || !filingsDTO.filingDate || !filingsDTO.filingDocs || typeof filingsDTO.filingDocs !== 'object') {
                wrkrLogger.error("Job payload missing essential fields (cik, accession, formType, filingDate, filingDocs). Skipping job.");
                // TODO: Move to failed queue?
                throw new RedisSvcError("Job payload was missing essential data", HTTPStatusCodes.ExpectationFailed, "Worker Failed");
            }

            for (let [stmt, stmtFiles] of Object.entries(filingsDTO.filingDocs)) {
                wrkrLogger.debug(`Processing statement type: ${stmt}`);
                
                if (!Array.isArray(stmtFiles)) {
                    wrkrLogger.warn(`Expected array for stmtFiles but got ${typeof stmtFiles}. Skipping type: ${stmt}`, { jobId: filingsDTO.jobId });
                    throw new SECOperationError(`Expected to find stmtFiles but got ${typeof stmtFiles}`, HTTPStatusCodes.ExpectationFailed, "Content was not in HTML/String format");
                }

                for (let fileName of (stmtFiles as string[])) {

                    const statementDataOptions:CacheFileOptions = {
                        fileName: fileName, // we know this file name
                        fileURL: replaceTokens(`https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/${fileName}`, filingsDTO),
                        subDir: replaceTokens(`{ticker}/{accession}/`, filingsDTO),
                        canRefresh: false
                    };

                    // downloads the HTMs from SEC
                    wrkrLogger.debug(JSON.stringify(statementDataOptions));

                    const htmlDoc:string = await cacheSvc.getFileFromCache(statementDataOptions);
                   
                    // handle bad doc contents
                    if (typeof htmlDoc !== 'string') {
                        throw new SECOperationError(`Failed to retrieve valid HTML content for ${fileName}`,HTTPStatusCodes.ExpectationFailed, "Content was not in HTML/String format");
                    }

                    let filing:FilingDataConfig = filingsDTO as FilingDataConfig;
                    let parsedData:any;
                    
                    //parse html and transform to JSON
                    if (stmt === 'equity') {
                        parsedData = (filing as EquityStatement).filingData = stmtParserSvc.parseEquityStatement(htmlDoc);
                        (filing as EquityStatement).stmtType = stmt;
                    }
                    else {
                        parsedData = (filing as FinancialStatement).filingData = stmtParserSvc.parseStatement(htmlDoc);
                        (filing as FinancialStatement).stmtType = stmt;
                    }

                
                              
                    wrkrLogger.info(`[STMT DATA]:\n\t${JSON.stringify(filing)}`); // don't long entire statmenets here
                    wrkrLogger.info(`[STMT DATA]: successfully parsed ${stmt} data`);

                    if (!filing.filingDate || !filing.stmtType) throw new Error('Incomplete Filings');

                    // upsert into the DB
                    const stmtDoc: StatementDoc = { // Use the DB Schema type
                        // Generate a unique ID (optional, Mongo can do it)
                        _id: `${filing.cik}_${filing.accession}_${filing.formType}_${filing.stmtType}_${fileName}`,
                        ticker: filing.ticker,
                        cik: String(filing.cik), // Ensure string
                        accessionNumber: filing.accession ?? 'not found',
                        formType: filing.formType?? 'Not found',
                        // Ensure filingDate is a Date object
                        filingDate: new Date(filing.filingDate),
                        // reportDate: ..., // Extract this if available from filing/summary
                        companyName: filing.name,
                        statementType: filing.stmtType, // Store the determined type
                        sourceFile: fileName, // Store the origin file
                        parsedData: parsedData, // Store the parsed data array
                        processedAt: new Date() // Timestamp the processing
                    };

                    // --- Upsert to DB ---
                    const upsertSuccess = await stmtDao.upsertStatement(stmtDoc);
                    if (upsertSuccess) {
                        wrkrLogger.info(`Successfully upserted statement: ${stmtDoc._id}`);
                    } else {
                        wrkrLogger.warn(`Upsert statement returned false (no change?): ${stmtDoc._id}`);
                    }

                } // end the for loop
            }

        // job done!
        // clear active ticker
        redisJobs.clearActiveTicker(ticker);
        redisJobs.publishJob(ticker, `{
            "messageType":"Fetch Statements",
            "status":"success", 
            "message":"Downloaded all recent filings for ${ticker}"}`);
        
        return true;
                
    } catch (error) {
        // unrecoverable error. 
        
                
        if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NotFound) {
                await redisJobs.publishJob(ticker, `{
                    "messageType":"Fetch Statements", 
                    "status":"${HTTPStatusCodes.NoContent}", 
                    "message":"Failed to fetch and parse statement data."}`);
                wrkrLogger.error('[NON RECOVERABLE] An error occurred in fetching docs', error);

                // remove this ticker for final failure
                redisJobs.clearActiveTicker(ticker);
                return false;
                //throw error;
        }
        else if (error instanceof DiskCacheError && error.code === DiskCacheFailureCodes.NothingToFetch) {
            await redisJobs.publishJob(ticker, `{
                "messageType":"Fetch Statements", 
                "status":"${DiskCacheFailureCodes.NothingToFetch}", 
                "message":"No more data remains to be fetched."}`);
                wrkrLogger.error("nothing to fetch", error);
            
            return false;
        }
        else {
            wrkrLogger.error(`FATAL Error ${error}`);
            throw error;
        }
        // for all other errors
        return false;
    }
}