// Suggested location: packages/shared-utils/src/statement-parser/FinancialStmtParserSvcImpl.ts
// Or: packages/financial-stmt-parser-svc/src/FinancialStmtParserSvcImpl.ts

//import { JSDOM } from 'jsdom';
//import { Log, LoggingService } from "../logging/logging.types.js"; // Adjust path if needed
//import { FinancialStmtParserSvc } from './financial-stmts.types.js'; // Adjust path
//import { FinancialStmtParsingError } from '../error-handlers/app-errors.js'; // Adjust path
//import { HTTPStatusCodes } from '../app-config/ApplicationConfig.js'; // Adjust path


// Suggested location: packages/shared-utils/src/statement-parser/FinancialStmtParserSvcImpl.ts
// Or: packages/financial-stmt-parser-svc/src/FinancialStmtParserSvcImpl.ts

import { JSDOM } from 'jsdom';
import { Log, LoggingService } from "../logging/logging.types.js"; // Adjust path if needed
// Assuming these types are correctly defined in the imported file
import { FinancialStmtParserSvc } from './financial-stmts.types.js'; // Adjust path
import { FinancialStmtParsingError } from '../error-handlers/app-errors.js'; // Adjust path
import { HTTPStatusCodes } from '../app-config/ApplicationConfig.js'; // Adjust path

class FinancialStmtParserSvcImpl implements FinancialStmtParserSvc {
    private parserLogger: Log;

