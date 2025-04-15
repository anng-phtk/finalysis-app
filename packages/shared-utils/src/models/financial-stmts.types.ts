export interface BaseFinancialStatement {
    ticker:string;
    sic:string;
    cik:string;
    acccession:string;
    stmt:string;

}   

export interface FinancialStatement extends BaseFinancialStatement{
    /** @override */
    filingData?: Array<Record<string, string|number>>;
}
export interface EquityStatement extends BaseFinancialStatement {
    /** @override */
    filingData?: Array<Record<string, string[]|number[]>>
}