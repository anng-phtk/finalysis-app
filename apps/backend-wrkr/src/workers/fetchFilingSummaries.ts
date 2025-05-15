import {
    CacheFileOptions, CacheSvc,
    FilingDataConfig, HTTPStatusCodes,
    Log, LoggingService,
    RedisJobsSvc,
    RedisService,
    replaceTokens,
    SECOperationError, SECOperationFailureCodes,
    JobsMetadata,
    RedisSvcError
} from "@finalysis-app/shared-utils";
import { parseStringPromise } from "xml2js";

export const wrkrFetchFilingSummaries = async (redisJobs: RedisJobsSvc, cacheSvc: CacheSvc, wrkrLogger: Log): Promise<boolean> => {
    let ticker: string = '';
    try {
        let result: string | null = await redisJobs.getNextJob(JobsMetadata.JobNames.fetch_summaries);
        if (!result) {
            //wrkrLogger.debug('[NO RESULT] we are likely done');
            wrkrLogger.warn('[wrkrFetchFilingSummaries] No more jobs');
            return false;
            // unreachable
            //throw new RedisSvcError('No more jobs to process', HTTPStatusCodes.NoContent, "NoMoreRedisJobs");
        }

        // do not log until actual work starts
        wrkrLogger.debug(`[START] wrkrFetchFilingSummaries: filingSummary.xml for this period's filing`);

        // inside while...
        wrkrLogger.debug(`[PROCESS] Read the result, and start fetching filing summaries from `);

        // force the datatype
        const filingsDTO = JSON.parse(result);
        const filingSummaryOptions: CacheFileOptions = {
            fileName: 'FilingSummary.xml', // we know this file name
            fileURL: replaceTokens('https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/FilingSummary.xml', filingsDTO),
            subDir: replaceTokens(`{ticker}/{accession}`, filingsDTO),
            canRefresh: false
        }

        /**
         * some day we are going to get the excel file too 
        const excelReportFile:CacheFileOptions = {
            fileName:'FilingSummary.xml', // we know this file name
            fileURL:replaceTokens('https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/FilingSummary.xml', filingsDTO),
            subDir:filingsDTO.ticker,
            canRefresh:false
        */
        const xmlSummaries = await cacheSvc.getFileFromCache(filingSummaryOptions);
        if (!xmlSummaries) {
            throw new SECOperationError(`No JSON data for ${filingsDTO.ticker}. ${filingsDTO.accession}
                Check if data is available at ${filingsDTO.fileURL} `,
                HTTPStatusCodes.BadRequest, 'BadTickerOrCIK');
        }
        const docs: Record<string, string[]> = await wrkrParseXMLSummries(xmlSummaries, filingsDTO.accession, wrkrLogger);

        const filingData: FilingDataConfig = filingsDTO as FilingDataConfig;
        filingData.filingDocs = docs;
        ticker = filingData.ticker;

        redisJobs.addJob(JobsMetadata.JobNames.fetch_financial_stmts, JSON.stringify(filingData));


        // if we are here , we have completed the job
        wrkrLogger.debug(`Completed parsing XML summaries and found financial statements`);
        await redisJobs.publishJob(ticker,
            `{"messageType":"Fetch Filing Summaries",
            "status":"success",
            "message":"Completed looking up filingSummaries for ${ticker} and found financial statements"}`);

        return true;
    }
    catch (error) {
        if (error instanceof SECOperationError) {
            wrkrLogger.error(`[RECOVERABLE] review the issue as to why this error occurred for ${ticker}`);
            // returning false but not removing from active tickers
            await redisJobs.publishJob(ticker,
                `{"messageType":"Fetch Filing Summaries",
                "status":"${error.statusCode}",
                "message":"Unknown error ${ticker} when trying to get financial statements"}`);

        }
        else if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NoContent) {
            wrkrLogger.info(`[RECOVERABE] We are fine. No new jobs to process`);
            // if we don't have any jobs to process, 
            // we don't need to keep this ticker in active ticker's list
            await redisJobs.clearActiveTicker(ticker);
            // the worker did not do any work, and therfore return false
            await redisJobs.publishJob(ticker,
                `{"messageType":"FetchFilingSummaries",
                "status":"${error.statusCode}",
                "message":"There are no more summaries to download for ${ticker}"}`);

        }
        else {

            // no idea what this error could be
            throw error;
        }

        redisJobs.publishJob(ticker, `{"message":"error in getting financial statements"}`);
        return false;
    }
}