    // --- Expanded Normalization Map ---
    // Key: lowercase, cleaned-up version of raw label
    // Value: Your desired standardized key (camelCase) OR null to ignore
    // CORRECTED TYPE: Allow string OR null as values
    private readonly lineItemMap: Record<string, string | null> = {
        // --- Income Statement ---
        'revenue': 'Revenue',
        'net revenue': 'Revenue',
        'net sales': 'Revenue',
        'total revenue': 'Revenue',
        'total revenues': 'Revenue',
        'sales': 'Revenue',
        'cost of sales': 'Cost Of Goods Sold',
        'cost of goods sold': 'Cost Of Goods Sold',
        'cost of revenue': 'Cost Of Goods Sold',
        'cost of revenues': 'Cost Of Goods Sold',
        'gross margin': 'Gross Profit',
        'gross profit': 'Gross Profit',
        'research and development': 'Research And Development',
        'research and development expense': 'Research And Development',
        'marketing general and administrative': 'Selling General And Administrative',
        'selling general and administrative': 'Selling General And Administrative',
        'selling general & administrative': 'Selling General And Administrative',
        'selling general and administrative expense': 'Selling General And Administrative',
        'sales general and administrative': 'Selling General And Administrative',
        'sales marketing general and administrative': 'Selling General And Administrative',
        'operating expenses': 'Operating Expenses',
        'total operating expenses': 'Operating Expenses',
        'restructuring and other charges': 'Restructuring And Other Charges',
        'restructuring and other special charges net': 'Restructuring And Other Charges',
        'amortization of acquired intangible assets': 'Amortization Of Intangibles',
        'operating income (loss)': 'Operating Income',
        'income from operations': 'Operating Income',
        'loss from operations': 'Operating Income',
        'interest expense': 'Interest Expense',
        'interest expense net': 'Interest Expense Net', // Combine income/expense?
        'interest income': 'Interest Income',
        'other income (expense) net': 'Other Income Expense Net',
        'other income expense net': 'Other Income Expense Net',
        'other income net': 'Other Income Expense Net',
        'other expense net': 'Other Income Expense Net',
        'income before income taxes': 'Income Before Tax',
        'income (loss) before income taxes': 'Income Before Tax',
        'earnings before income taxes': 'Income Before Tax',
        'loss before income taxes': 'Income Before Tax',
        'income (loss) before income taxes and equity loss': 'Income Before Tax',
        'provision for income taxes': 'Income Tax Expense',
        'income tax expense': 'Income Tax Expense',
        'income tax expense (benefit)': 'Income Tax Expense',
        'net income': 'Net Income',
        'net income (loss)': 'Net Income',
        'net earnings': 'Net Income',
        'net loss': 'Net Income',
        'net income attributable to stockholders': 'Net Income', // Common variation
        'net income (loss) attributable to parent': 'Net Income',
        'net income per share': 'Earnings Per Share Basic', // Specify basic/diluted later?
        'basic net income per share': 'Earnings Per Share Basic',
        'diluted net income per share': 'Earnings Per Share Diluted',
        'basic (in usd per share)': 'Earnings Per Share Basic', // From example
        'diluted (in usd per share)': 'Earnings Per Share Diluted', // From example
        'basic': 'Earnings Per Share Basic', // Needs context, might be too generic
        'diluted': 'Earnings Per Share Diluted', // Needs context, might be too generic
        'weighted average shares outstanding basic': 'Weighted Average Shares Basic',
        'weighted average shares used in basic per share computation': 'Weighted Average Shares Basic',
        'basic (in shares)': 'Weighted Average Shares Basic', // From example
        'weighted average shares outstanding diluted': 'Weighted Average Shares Diluted',
        'weighted average shares used in diluted per share computation': 'Weighted Average Shares Diluted',
        'diluted (in shares)': 'Weighted Average Shares Diluted', // From example

        // --- Balance Sheet ---
        'cash and cash equivalents': 'Cash And Cash Equivalents',
        'marketable securities': 'Marketable Securities',
        'short-term investments': 'Short Term Investments',
        'accounts receivable net': 'Accounts Receivable Net',
        'accounts receivable less allowance': 'Accounts Receivable Net',
        'inventories': 'Inventories',
        'inventories net': 'Inventories',
        'prepaid expenses and other current assets': 'Prepaid Expenses And Other Current Assets',
        'total current assets': 'Total Current Assets',
        'property and equipment net': 'Property Plant Equipment Net',
        'property plant and equipment net': 'Property Plant Equipment Net',
        'operating lease right-of-use assets': 'Operating Lease Right Of Use Assets',
        'goodwill': 'Goodwill',
        'intangible assets net': 'Intangible Assets Net',
        'intangible assets net (excluding goodwill)': 'Intangible Assets Net',
        'acquisition-related intangibles': 'Intangible Assets Net', // Map variation
        'acquisition-related intangibles net': 'Intangible Assets Net',
        'deferred tax assets': 'Deferred Tax Assets',
        'deferred tax assets net': 'Deferred Tax Assets',
        'other assets': 'Other Assets',
        'other non-current assets': 'Other Assets',
        'total assets': 'Total Assets',
        'accounts payable': 'Accounts Payable',
        'accrued liabilities': 'Accrued Liabilities',
        'accrued expenses': 'Accrued Liabilities',
        'accrued and other current liabilities': 'Accrued Liabilities',
        'short-term debt': 'Short Term Debt',
        'current portion of long-term debt net': 'Short Term Debt', // Often includes current portion
        'total current liabilities': 'Total Current Liabilities',
        'long-term debt': 'Long Term Debt',
        'long-term debt net': 'Long Term Debt Net',
        'long-term debt net of current portion': 'Long Term Debt Net',
        'long term debt net of current portion': 'Long Term Debt Net',
        'long-term operating lease liabilities': 'Long Term Operating Lease Liabilities',
        'deferred tax liabilities': 'Deferred Tax Liabilities',
        'other long-term liabilities': 'Other Long Term Liabilities',
        'total liabilities': 'Total Liabilities',
        'common stock value issued': 'Common Stock Value',
        'common stock': 'Common Stock Value', // May need refinement based on context (value vs shares)
        'additional paid-in capital': 'Additional Paid In Capital',
        'treasury stock value': 'Treasury Stock Value',
        'treasury stock at cost': 'Treasury Stock Value',
        'retained earnings': 'Retained Earnings',
        'retained earnings (accumulated deficit)': 'Retained Earnings',
        'accumulated deficit': 'Retained Earnings',
        'accumulated other comprehensive income': 'Accumulated Other Comprehensive Income',
        'accumulated other comprehensive loss': 'Accumulated Other Comprehensive Income',
        'accumulated other comprehensive income (loss)': 'Accumulated Other Comprehensive Income',
        'total stockholders’ equity': 'Total Stockholders Equity',
        'total shareholders equity': 'Total Stockholders Equity',
        'total equity': 'Total Stockholders Equity',
        'total liabilities and stockholders’ equity': 'Total Liabilities And Stockholders Equity',
        'total liabilities and shareholders equity': 'Total Liabilities And Stockholders Equity',

        // --- Cash Flow Statement ---
        'net cash provided by operating activities': 'Net Cash From Operating Activities',
        'net cash provided by (used in) operating activities': 'Net Cash From Operating Activities',
        'cash flows from operating activities:': 'Net Cash From Operating Activities', // Often a section header
        'depreciation and amortization': 'Depreciation And Amortization',
        'stock-based compensation expense': 'Stock Based Compensation',
        'changes in operating assets and liabilities net of effects of acquisitions:': 'Change In Operating Assets Liabilities',
        'net cash used in investing activities': 'Net Cash From Investing Activities',
        'net cash provided by (used in) investing activities': 'Net Cash From Investing Activities',
        'cash flows from investing activities:': 'Net Cash From Investing Activities',
        'purchases of property and equipment': 'Purchases Of Property Plant Equipment',
        'purchases of property and equipment and intangible assets': 'Purchases Of Property Plant Equipment',
        'purchases of marketable securities': 'Purchases Of Marketable Securities',
        'proceeds from sales of marketable securities': 'Proceeds From Sale Of Marketable Securities',
        'proceeds from maturities of marketable securities': 'Proceeds From Maturities Of Marketable Securities',
        'net cash provided by financing activities': 'Net Cash From Financing Activities',
        'net cash (used in) provided by financing activities': 'Net Cash From Financing Activities',
        'cash flows from financing activities:': 'Net Cash From Financing Activities',
        'payments for repurchase of common stock': 'Payments For Repurchase Of Common Stock',
        'dividends paid': 'Dividends Paid',
        'proceeds from issuance of common stock': 'Proceeds From Issuance Of Common Stock',
        'net proceeds (payments) related to employee stock plans': 'Proceeds Payments Related To Stock Plans',
        'repayments of long-term debt': 'Repayments Of Long Term Debt',
        'proceeds from issuance of long-term debt': 'Proceeds From Issuance Of Long Term Debt',
        'change in cash and cash equivalents': 'Change In Cash And Cash Equivalents',
        'cash and cash equivalents at beginning of period': 'Cash And Cash Equivalents Beginning',
        'cash and cash equivalents at end of period': 'Cash And Cash Equivalents Ending',

        // --- Equity Statement ---
        'beginning balance': 'Beginning Balance',
        'ending balance': 'Ending Balance',

        // --- Common Headers/Ignored Rows ---
        // Map explicitly ignored keys to null
        'current assets:': null,
        'current liabilities:': null,
        'stockholders’ equity:': null,
        'shareholders’ equity:': null,
        'capital stock:': null,
        //'cash flows from operating activities: ': '',
        'commitments and contingencies': null,
        'see accompanying notes': null,
        'see notes to consolidated financial statements': null,
    };

    
    // -------------------------

