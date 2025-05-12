import { JSDOM } from 'jsdom';
import { Log, LoggingService } from '../logging/logging.types.js';
import { FinancialStmtMetadata, FinancialStmtParserSvc, ParsedStatement } from './financial-stmts.types.js'
import { FinancialStmtParsingError } from '../error-handlers/app-errors.js'
import { HTTPStatusCodes } from '../app-config/ApplicationConfig.js'

class FinancialStmtParserSvcImpl implements FinancialStmtParserSvc {
    private parserLogger: Log;

    // --- Expanded Normalization Map with Consistent Spacing ---
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
        'amortization of acquired intangible assets': 'Amortization Of Intangible Assets',
        'operating income (loss)': 'Operating Income',
        'income from operations': 'Operating Income',
        'loss from operations': 'Operating Income',
        'interest expense': 'Interest Expense',
        'interest expense net': 'Interest Expense Net',
        'interest income': 'Interest Income',
        'other income (expense) net': 'Other Income Expense Net',
        'other income expense net': 'Other Income Expense Net',
        'other income net': 'Other Income Expense Net',
        'other expense net': 'Other Income Expense Net',
        'income before income taxes': 'Income Before Taxes',
        'income (loss) before income taxes': 'Income Before Taxes',
        'earnings before income taxes': 'Income Before Taxes',
        'loss before income taxes': 'Income Before Taxes',
        'income (loss) before income taxes and equity loss': 'Income Before Taxes',
        'provision for income taxes': 'Income Tax Expense',
        'income tax expense': 'Income Tax Expense',
        'income tax expense (benefit)': 'Income Tax Expense',
        'net income': 'Net Income',
        'net income (loss)': 'Net Income',
        'net earnings': 'Net Income',
        'net loss': 'Net Income',
        'net income attributable to stockholders': 'Net Income',
        'net income (loss) attributable to parent': 'Net Income',
        'net income per share': 'Earnings Per Share Basic',
        'basic net income per share': 'Earnings Per Share Basic',
        'diluted net income per share': 'Earnings Per Share Diluted',
        'basic (in usd per share)': 'Earnings Per Share Basic',
        'diluted (in usd per share)': 'Earnings Per Share Diluted',
        'basic': 'Earnings Per Share Basic',
        'diluted': 'Earnings Per Share Diluted',
        'weighted average shares outstanding basic': 'Weighted Average Shares Basic',
        'weighted average shares used in basic per share computation': 'Weighted Average Shares Basic',
        'basic (in shares)': 'Weighted Average Shares Basic',
        'weighted average shares outstanding diluted': 'Weighted Average Shares Diluted',
        'weighted average shares used in diluted per share computation': 'Weighted Average Shares Diluted',
        'diluted (in shares)': 'Weighted Average Shares Diluted',

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
        'property and equipment net': 'Property Plant And Equipment Net',
        'property plant and equipment net': 'Property Plant And Equipment Net',
        'operating lease right-of-use assets': 'Operating Lease Right Of Use Assets',
        'goodwill': 'Goodwill',
        'intangible assets net': 'Intangible Assets Net',
        'intangible assets net (excluding goodwill)': 'Intangible Assets Net',
        'acquisition-related intangibles': 'Intangible Assets Net',
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
        'current portion of long-term debt net': 'Short Term Debt',
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
        'common stock': 'Common Stock Value',
        'additional paid-in capital': 'Additional Paid In Capital',
        'treasury stock value': 'Treasury Stock Value',
        'treasury stock at cost': 'Treasury Stock Value',
        'retained earnings': 'Retained Earnings',
        'retained earnings (accumulated deficit)': 'Retained Earnings',
        'accumulated deficit': 'Retained Earnings',
        'accumulated other comprehensive income': 'Accumulated Other Comprehensive Income',
        'accumulated other comprehensive loss': 'Accumulated Other Comprehensive Income',
        'accumulated other comprehensive income (loss)': 'Accumulated Other Comprehensive Income',
        'total stockholders equity': 'Total Stockholders Equity',
        'total shareholders equity': 'Total Stockholders Equity',
        'total equity': 'Total Stockholders Equity',
        'total liabilities and stockholders equity': 'Total Liabilities And Stockholders Equity',
        'total liabilities and shareholders equity': 'Total Liabilities And Stockholders Equity',

