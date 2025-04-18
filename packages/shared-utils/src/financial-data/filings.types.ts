import { CacheFileOptions } from "../disk-cache/cachesvc.types.js";
import { LoggingService } from "../logging/logging.types.js";

export interface FilingDataConfig {
    ticker:string;
    cik?: string;
    paddedcik?: string;              // same as CIK, but left padded with zeros and 10 chars long. included here for convenience
    name?:string;                    // company name
    exchange?:string;                // Which exchange trades this stock. Not sure if this is useful to us
    accession?:string;
    filingDate?:string;              // @todo: can we make a new Date() and convert this to date?
    formType?:string;                // @todo: do we want to make this restrictive to 10-K, 10-Q, 
    filingDocs?:Record<string, string[]>|null;
}

export interface FilingDataSvc {
    getCIK(ticker:string):string[];
}

export const CIKLookupFile = (loggingSvc:LoggingService):CacheFileOptions => {

    return {
        subDir: './', 
        fileName:'company_tickers_exchange.json',
        fileURL: 'https://www.sec.gov/files/company_tickers_exchange.json',
        canRefresh:true,
        refreshAfterDays:120 // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
    } as CacheFileOptions;
};

const RecentFilingConfig = (ConfigloggingSvc:LoggingService):any => {
    
};


const FilingSummaryConfig = {
    url: 'https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/FilingSummary.xml',
    fileName: '{cik}_{accession}_FilingSummary.xml',
    dir: '{ticker}'
};
const FiledDocumentsConfig = {
    url: 'https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{doc}', // .htm is incld
    fileName: '{cik}_{accession}_{doc}',
    dir: '/disk_cache/{ticker}/'
};
