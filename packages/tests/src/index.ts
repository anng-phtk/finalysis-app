import { strict } from 'assert';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import path from 'path';


async function testHTMLParsing(htmlContent: string): Promise<void> {
    const dom: JSDOM = new JSDOM(htmlContent);
    const doc: Document = dom.window.document;


    const data: Array<Record<string, string | number>> = [];
    // ------------------------------------------
    // start setup

    let metadata = {
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


    // this function is to determine what kind of a table we are dealing with.
    // we can make the determination on what to parse
    // select the table for parsing
    const table: HTMLTableElement | null = doc.querySelector('table.report');
    if (!table) throw new Error('Table with className=report was not found');

    // --- PRE-PROCESSING: Remove rows containing nested footnote tables ---
    // Find all TD cells that directly contain a table with class 'outerFootnotes'
    const cellsWithFootnoteTables: NodeListOf<HTMLTableCellElement> = table.querySelectorAll('td > table.outerFootnotes');
    console.log(`Found ${cellsWithFootnoteTables.length} nested 'outerFootnotes' tables.`);

    cellsWithFootnoteTables.forEach(footnoteTable => {
        // Find the parent TD of this footnote table
        const parentCell = footnoteTable.parentElement;
        if (parentCell && parentCell.tagName === 'TD') {
            // Find the parent TR of that TD
            const parentRow = parentCell.closest('tr');
            if (parentRow && parentRow.parentElement) {
                console.log("Removing entire row containing a footnote table:", parentRow.outerHTML.substring(0, 150) + "...");
                parentRow.parentElement.removeChild(parentRow);
            } else {
                console.warn("Could not find parent <tr> for a cell containing a footnote table, or it has no parent.", parentCell);
            }
        } else {
             console.warn("Could not find parent <td> for a footnote table, or footnote table is not a direct child of td.", footnoteTable);
        }
    });
    // --- END PRE-PROCESSING ---



    // I expect queryselector selects only 1st element
    // so lets get the 1st row and fix the x, y positions of our data rows.
    // then we can parse the data out of data rows
    const firstRow = table.querySelector(':scope thead > tr,:scope tbody > tr,, :scope tr ');
    const cellsOfFirstRow = firstRow?.querySelectorAll(':scope th');

    let dataCellIdx: number = 0;
    let lastSpan: number = 0;
    cellsOfFirstRow?.forEach(cell => {
        lastSpan = Number(cell.getAttribute('colSpan')) ?? 1;
        dataCellIdx += lastSpan;
    });

    // remove the last rowspan and that will be our data index
    dataCellIdx = dataCellIdx - lastSpan;


    const allRows = table.querySelectorAll(':scope thead > tr,:scope tbody > tr, :scope tr');

    allRows?.forEach((row, dataRowIdx) => {
        const dataCellsPerRow = row.querySelectorAll('td');
        
        let record: Record<string, number> = {};
        let dataTitle: string = '';
        let dataItem: number = 0.00;

        dataCellsPerRow?.forEach((cell, cellIdx) => {
            
            if ((cell.hasAttribute('colSpan') && Number(cell.getAttribute('colSpan')) > lastSpan)) {       
                if (cell.firstElementChild?.tagName === 'TABLE') {
                    console.log(cell.firstElementChild.tagName);
                    cell.removeChild(cell.firstElementChild);
                }
            }

            if (cellIdx === 0) {
                //dataTitle = cell.textContent??'';
                dataTitle = String(cell.textContent?.trim().replaceAll(/\s+/g, ' '));

            } else if (cellIdx === dataCellIdx) {
                //dataItem = Number(cell.textContent) ?? 0;
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

    console.log(data);
}

// call our functions here
async function main() {
    console.log('..................................................');
    const htmlDoc: string = await fs.promises.readFile(path.join('./static/R4.htm'), 'utf-8');
    await testHTMLParsing(htmlDoc);
}

// run the test
main(); 