        // --- Cash Flow Statement ---
        'net cash provided by operating activities': 'Net Cash Provided By Operating Activities',
        'net cash provided by (used in) operating activities': 'Net Cash Provided By Operating Activities',
        'cash flows from operating activities': 'Net Cash Provided By Operating Activities',
        'depreciation and amortization': 'Depreciation And Amortization',
        'stock-based compensation expense': 'Stock Based Compensation',
        'changes in operating assets and liabilities net of effects of acquisitions': 'Change In Operating Assets And Liabilities',
        'net cash used in investing activities': 'Net Cash Used In Investing Activities',
        'net cash provided by (used in) investing activities': 'Net Cash Used In Investing Activities',
        'cash flows from investing activities': 'Net Cash Used In Investing Activities',
        'purchases of property and equipment': 'Purchases Of Property And Equipment',
        'purchases of property and equipment and intangible assets': 'Purchases Of Property And Equipment',
        'purchases of marketable securities': 'Purchases Of Marketable Securities',
        'proceeds from sales of marketable securities': 'Proceeds From Sales Of Marketable Securities',
        'proceeds from maturities of marketable securities': 'Proceeds From Maturities Of Marketable Securities',
        'net cash provided by financing activities': 'Net Cash Provided By Financing Activities',
        'net cash (used in) provided by financing activities': 'Net Cash Provided By Financing Activities',
        'cash flows from financing activities': 'Net Cash Provided By Financing Activities',
        'payments for repurchase of common stock': 'Payments For Repurchase Of Common Stock',
        'dividends paid': 'Dividends Paid',
        'proceeds from issuance of common stock': 'Proceeds From Issuance Of Common Stock',
        'net proceeds (payments) related to employee stock plans': 'Net Proceeds Related To Employee Stock Plans',
        'repayments of long-term debt': 'Repayments Of Long Term Debt',
        'proceeds from issuance of long-term debt': 'Proceeds From Issuance Of Long Term Debt',
        'change in cash and cash equivalents': 'Change In Cash And Cash Equivalents',
        'cash and cash equivalents at beginning of period': 'Cash And Cash Equivalents At Beginning Of Period',
        'cash and cash equivalents at end of period': 'Cash And Cash Equivalents At End Of Period',

        // --- Equity Statement ---
        'beginning balance': 'Beginning Balance',
        'ending balance': 'Ending Balance',