    constructor(loggingSvc: LoggingService) {
        this.parserLogger = loggingSvc.getLogger('FinancialStmtParserSvc');
    }

    /**
     * Cleans and normalizes a raw line item key using the mapping.
     */
    private normalizeKey(rawKey: string | null | undefined): string | null {
        if (!rawKey) return null;
        const cleanedKey = rawKey.toLowerCase()
            .replace(/see accompanying notes? to consolidated financial statements?/g, '')
            .replace(/see note[s]? \d+( and \d+)?/g, '')
            .replace(/\[\d+\]/g, '')
            .replace(/\([a-z0-9]+\)/g, '')
            .replace(/[:]$/, '')
            .replace(/[$,*]/g, '')
            .replace(/[^a-z0-9\s\-\.\(\)]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleanedKey) return null;
        const standardKey = this.lineItemMap[cleanedKey];
        if (standardKey !== undefined) {
            if (standardKey === null) { this.parserLogger.warn(`Ignoring mapped key: "${rawKey}"`); return null; }
            this.parserLogger.warn(`Normalized "${rawKey}" -> "${standardKey}"`);
            return standardKey;
        } else {
            this.parserLogger.warn(`Unmapped line item key found: "${rawKey}" (cleaned: "${cleanedKey}")`);
            return cleanedKey; // Return cleaned key for unmapped items
        }
    }

