
import { FilingDataConfig } from "../financial-data/filings.types.js";
  
export interface FinancialStatement extends FilingDataConfig{
    /** @override */
    filingData?: Array<Record<string, string|number>>;
}
export interface EquityStatement extends FilingDataConfig {
    /** @override */
    filingData?: Array<Record<string, string[]|number[]>>
}

export interface FinancialStmtParserSvc {
    parseEquityStatement(htmContent:string):Array<Record<string, string[]|number[]>>;
    parseStatement(htmContent:string):Array<Record<string, string|number>>;
}