        // --- Common Headers/Ignored Rows ---
        'current assets': null,
        'current liabilities': null,
        'stockholders equity': null,
        'shareholders equity': null,
        'capital stock': null,
        'commitments and contingencies': null,
        'see accompanying notes': null,
        'see notes to consolidated financial statements': null,
    };

    constructor(loggingSvc: LoggingService) {
        this.parserLogger = loggingSvc.getLogger('FinancialStmtParserSvc');
    }

    /**
     * Cleans and normalizes a raw line item key using the mapping.
     */
    private normalizeKey(rawKey: string | null | undefined): string | null {
        if (!rawKey) return null;

        // Enhanced cleaning logic
        const cleanedKey = rawKey.toLowerCase()
            .replace(/see accompanying notes? to consolidated financial statements?/g, '')
            .replace(/see note[s]? \d+( and \d+)?/g, '')
            .replace(/\[\d+\]/g, '')
            .replace(/\([a-z0-9]+\)/g, '')
            .replace(/[:]$/, '')
            .replace(/[$,*]/g, '')
            .replace(/[^a-z0-9\-\.\(\)\s]/g, '')  // <-- allow whitespace
            .replace(/\s+/g, ' ')                 // normalize spaces
            .trim();

        if (!cleanedKey) return null;

        const standardKey = this.lineItemMap[cleanedKey];
        if (standardKey !== undefined) {
            if (standardKey === null) {
                this.parserLogger.debug(`Ignoring mapped key: "${rawKey}"`);
                return null;
            }
            this.parserLogger.debug(`Normalized "${rawKey}" -> "${standardKey}"`);
            return standardKey;
        }

        // For unmapped keys, convert to nicely spaced format
        const formattedKey = cleanedKey
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        this.parserLogger.warn(`Unmapped line item key found: "${rawKey}" (formatted as: "${formattedKey}")`);
        return formattedKey;
    }

    /**
     * Parses an Equity Statement HTML table.
     */
    public parseEquityStatement(htmlContent: string):ParsedStatement { 
    //Array<Record<string, string[] | number[]>> 
    
        this.parserLogger.info(`[EQUITY]: Start parsing`);
        const equityData: Array<Record<string, string[]|number[]>> = [];
        
        let metadata:FinancialStmtMetadata = {
            currency: '',
            units: '',
            dataColIndex: 1,
            dataRowIndex: 1,
            stmtType: '',
            period: '',
            otherData: ''
        };


        try {
            const dom = new JSDOM(htmlContent);
            const doc = dom.window.document;
            const table = doc.querySelector('table.report');

            if (!table) {
                throw new Error('No Equity Statement table found (selector: table.report)');
            }

            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
            if (!contentRows || contentRows.length === 0) {
                throw new Error('No rows found in equity table');
            }

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
                            const numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                            dataItems.push(isNaN(numericValue) ? 0 : Number(numericValue));
                        }

                        equityData.push({ [standardKey]: dataItems });
                    } else if (rawDataTitle?.trim()) {
                        this.parserLogger.debug(`[EQUITY] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
                    }
                }
            });

            this.parserLogger.info(`[EQUITY]: Parsed ${equityData.length} data rows.`);
            const parsedData:ParsedStatement = {
                metadata, 
                equityData
            };

            return parsedData;
        } catch (error: any) {
            this.parserLogger.error(`[EQUITY] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(
                `Error parsing equity statement: ${error.message}`,
                HTTPStatusCodes.InternalServerError
            );
        }
    }

    /**
     * Parses a standard financial statement HTML table.
     */
    public parseStatement(htmlContent: string): ParsedStatement {
    // Array<Record<string, string | number>>

        this.parserLogger.info(`[STANDARD STATEMENT]: Start parsing`);
        try {
            const dom: JSDOM = new JSDOM(htmlContent);
            const doc: Document = dom.window.document;


            const stmtData: Array<Record<string, string | number>> = [];
            // ------------------------------------------
            // start setup

            let metadata:FinancialStmtMetadata = {
                currency: '',
                units: '',
                dataColIndex: 1,
                dataRowIndex: 1,
                stmtType: '',
                period: '',
                otherData: ''
            };


            let units: string = '';
            let [dataCol, dataRow]: [number, number] = [0, 0];

            let stmtType: string = '';
            let [period, otherData]: [string, string] = ['', ''];

            // end setup
            // ------------------------

            // select the table for parsing
            const table: HTMLTableElement | null = doc.querySelector('table.report');

            if (!table) throw new Error('Table with className=report was not found')

            // select header rows for parsing
            const headerCellCollection: NodeListOf<HTMLTableCellElement> = table.querySelectorAll('th');

            if (!headerCellCollection) throw new Error("No header cells found");


            headerCellCollection.forEach((headerCell: HTMLTableCellElement, index: number) => {
                // we only care about the 1st cell for now, whch will tell us the x,y of statement numerical data
                if (index === 0) {
                    if (headerCell.hasAttribute('colspan')) {
                        console.log(headerCell.colSpan);
                        dataCol = Number(headerCell.colSpan) || 1;
                    }

                    if (headerCell.hasAttribute('rowspan')) {
                        console.log(headerCell.rowSpan);
                        dataRow = Number(headerCell.rowSpan) || 1;
                    }
                    let stmtMd: string = String(headerCell.textContent) || '';
                    if (stmtMd !== null || stmtMd !== '') {
                        console.log(`Searching ${stmtMd}`)
                        //const currency:string = (stmtMd.search(/(\$|USD)*/ig) ? 'USD';

                        const unitsFound: string[] = stmtMd.match(/((B|M)?illion+(s)?)/ig) || [''];
                        units = unitsFound[0];

                        let stmtTypeMD: string[] | null = stmtMd.match(/(income statement|balance sheet|cash (flows|flow))/i); //stmtMd.match(/Balance|Income|Cash/ig);
                        const stmtTypeMatch = stmtMd.match(/(income statement|balance sheet|cash (flows|flow))/i);

                        if (stmtTypeMatch) {
                            if (/income/i.test(stmtTypeMatch[0])) stmtType = 'income';
                            else if (/balance/i.test(stmtTypeMatch[0])) stmtType = 'balance';
                            else if (/cash/i.test(stmtTypeMatch[0])) stmtType = 'cash';
                        }
                    }

                }
                else {
                    // we are not in the 1st cell, 
                    // here we can again check for rowSpan which contain period ending or other info
                    // now we can see if we can find "reporting periods"
                    let temp: string[] = [];
                    if (headerCell.getAttribute('colspan')) {
                        otherData = (headerCell.textContent || '');
                    }
                    else {
                        if (dataCol === index) period = headerCell.textContent || '';
                    }
                }

                metadata = {
                    currency: 'USD', // not yet parsed, assumed to be USD because we are only dealing with US listed companies
                    units: units,
                    dataColIndex: dataCol,   // we have already captured this
                    dataRowIndex: dataRow,   // already captured this
                    stmtType: stmtType,   // good to capture this 
                    period: period,
                    otherData: otherData
                }
            });


            //const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('table.report tr');
            // better control over our selections
            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
    
            if (!contentRows || contentRows.length === 0) {
                throw new Error('No rows found in statement table');
            }

            // lets try a nested loop approach to concretely tell where the start of our data rows is
            // outter loops over trs, inner goes over tds only
            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
                const contentCells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');

                let cellsPerRow: number = row.childElementCount;

                let record: Record<string, number> = {};
                let dataTitle: string = '';
                let dataItem: number = 0.00;

                contentCells.forEach((cell: HTMLTableCellElement, cellIdx: number) => {
                 
                    // sometimes these tables generate footnotes
                    // todo: find a way to capture, but lets not pollute the JSON structure
                    // for now, just remove those
                    if ((cell.getAttribute('colSpan') && cell.colSpan > 1)) {       
                        if (cell.firstElementChild?.tagName === 'TABLE') {
                            this.parserLogger.warn(`found a nested table possibly a foot note. ${cell.firstElementChild.tagName}`);
                            cell.innerHTML = '';
                        }
                    }
                    if (cellIdx === 0) {
                        dataTitle = String(cell.textContent?.trim().replaceAll(/\s+/g, ' '));
                    }
                    else if (cellIdx === dataCol) {
                        
                        // we don't need this noise
                        if (cell.getAttribute('colSpan') && cell.colSpan > 1) return;

                        //const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        //const numericValue = isNaN(parseFloat(value)) ? value : parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                        const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        let numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);

                        // Ensure two decimal precision only if it's a valid number
                        numericValue = Number(isNaN(numericValue) ? value : parseFloat(numericValue.toFixed(2)));
                        dataItem = numericValue; //Number(cell.textContent?.trim().replaceAll(/\$*\,*/g, '')) || 0.00;
                    }
                });

                //record[dataTitle] = dataItem;
                const cleanedKey = this.normalizeKey(dataTitle);
                record[cleanedKey ?? dataTitle] = dataItem;

                //console.log(record);
                if (dataTitle !== '') stmtData.push(record);
            });

            //console.log(metadata);
            //console.log(data);

            // return data;

            const parsedData:ParsedStatement = {
                metadata,
                stmtData
            }

            return parsedData;

        }
        catch (error: any) {
            this.parserLogger.error(`[STANDARD STATEMENT] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(
                `Error parsing financial statement: ${error.message}`,
                HTTPStatusCodes.InternalServerError
            );
        }
    }

    /*
    public parseStatementGEMINI(htmlContent: string): Array<Record<string, string | number>> {
        this.parserLogger.info(`[STANDARD STATEMENT]: Start parsing`);
        const data: Array<Record<string, string | number>> = [];

        try {
            const dom = new JSDOM(htmlContent);
            const doc = dom.window.document;
            const table = doc.querySelector('table.report');

            if (!table) {
                throw new Error('No Statement table found (selector: table.report)');
            }

            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
            if (!contentRows || contentRows.length === 0) {
                throw new Error('No rows found in statement table');
            }

            let dataStartIdx = 1; // default: data starts at cell index 1
            let firstHeaderRow = true;
            let startedDataRows = false;


            //Doesn't handle rowspans very well
            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
                const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td, th');

                // Detect and adjust for header row with colspan
                if (firstHeaderRow && row.querySelectorAll('th').length > 0) {
                    const firstCell = cells[0];
                    const colSpan = firstCell.getAttribute('colspan');
                    dataStartIdx = colSpan ? parseInt(colSpan, 10) : 1;
                    firstHeaderRow = false;
                    return; // skip this header row
                }

                // 2. Skip rows that are likely just date headers

                const isLikelyDateHeader = Array.from(cells).every(cell => {
                    const txt = cell.textContent?.trim();
                    return !txt || /\d{4}/.test(txt);
                });

                if (isLikelyDateHeader) return;


                if (cells.length > dataStartIdx) {
                    const rawDataTitle = cells[0].textContent;
                    const standardKey = this.normalizeKey(rawDataTitle);

                    if (standardKey) {
                        const valueCell = cells[dataStartIdx];
                        const valueText = valueCell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        const numericValue = parseFloat(valueText) * (valueCell.textContent?.includes('(') ? -1 : 1);
                        const finalValue = isNaN(numericValue) ? 0 : Number(numericValue.toFixed(2));

                        data.push({ [standardKey]: finalValue });
                    } else if (rawDataTitle?.trim()) {
                        this.parserLogger.debug(`[STANDARD STATEMENT] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
                    }
                }
            });

            this.parserLogger.info(`[STANDARD STATEMENT]: Parsed ${data.length} data rows.`);
            return data;

        }
        catch (error: any) {
            this.parserLogger.error(`[STANDARD STATEMENT] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(
                `Error parsing financial statement: ${error.message}`,
                HTTPStatusCodes.InternalServerError
            );
        }
    }

    public parseStatementOLD(htmlContent: string): Array<Record<string, string | number>> {
        this.parserLogger.info(`[STANDARD STATEMENT]: Start parsing`);
        const data: Array<Record<string, string | number>> = [];

        try {
            const dom = new JSDOM(htmlContent);
            const doc = dom.window.document;
            const table = doc.querySelector('table.report');

            if (!table) {
                throw new Error('No Statement table found (selector: table.report)');
            }

            const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
            if (!contentRows || contentRows.length === 0) {
                throw new Error('No rows found in statement table');
            }

            contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
                const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');

                if (cells.length >= 2) {
                    const rawDataTitle = cells[0].textContent;
                    const standardKey = this.normalizeKey(rawDataTitle);

                    if (standardKey) {
                        const valueCell = cells[1];
                        const value = valueCell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                        const numericValue = parseFloat(value) * (valueCell.textContent?.includes('(') ? -1 : 1);
                        const finalValue = isNaN(numericValue) ? 0 : Number(numericValue.toFixed(2));

                        data.push({ [standardKey]: finalValue });
                    } else if (rawDataTitle?.trim()) {
                        this.parserLogger.debug(`[STANDARD STATEMENT] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
                    }
                }
            });

            this.parserLogger.info(`[STANDARD STATEMENT]: Parsed ${data.length} data rows.`);
            return data;
        } catch (error: any) {
            this.parserLogger.error(`[STANDARD STATEMENT] Parsing Error: ${error.message}`, error);
            throw new FinancialStmtParsingError(
                `Error parsing financial statement: ${error.message}`,
                HTTPStatusCodes.InternalServerError
            );
        }
    }

    */

}

