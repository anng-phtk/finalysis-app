import { strict } from 'assert';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import path from 'path';


async function testHTMLParsing(htmlContent: string): Promise<void> {
    const dom:JSDOM = new JSDOM(htmlContent);
    const doc:Document = dom.window.document;
    
    
    const data: Array<Record<string, string | number>> = [];
    // ------------------------------------------
    // start setup

    let metadata = {
        currency:'',
        units:'',
        dataColIndex:1,
        dataRowIndex:1,
        stmtType:'',
        period:'',
        otherData:''
    };

    let units:string = '';
    let [dataCol, dataRow]:[number, number] = [0,0];
        
    let stmtType:string = '';
    let [period, otherData]:[string, string] = ['', ''];

    // end setup
    // ------------------------

    // select the table for parsing
    const table:HTMLTableElement | null = doc.querySelector('table.report'); 

    if (!table) throw new Error('Table with className=report was not found')
    
        // select header rows for parsing
    const headerCellCollection:NodeListOf<HTMLTableCellElement> = table.querySelectorAll('th');

    if (!headerCellCollection) throw new Error("No header cells found");
    
    
    headerCellCollection.forEach((headerCell:HTMLTableCellElement,index:number) => {
        // we only care about the 1st cell for now, whch will tell us the x,y of statement numerical data
        if (index === 0) {
            if (headerCell.hasAttribute('colspan')) {
                console.log(headerCell.colSpan);
                dataCol = Number(headerCell.colSpan)||1;            
            }
    
            if (headerCell.hasAttribute('rowspan')) {
                console.log(headerCell.rowSpan);
                dataRow = Number(headerCell.rowSpan)||1;
            }
            let stmtMd:string = String(headerCell.textContent) || '';            
            if (stmtMd !== null || stmtMd !== '') {             
                console.log(`Searching ${stmtMd}`)
                //const currency:string = (stmtMd.search(/(\$|USD)*/ig) ? 'USD';
                
                const unitsFound:string[] = stmtMd.match(/((B|M)?illion+(s)?)/ig) || [''];
                units = unitsFound[0];
                
                let stmtTypeMD:string[]|null = stmtMd.match(/(income statement|balance sheet|cash (flows|flow))/i); //stmtMd.match(/Balance|Income|Cash/ig);
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
            let temp:string[] = [];
            if (headerCell.getAttribute('colspan')) {
                otherData = (headerCell.textContent||'');
            }
            else {
                if (dataCol === index) period = headerCell.textContent || '';
            }
        }

        metadata = {
            currency:'USD', // not yet parsed, assumed to be USD because we are only dealing with US listed companies
            units:units,   
            dataColIndex:dataCol,   // we have already captured this
            dataRowIndex:dataRow,   // already captured this
            stmtType:stmtType,   // good to capture this 
            period:period,
            otherData:otherData
        }
    });

    const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
    //const contentRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('table.report tr');
    if (!contentRows || contentRows.length === 0) {
        throw new Error('No rows found in statement table');
    }

    const forceExit:boolean = false;
   
    // lets try a nested loop approach to concretely tell where the start of our data rows is
    // outter loops over trs, inner goes over tds only
    contentRows.forEach((row: HTMLTableRowElement, rowIdx: number) => {
        const contentCells: NodeListOf<HTMLTableCellElement> = row.querySelectorAll('td');

        let cellsPerRow: number = row.childElementCount;

        let record: Record<string, number> = {};
        let dataTitle: string = '';
        let dataItem:number = 0.00;

        
        contentCells.forEach((cell: HTMLTableCellElement, cellIdx: number) => {
            

                if ((cell.getAttribute('colSpan') && cell.colSpan > 1)) {       
                    console.log('colspan.................... ', cell.colSpan);
                    if (cell.firstElementChild?.tagName === 'TABLE') {
                        console.log(cell.firstElementChild.tagName);
                        cell.innerHTML = '';
                    }
                }

                if (cellIdx === 0) {
                    dataTitle = String(cell.textContent?.trim().replaceAll(/\s+/g, ' '));   
                }
                else if (cellIdx === dataCol) {
                        
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
    });

    //console.log(metadata);
    console.log(data);
}

// call our functions here
async function main() {
    console.log('..................................................');
    const htmlDoc: string = await fs.promises.readFile(path.join('./static/R2.htm'), 'utf-8');
    await testHTMLParsing(htmlDoc);
}

// run the test
main(); 