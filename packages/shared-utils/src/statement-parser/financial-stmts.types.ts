
import { FilingDataConfig } from "../financial-data/filings.types.js";
  
export interface FinancialStatement extends FilingDataConfig{
    metadata?:FinancialStmtMetadata;
    /** @override */
    filingData?: Array<Record<string, string|number>>;
}
export interface EquityStatement extends FilingDataConfig {
    metadata?:FinancialStmtMetadata;
    /** @override */
    filingData?: Array<Record<string, string[]|number[]>>
}


export interface FinancialStmtMetadata {
    currency: string;
    units: string;
    dataColIndex: number;
    dataRowIndex: number;
    stmtType: string;
    period: string;
    otherData: string;
}

export interface ParsedStatement {
    headerData?:string[];
    metadata: FinancialStmtMetadata;
    stmtData?: Array<Record<string, string|number>>;
    equityData?:Array<Record<string, string[]|number[]>>;
}
export interface FinancialStmtParserSvc {
    parseEquityStatement(htmContent:string):ParsedStatement //Array<Record<string, string[]|number[]>>;
    parseStatement(htmContent:string): ParsedStatement //Array<Record<string, string|number>>;
}

