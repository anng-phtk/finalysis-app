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

export const wrkrFetchFilingSummaries = async (redisJobs: RedisJobsSvc, cacheSvc: CacheSvc, wrkrLogger: Log) => {
    wrkrLogger.debug(`[START] wrkrFetchFilingSummaries: will fetch filingSummary.xml for this period's filing`);

    let runAgain: boolean = true;
    let ticker:string = '';
    try {
        while (runAgain) {

            let result: string | null = await redisJobs.getNextJob(JobsMetadata.JobNames.fetch_summaries);
            wrkrLogger.debug(`Get job data from redis`);

            if (!result) {
                wrkrLogger.debug('[NO RESULT] we are likely done');
                runAgain = false;
                wrkrLogger.debug(`${runAgain} set. `);
                continue;
                // this line will not exeute, but I will keep it here for now
                throw new RedisSvcError('No more jobs to process', HTTPStatusCodes.NoContent, "NoMoreRedisJobs");

            }

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
                throw new SECOperationError(`No JSON data for ${filingsDTO.ticker}. 
                Check if data is available at ${filingsDTO.fileURL} `,
                    HTTPStatusCodes.BadRequest, 'BadTickerOrCIK');
            }
            const docs:Record<string, string[]> = await wrkrParseXMLSummries(xmlSummaries, wrkrLogger);

            const filingData:FilingDataConfig = filingsDTO as FilingDataConfig; 
            filingData.filingDocs = docs;
            ticker = filingData.ticker;

            redisJobs.addJob(JobsMetadata.JobNames.fetch_financial_stmts, JSON.stringify(filingData));
        }

        // if we are here, then while loop has run its course. publish a message
        wrkrLogger.debug(`We are here. We are done!`);
        redisJobs.publishJob(JobsMetadata.ChannelNames.fetch_financial_stmts, `{"ticker":"${ticker}", "message":"Found Financial Statements"}`);
    }
    catch (error) {
        if (error instanceof SECOperationError) {
            wrkrLogger.error(`[RECOVERABLE]`)
        }
        else if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NoContent) {
            wrkrLogger.info(`[RECOVERABE] We are fine. No new jobs to process`)
        }
        redisJobs.publishJob(ticker, `{"message":"error in getting financial statements"}`);
    }
}

const wrkrParseXMLSummries = async (xmlFile:string, wrkrLogger:Log):Promise<Record<string, string[]>> => {
    const summaryData = await parseStringPromise(xmlFile, { explicitArray: false });
    const reports = summaryData.FilingSummary.MyReports.Report;
    const docMap: { [key: string]: string[] } = {
        income: [], // Array for all income statements
        balance: [], // Array for all balance sheets
        equity: [], // Array for all equity statements
        cashflow: [] // Array for all cash flow statements
    };
    const unmappedStatements: string[] = [];
    try {
        const filteredReports = reports.filter((report: any) => {
            const menuCat = report.MenuCategory?.toLowerCase() || '';
            return menuCat.includes('statements');
        });

        filteredReports.forEach((report: any) => {
            let name: any = report.ShortName?.toLowerCase() || '';
            let htmlFile: any = report.HtmlFileName || null;
            if (!htmlFile) return;

            name = name.replace(/\?+/g, '').replace(/[^a-z0-9\s']/g, '').trim();
            
            if (((/(income|operations|earnings)/i).test(name)) && !(/additional|parenthetical/i).test(name)) {
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
                unmappedStatements.push(`${name} (${htmlFile})`);
            }
        });

        if (unmappedStatements.length > 0) {
            wrkrLogger.warn(`Unmapped financial statements detected',data: ${unmappedStatements}`)
        }
        
        wrkrLogger.debug(`Found docments: ${JSON.stringify(docMap)}`);
        return docMap;

    } catch (error) {
        wrkrLogger.error(`Error parsing XML summary', ${ error}`);
        throw error;
    }
}