const wrkrParseXMLSummries = async (xmlFile: string, accession: string, wrkrLogger: Log): Promise<Record<string, string[]>> => {
    const summaryData = await parseStringPromise(xmlFile, { explicitArray: false });
    const reports = summaryData.FilingSummary.MyReports.Report;
    const docMap: { [key: string]: string[] } = {
        income: [], // Array for all income statements
        balance: [], // Array for all balance sheets
        equity: [], // Array for all equity statements
        cashflow: [], // Array for all cash flow statements
        other: []    // all other statements
    };
    const unmappedStatements: string[] = [];



    try {
        const filteredReports = reports.filter((report: any) => {
            const menuCat = report.MenuCategory?.toLowerCase() || '';
            const shortName = report.ShortName?.toLowerCase() || '';
            const htmlFile = report.HtmlFileName;

            if (shortName.includes('parenthetical') || shortName.includes('additional')) return false;

            let isValidMenuCat: boolean = menuCat.includes('statements'); //|| menuCat.includes('uncategorized');
            

            if (!isValidMenuCat) {
                let ltdFileSet: string[] = ['R2.htm', 'R3.htm', 'R4.htm', 'R5.htm', 'R6.htm', 'R7.htm', 'R8.htm', 'R9.htm']
                // look in a limited number of files
                //if (report.ReportType === "Sheet" && ltdFileSet.includes(report.HtmlFileName)){
                //    isValidMenuCat = menuCat.includes('uncategorized');
                //}
                //wrkrLogger.error(`${accession} ---  ${menuCat}, ${shortName}, ${htmlFile}`)
                wrkrLogger.error(`${accession} ---  ${menuCat}, ${shortName}, ${htmlFile} and ${report.ReportType.toLowerCase()} is sheet, set the retrun to ${menuCat.includes('uncategorized')}`)
                
                if (report.ReportType.toLowerCase() === 'sheet' && ltdFileSet.includes(htmlFile) && (menuCat.includes('uncategorized'))) {
                        wrkrLogger.error(`${accession} ---  ${menuCat}, ${shortName}, ${htmlFile}`)
                
                        isValidMenuCat = true;
                }
            }

            return isValidMenuCat;

        });

        filteredReports.forEach((report: any) => {
            let name: any = report.ShortName?.toLowerCase() || '';
            let htmlFile: any = report.HtmlFileName || null;
            if (!htmlFile) return;

            name = name.replace(/\?+/g, '').replace(/[^a-z0-9\s']/g, '').trim();
            // removed operations. that seems to work
            // if we come across more operations instead of income, we may need to score these statements
            if (((/(operations|income|loss|earnings)/i).test(name)) && !(/additional|parenthetical/i).test(name)) {
                docMap.income.push(htmlFile);
                wrkrLogger.debug(`[XML2JS] ${name}`);
            } else if ((/cash flow(s)?/i).test(name) && !(/additional|parenthetical/i).test(name)) {
                docMap.cashflow.push(htmlFile);
                wrkrLogger.debug(`[XML2JS], ${name}`);
            } else if ((/balance sheet(s)?/i).test(name) && !(/additional|parenthetical/i).test(name)) {
                docMap.balance.push(htmlFile);
                wrkrLogger.debug(`[XML2JS]: ${name}`);
            } else if ((/equity/i).test(name) && !(/additional|parenthetical/i).test(name)) {
                docMap.equity.push(htmlFile);
                wrkrLogger.debug(`[XML2JS]: ${name}`);
            } else {
                //const fullURL = `https://www.sec.gov/Archives/edgar/data/${filingsDTO.cik}/${filingsDTO.accession}/${htmlFile}`;
                docMap.other.push(htmlFile);
                unmappedStatements.push(`${name} (${htmlFile}")`);
            }
        });

        if (unmappedStatements.length > 0) {
            wrkrLogger.warn(`Unmapped financial statements detected',data: ${unmappedStatements}`)
        }

        wrkrLogger.debug(`Found docments: ${accession} \n ${JSON.stringify(docMap)}`);
        return docMap;
    }
    catch (error) {
        wrkrLogger.error(`Error parsing XML summary', ${error}`);
        throw error;
    }
}