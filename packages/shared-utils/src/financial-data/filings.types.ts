import { CacheFileOptions } from "../disk-cache/cachesvc.types.js";
import { LoggingService } from "../logging/logging.types.js";

export interface FilingDataConfig {
    ticker:string;
    cik?: string;
    paddedcik?: string;              // same as CIK, but left padded with zeros and 10 chars long. included here for convenience
    name?:string;                    // company name
    sic?:string;
    sicDescription?:string;
    exchange?:string;                // Which exchange trades this stock. Not sure if this is useful to us
    accession?:string;
    filingDate?:string;              // @todo: can we make a new Date() and convert this to date?
    formType?:string;                // @todo: do we want to make this restrictive to 10-K, 10-Q, 
    filingDocs?:Record<string, string[]>|null;
}

export interface FilingDataSvc {
    getCIK(ticker:string):string[];
}