    /**
     * Parses an Equity Statement HTML table.
     * CORRECTED RETURN TYPE
     */
    public parseEquityStatement(htmContent: string): Array<Record<string, string[]|number[]>> {
        this.parserLogger.info(`[EQUITY]: start parsing`);
        const filingData:any[] = [];
        try {
            const dom = new JSDOM(htmContent);
            const doc = dom.window.document;
            const table = doc.querySelector('table.report');
            if (!table) throw new Error('No Equity Statement table found (selector: table.report)');

            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
            if (!contentRows || contentRows.length === 0) throw new Error('No rows found in equity table');

            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
                const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');
                if (cells.length > 1) {
                    const rawDataTitle = cells[0].textContent;
                    const standardKey = this.normalizeKey(rawDataTitle);

                    if (standardKey) {
                        const dataItems: number[] = [];
                        for (let cellIdx = 1; cellIdx < cells.length; cellIdx++) {
                            const cell = cells[cellIdx];
                            const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                            let numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                            dataItems.push(isNaN(numericValue) ? 0 : Number(numericValue));
                        }
                        const record  = { [standardKey]: dataItems };
                        filingData.push(record);
                    } else if (rawDataTitle?.trim()) {
                         this.parserLogger.debug(`[EQUITY] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
                    }
                }
            });
            this.parserLogger.info(`[EQUITY]: Parsed ${filingData.length} data rows.`);
            return filingData;
        } catch (error: any) {
            this.parserLogger.error(`[EQUITY] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(`Error parsing equity statement: ${error.message}`, HTTPStatusCodes.InternalServerError);
        }
    }

    /**
     * Parses a standard (single-value column) Statement HTML table.
     * CORRECTED RETURN TYPE
     */
    public parseStatement(htmContent: string): Array<Record<string, string|number>> {
         this.parserLogger.info(`[STANDARD STMT]: start parsing`);
        const data: Array<any> = [];
        try {
            const dom = new JSDOM(htmContent);
            const doc = dom.window.document;
            const table = doc.querySelector('table.report');
            if (!table) throw new Error('No Statement table found (selector: table.report)');

            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
             if (!contentRows || contentRows.length === 0) throw new Error('No rows found in statement table');

            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
                const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const rawDataTitle = cells[0].textContent;
                    const standardKey = this.normalizeKey(rawDataTitle);

                    if (standardKey) {
                        const valueCell = cells[1];
                        const value = valueCell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        let numericValue = parseFloat(value) * (valueCell.textContent?.includes('(') ? -1 : 1);

                        const record = {
                            [standardKey]: isNaN(numericValue) ? 0 : Number(numericValue.toFixed(2))
                        };
                        data.push(record);
                    } else if (rawDataTitle?.trim()) {
                         this.parserLogger.debug(`[STANDARD STMT] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
                    }
                }
            });
            this.parserLogger.info(`[STANDARD STMT]: Parsed ${data.length} data rows.`);
            return data;
        } catch (error: any) {
            this.parserLogger.error(`[STANDARD STMT] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(`Error parsing financial statement: ${error.message}`, HTTPStatusCodes.InternalServerError);
        }
    }
}

// Keep the cached factory pattern
let parserInstance: FinancialStmtParserSvc | null = null;
export const createFinancialStmtParserSvc = (loggingSvc: LoggingService): FinancialStmtParserSvc => {
    if (!parserInstance) {
        parserInstance = new FinancialStmtParserSvcImpl(loggingSvc);
    }
    return parserInstance;
}


/**
 * ******************************************************************
 * */ 



class FinancialStmtParserSvcImplOld implements FinancialStmtParserSvc {
    private parserLogger:Log;
    constructor (loggingSvc:LoggingService) {
        this.parserLogger = loggingSvc.getLogger('parser');
    }

    /**
     * @override
     * @params {string} [htmlContent] - pass in the raw html string
     * */
    public parseEquityStatement(htmContent:string):Array<Record<string, string[]|number[]>> {
        let stmtTitle:string = '';
        let dataHeader:string[] = [];
        let filingData = [];
           
        this.parserLogger.info(`[EQUITY]: start parsing`);
        try {
            // -----------------------------------------------------
            // start table parsing
            const dom = new JSDOM(htmContent);
            const doc = dom.window.document;
    
            // find the table with class "report"
            const table = doc.querySelector('table.report');
            if (!table) throw new Error('No Statement table found');
            
            let headerCells:NodeListOf<HTMLTableCellElement> = table?.querySelectorAll('th');
            if (!headerCells) throw new Error('FinancialStatement header rows error!');
    
            headerCells.forEach((headerCell:HTMLTableCellElement, headerCellIdx:number)=> {
                // first cell is the statement metadata cell
                if (headerCellIdx === 0) {
                    if (!headerCell.textContent) throw new Error('FianncialStatementError', {cause:'Header cell at index 0 is empty or not found'});
                    // @todo: need to run regexpt to find Millions
                    stmtTitle = headerCell.textContent?.trim().replaceAll(/\s+|\n+|\r+/ig, ' ');

                    this.parserLogger.info(`[EQUITY]: headers: ${stmtTitle}`);
                }
                else {
                    // we need to protect againt strange colspan attributes here which house strings like '3 months ending|6 months ending'
                    if (headerCell.getAttribute('colSpan')) return; // @todo: we will capture that in statement metadata. 
    
                    this.parserLogger.info(`[EQUITY]: column: ${headerCell.textContent}`);
                    // @todo: DRY
                    dataHeader.push(headerCell.textContent?.trim().replaceAll(/\s+|\n\r+|(\([^]\))/ig, ' ')??'N/A');
                }
            })

            
            filingData.push({'headers': dataHeader});
    
            let data:Array<Record <string, string|number>>;
    
            let contentRows: NodeListOf<HTMLTableRowElement> | null = table.querySelectorAll('tr');
            if (!contentRows) throw new Error('no rows');
    
            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number): void => {
                const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');
    
                // Only process if there are cells in the row
                if (cells.length > 0) {
                    let data: Record<string, Array<number>> = {};
                    let dataTitle: string = '';
                    let dataItems: number[] = [];
    
                    cells.forEach((cell: HTMLTableCellElement, cellIdx: number) => {
                        if (cellIdx === 0) {
                            dataTitle = cell.textContent?.trim().replaceAll(/\s+|\n\r+/g, ' ') || 'N/A';
                        } else {
                            //let item = cell.textContent?.trim().replaceAll(/\s|\$|\n+|\r+|\)+/g, '') ?? '0.00';
                            //item = (item.replaceAll(/\(+/g, '-'));
                            //let val = parseFloat(item);
    
                            const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                            let numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                            if (isNaN(numericValue)) {
                                dataItems.push(0);
                            } else {
                                dataItems.push(Number(numericValue));
                            }
                        }
                        data[dataTitle] = dataItems;
                    });
                    filingData?.push(data);
                }
            });
    
            return filingData;
        } catch (error) {
            // rethrow for invoker to catch
            this.parserLogger.error(`[EQUITY]: ${error}`);
            throw new FinancialStmtParsingError('Error occurred while parsing financial statement' , HTTPStatusCodes.BadRequest);
        }
    }

    /**
     * @override
     * @param {string} [htmlContent] - takes the 
     * */
    public parseStatement(htmContent:string):Array<Record<string, string|number>> {
        try {
            let title: string = '';
            let metadata: string[] = [];

            
            // -----------------------------------------------------
            // start table parsing

            const dom = new JSDOM(htmContent);
            const doc = dom.window.document;

            // find the table with class "report"
            const table = doc.querySelector('table.report');

            // ------------------------------------------------------
            // parse header cell for title and period
            const headerCells = table?.querySelectorAll('th');
            if (!headerCells) throw new Error('headerCells are null');

            let headers: string[] = [];
            let colSpan: number = 0;
            let period: string = ''
            headerCells.forEach((cell, idx) => {
                // aumme that the 1st header cell is alwats title and some content
                if (idx === 0) {
                    title = cell.textContent?.trim().replaceAll(/\s+/g, ' ') || '';
                }
                // then the 
                else {
                    if (cell.getAttribute('colSpan')) {
                        colSpan = Number(cell.getAttribute('colSpan'))
                        // todo: we do not know what to do with this data.
                        // it contains info like '3 mo ending, 6 mo ending for 10Q which is useful' 
                        // for now ignore ot
                        // if colSpan = 1, carry fwd to next cell
                        // if colSpan = 2, then we need to run some % on the number of cells that follow
                    }
                    else {
                        headers.push(cell.textContent?.trim() || '');
                        period = cell.textContent?.trim() || ''
                    }
                }
            });

            const contentRows = table?.querySelectorAll('table.report tr');
            let data: Array<Record<string, number>> = [];

            contentRows?.forEach(row => {
                const contentCells = row.querySelectorAll('td');

                // the table is likely strucuted like
                //   BALANCE SHEET            |    2024    |    2023    |    2022   |
                //   item                     |      12,00 |       1100 |      1000 |
                // find, how many cells in a row?  
                // if 2, then we have 1 record (i.e. only 2024 data)
                // if 3, then 2 records (i.e. data for 2024, and 2023)
                // if 4 the 3 years of data

                let cellsPerRow: number = row.childElementCount;

                let record: Record<string, number> = {};
                let dataTitle: string = '';
                let dataItem:number = 0.00;

                contentCells.forEach((cell:HTMLTableCellElement, index:number) => {
                    if (index === 0) {
                        dataTitle = String(cell.textContent?.trim().replaceAll(/\s+/g, ' '));
                    }
                    else if (index === 1) {
                        //const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        //const numericValue = isNaN(parseFloat(value)) ? value : parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                        const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        let numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);

                        // Ensure two decimal precision only if it's a valid number
                        numericValue = Number(isNaN(numericValue) ? value : parseFloat(numericValue.toFixed(2)));
                        dataItem = numericValue; //Number(cell.textContent?.trim().replaceAll(/\$*\,*/g, '')) || 0.00;
                    }
                });

                record[dataTitle] = dataItem;
                //console.log(record);

                if (dataTitle !== '') data.push(record);
            })

           return data;
        } catch (error) {
            // rethrow for invoker to catch
            this.parserLogger.error(`[FIN STMT]: ${error}`);
            throw new FinancialStmtParsingError('Error occurred while parsing financial statement' , HTTPStatusCodes.BadRequest);
        }
    }

}

let parserInstance1:FinancialStmtParserSvc|null
export const createFinancialStmtParserSvc1 = (loggingSvc:LoggingService):FinancialStmtParserSvc => {
    if (!parserInstance) parserInstance = new FinancialStmtParserSvcImpl(loggingSvc);

    return parserInstance;
}