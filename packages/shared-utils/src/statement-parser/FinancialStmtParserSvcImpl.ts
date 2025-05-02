import { JSDOM } from 'jsdom';
import { Log, LoggingService } from "../logging/logging.types.js";
import { FinancialStmtParserSvc } from './financial-stmts.types.js';
import { FinancialStmtParsingError } from '../error-handlers/app-errors.js';
import { HTTPStatusCodes } from '../app-config/ApplicationConfig.js';



class FinancialStmtParserSvcImpl implements FinancialStmtParserSvc {
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

let parserInstance:FinancialStmtParserSvc|null
export const createFinancialStmtParserSvc = (loggingSvc:LoggingService):FinancialStmtParserSvc => {
    if (!parserInstance) parserInstance = new FinancialStmtParserSvcImpl(loggingSvc);

    return parserInstance;
}