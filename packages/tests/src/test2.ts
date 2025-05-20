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
        dataColIndex:1, // Default to 1 (0-indexed) for the first data column in TDs
        dataRowIndex:1,
        stmtType:'',
        period:'',
        otherData:''
    };

    // These variables seem to be for metadata extraction, which is good.
    // We'll focus on the data extraction part for the fix.
    let units:string = '';
    let [dataCol, dataRow]:[number, number] = [0,0]; // These seem related to TH col/rowspans
    let stmtType:string = '';
    let [period, otherData]:[string, string] = ['', ''];

    // end setup
    // ------------------------


    // select the table for parsing
    const table:HTMLTableElement | null = doc.querySelector('table.report'); 
    if (!table) {
        console.error('Table with className=report was not found');
        return;
    }
    console.log("Main table.report found.");

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

    // This logic for dataCellIdx needs to be robust.
    // It should determine the 0-based index of the *first actual data column* in the TD rows.
    let dataCellIdx: number = 1; // Default: 0 is item label, 1 is first data value
                                 // This will be refined based on header analysis.
    let lastSpan: number = 0; // Used in your original logic

    // Attempt to determine dataCellIdx from header structure
    const headerRowsForIdx = table.querySelectorAll(':scope > thead > tr, :scope > tr:has(th)');
    if (headerRowsForIdx.length > 0) {
        let itemDescColCount = 0;
        let firstMeaningfulHeaderRow = headerRowsForIdx[0]; // Start with the first one

        // Heuristic: The row that defines data columns is often the last header row or one with multiple distinct period texts
        for(let i = headerRowsForIdx.length - 1; i >= 0; i--) {
            if (headerRowsForIdx[i].querySelectorAll('th').length > 1) { // Needs at least Item + one Period header
                firstMeaningfulHeaderRow = headerRowsForIdx[i];
                break;
            }
        }
        
        const thCellsOfHeader = firstMeaningfulHeaderRow.querySelectorAll('th');
        let currentThEffectiveIndex = 0;
        let foundPeriodHeader = false;

        for (const thCell of Array.from(thCellsOfHeader)) {
            const colspan = parseInt(thCell.getAttribute('colspan') || '1', 10);
            const thText = thCell.textContent?.trim().toLowerCase() || '';

            // If it looks like a period/date header, stop counting item description columns
            if (/\d{4}/.test(thText) || /months ended/i.test(thText) || /quarter ended/i.test(thText) || /year ended/i.test(thText)) {
                foundPeriodHeader = true;
                break; 
            }
            itemDescColCount += colspan;
        }
        
        // dataCellIdx is the 0-based index for the first data column in the TD rows
        // If itemDescColCount is 1 (e.g. "Item"), data starts at TD index 1.
        // If itemDescColCount is 2 (e.g. "Item", "Note"), data starts at TD index 2.
        dataCellIdx = itemDescColCount > 0 ? itemDescColCount : 1; 
        // However, your original logic `else if (cellIdx === dataCellIdx)` implies dataCellIdx is the target index itself.
        // The item name is at cellIdx 0. The first data value is at dataCellIdx.
        // So if itemDescColCount is 1 (meaning first TH is item name), dataCellIdx should be 1.
        // If itemDescColCount is 2 (first two THs are item name/markers), dataCellIdx should be 2.
        // The logic `dataCellIdx = dataCellIdx - lastSpan` from your code was trying to get the start of the *last* header cell.
        // Let's use `itemDescColCount` as the index of the first data cell.
        dataCellIdx = itemDescColCount;


        console.log(`Determined dataCellIdx (0-based index for first data TD): ${dataCellIdx}`);

    } else {
        console.warn("No header rows (th) found to determine dataCellIdx. Defaulting to 1.");
        dataCellIdx = 1; // Fallback
    }


    const allRows = table.querySelectorAll(':scope > tbody > tr, :scope > tr'); // Get all rows again after potential removals

    allRows?.forEach((row, dataRowIdx)=> {
        const dataCellsPerRow = row.querySelectorAll('td'); // Only process TDs for data rows
        
        let record: Record<string, number> = {};
        let dataTitle: string = '';
        let dataItem: number = 0.00;

        if (dataCellsPerRow.length > 0) { // Ensure there are TD cells
            dataTitle = String(dataCellsPerRow[0].textContent?.trim().replaceAll(/\s+/g, ' '));

            // Check if the row has enough cells to reach the dataCellIdx
            if (dataCellsPerRow.length > dataCellIdx) {
                const cell = dataCellsPerRow[dataCellIdx]; // Get the target data cell
                if (cell) { // Ensure the cell exists
                    const value = cell.textContent?.replace(/[$,()]/g, '').trim() || "0";
                    let numericValue = parseFloat(value) * (cell.textContent?.includes('(') ? -1 : 1);
                    numericValue = Number(isNaN(numericValue) ? 0 : parseFloat(numericValue.toFixed(2))); // Default to 0 if NaN
                    dataItem = numericValue;
                } else {
                    // This case should be rare if dataCellIdx is calculated correctly relative to TD cells
                    console.warn(`Row ${dataRowIdx}: Data cell at index ${dataCellIdx} is undefined. Title: ${dataTitle}`);
                }
            } else {
                 // This row doesn't have enough cells to reach the dataCellIdx, likely a sub-header or note row
                 if (dataTitle) { // Only log if there was a title in the first cell
                    console.debug(`Row ${dataRowIdx}: Not enough cells for data. Title: "${dataTitle}". Cell count: ${dataCellsPerRow.length}, Expected data index: ${dataCellIdx}`);
                 }
            }
        }

        if (dataTitle) { // Only add record if there's a title
            record[dataTitle] = dataItem;
            data.push(record);
        }
    });
    console.log("Final Parsed Data:", data);
}

// call our functions here
async function main() {
    console.log('..................................................');
    // Assuming AMDR2.htm is in a 'static' folder relative to where this script runs
    const htmlFilePath = path.join(process.cwd(), 'static/AMDR2.htm');
    try {
        const htmlDoc: string = await fs.promises.readFile(htmlFilePath, 'utf-8');
        await testHTMLParsing(htmlDoc);
    } catch (err) {
        console.error("Error in main:", err);
    }
}

// run the test
main();