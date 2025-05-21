
const transformJSON = (data) => {
    const mapOfMasterKeys = new Map();
    const mergeHelper = new Map();
    const filingDates = [];

    const tbl = document.createElement("table");
    tbl.setAttribute('id', `${data[0].statementType}`);
    tbl.setAttribute('class', 'table table-striped table-bordered');

    const tHead = document.createElement("thead"); tHead.setAttribute('class', 'thead thead-light');
    const tBody = document.createElement("tbody");


    const headerTitleCell = document.createElement('th');

    // set the 1 row title
    headerTitleCell.innerHTML = `${data[0].parsedData.metadata.stmtType} <p /> ${data[0].parsedData.metadata.currency} ${data[0].parsedData.metadata.units}`//statementType}`;
    headerTitleCell.setAttribute('class', '');

    const headerRow = document.createElement('tr');
    headerRow.appendChild(headerTitleCell);

    // Normalize dates to 'YYYY-MM-DD' for consistent indexing
    // create headers for showing this document

    data.forEach((stmt, idx) => {
        const filingKey = new Date(stmt.filingDate).toISOString().split('T')[0];
        //const filingKey = `${new Date(stmt.filingDate).toISOString().split('T')[0]} - ${stmt.sourceFile}`;

        if (!mergeHelper.has(filingKey)) {
            mergeHelper.set(filingKey, mergeHelper.size); // assign next column index

            filingDates.push(filingKey);

            const headerCell = document.createElement('th');
            headerCell.setAttribute('class', 'text-nowrap');

            const stmtURI = document.createElement('a');
            stmtURI.setAttribute('href', `https://www.sec.gov/Archives/edgar/data/${stmt.cik}/${stmt.accessionNumber}/${stmt.sourceFile}`);
            stmtURI.setAttribute('target', `_blank`);
            stmtURI.innerHTML = `${filingKey}</p><sub>${stmt.parsedData.metadata.otherData}</sub>`;

            headerCell.appendChild(stmtURI);
            headerRow.appendChild(headerCell);
        }
    });

    // Collect all unique keys and initialize rows
    data.forEach((stmt) => {
        const filingKey = new Date(stmt.filingDate).toISOString().split('T')[0];
        const colIdx = mergeHelper.get(filingKey);
        console.log(stmt);

        stmt.parsedData.stmtData.forEach((entry) => {
            const key = Object.keys(entry)[0];
            const val = entry[key];

            if (!mapOfMasterKeys.has(key)) {
                mapOfMasterKeys.set(key, new Array(mergeHelper.size).fill(null));
            }
            mapOfMasterKeys.get(key)[colIdx] = val;
        });
    });


    // setup html table
    tHead.appendChild(headerRow);
    tbl.appendChild(tHead);

    const tableRows = [];
    mapOfMasterKeys.forEach((cols, rowLabel, map) => {
        const tblrow = document.createElement("tr");

        const headercell = document.createElement("td");
        headercell.innerHTML = rowLabel;
        tblrow.appendChild(headercell);

        const row = { rowLabel };

        filingDates.forEach((date, idx) => {
            row[date] = cols[idx];
            const cell = document.createElement("td");
            cell.innerHTML = cols[idx];
            tblrow.appendChild(cell);
        });

        tableRows.push(row);
        tBody.appendChild(tblrow);
    });

    tbl.appendChild(tBody);

    console.table(tableRows);
    return tbl;

};




// Definition of helper functions (copied from previous version for completeness)
function formatNumberSimple(value) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    if (value === null || value === undefined) return 'N/A';
    const cleanedValue = String(value).replace(/,/g, '');
    const num = parseFloat(cleanedValue);
    if (!isNaN(num)) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return String(value);
}
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e) { return dateString; }
}


document.addEventListener('DOMContentLoaded', async (evt) => {
    const form = document.getElementById('stmtForm');

    form.addEventListener('submit', async (evt) => {
        evt.preventDefault();

        const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
        const type = document.getElementById('statementTypeInput').value;
        const formType = document.getElementById('formTypeInput').value;
        const limit = document.getElementById('limitInput').value;
        const url = `http://localhost:3000/api/v1/statements/${ticker}?type=${type}&limit=${limit}&sortParam=desc&formType=${formType}`;

        const response = await fetch(url);
        const responseData = await response.json();
        const stmtData = responseData.data;

        const container = document.getElementById('stmtContainer');
        container.innerHTML = ''; // Clear old data
        container.appendChild(transformJSON(stmtData));
    });
});