// Singleton pattern implementation
let parserInstance: FinancialStmtParserSvc | null = null;

export const createFinancialStmtParserSvc = (loggingSvc: LoggingService): FinancialStmtParserSvc => {
    if (!parserInstance) {
        parserInstance = new FinancialStmtParserSvcImpl(loggingSvc);
    }
    return parserInstance;
};


/**
 * 
 * COLSPAN FIX : USE ONLY IF EQUITY STATEMENT ENCOUNTERS THIS ISSUE
 * 
 * let dataStartIdx = 1; // default: data starts at cell index 1
 * let firstHeaderRow = true;

contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
    const cells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td, th');

    // Detect header row with colspan
    if (firstHeaderRow && row.querySelectorAll('th').length > 0) {
        const firstCell = cells[0];
        const colSpan = firstCell.getAttribute('colspan');
        dataStartIdx = colSpan ? parseInt(colSpan, 10) : 1;
        firstHeaderRow = false;
        return; // skip this header row
    }

    if (cells.length > dataStartIdx) {
        const rawDataTitle = cells[0].textContent;
        const standardKey = this.normalizeKey(rawDataTitle);

        if (standardKey) {
            const dataItems: number[] = [];

            for (let cellIdx = dataStartIdx; cellIdx < cells.length; cellIdx++) {
                const cell = cells[cellIdx];
                const valueText = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                const numericValue = parseFloat(valueText) * (cell.textContent?.includes('(') ? -1 : 1);
                dataItems.push(isNaN(numericValue) ? 0 : Number(numericValue));
            }

            filingData.push({ [standardKey]: dataItems });
        } else if (rawDataTitle?.trim()) {
            this.parserLogger.debug(`[EQUITY] Skipping row ${rowIdx + 1} due to unmapped/empty key: "${rawDataTitle}"`);
        }
    }
});

 */