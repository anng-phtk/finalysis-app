function clearResults() { document.getElementById('stmtContainer').innerHTML = ''; document.getElementById('statusArea').classList.add('hidden'); document.getElementById('errorArea').classList.add('hidden'); }
function logMessage(msg, data = null) { console.log(msg, data ? JSON.stringify(data, null, 2) : ''); }
    
function showLoading(isLoading) { document.getElementById('loadingIndicator').classList.toggle('hidden', !isLoading); }
function showInfo(message) { const sa = document.getElementById('statusArea'); sa.textContent = message; sa.className = 'alert alert-info'; sa.classList.remove('hidden'); document.getElementById('errorArea').classList.add('hidden'); document.getElementById('stmtContainer').innerHTML = `<p class="text-muted text-center">${message}</p>`; }
function showError(message) { const ea = document.getElementById('errorArea'); ea.textContent = message; ea.className = 'alert alert-danger'; ea.classList.remove('hidden'); document.getElementById('statusArea').classList.add('hidden'); }
function showStatus(message) { const sa = document.getElementById('statusArea'); sa.textContent = message; sa.className = 'alert alert-success'; sa.classList.remove('hidden'); document.getElementById('errorArea').classList.add('hidden'); }

const transformEquityJSON = (data) => {
    const container = document.createDocumentFragment();

    data.forEach(doc => {
        const stmtEquityData = doc.parsedData.equityData;
        const headers = doc.parsedData.headerData || [];

        const table = document.createElement("table");
        table.setAttribute('class', 'table table-striped table-sm');

        // Title
        const title = document.createElement("h4");

        title.textContent = `${doc.ticker} - ${doc.formType} Filed on: ` + formatDate(new Date(doc.filingDate).toISOString().split('T')[0]); //`${doc.ticker} – ${doc.formType} (${new Date(doc.filingDate.$date).toLocaleDateString()})`;
        container.appendChild(title);

        // Determine max columns from actual data if headerData missing
        const maxCols = Math.max(...stmtEquityData.map(obj => {
            return Object.values(obj)[0].length;
        }))

        // Table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.setAttribute('class', 'table-primary');

        // First column for "Line Item"
        const labelTh = document.createElement("th");
        labelTh.setAttribute('align', 'center');
        labelTh.setAttribute('valign', 'middle');
        labelTh.setAttribute('class', 'col-4');

        const stmtLink = document.createElement('a');
        stmtLink.setAttribute('href', `https://www.sec.gov/Archives/edgar/data/${doc.cik}/${doc.accessionNumber}/${doc.sourceFile}`)
        stmtLink.textContent = `${doc.parsedData.metadata.stmtType}`;
        labelTh.appendChild(stmtLink);

        headerRow.appendChild(labelTh);

        // Use headerData if present, else fallback to generic column labels
        //if (headers.length === maxCols) {
        headers.forEach(h => {
            const th = document.createElement("th");

            th.setAttribute('align', 'center');
            th.setAttribute('valign', 'middle');
            th.setAttribute('scope', 'col');
            th.setAttribute('class', 'col-1');
            th.setAttribute('style', 'text-align:center;');
            th.textContent = h;

            headerRow.appendChild(th);
        });


        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement("tbody");

        stmtEquityData.forEach(stmtItem => {
            const row = document.createElement("tr");
            const [label, values] = Object.entries(stmtItem)[0];

            const keyCell = document.createElement("td");

            keyCell.textContent = label;
            row.appendChild(keyCell);

            values.forEach(val => {
                const cell = document.createElement("td");
                cell.setAttribute('align', 'right')
                cell.textContent = formatNumberSimple(val);
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        container.appendChild(table);
    });

    return container;
};



const transformJSON = (data) => {
    const mapOfMasterKeys = new Map();
    const mergeHelper = new Map();
    const filingDates = [];

    const tbl = document.createElement("table");
    tbl.setAttribute('id', `${data[0].statementType}`);
    tbl.setAttribute('class', 'table table-striped table-bordered table-sm');

    const tHead = document.createElement("thead");
    tHead.setAttribute('class', 'thead');
    const tBody = document.createElement("tbody");


    const headerTitleCell = document.createElement('th');
    headerTitleCell.setAttribute('scope', 'col');
    headerTitleCell.setAttribute('class', 'col-2');
    headerTitleCell.setAttribute('style', 'text-align:center');
    // set the 1 row title
    headerTitleCell.textContent = data[0].parsedData.metadata.stmtType; //statementType}`;
    // <p /> ${data[0].parsedData.metadata.currency} ${data[0].parsedData.metadata.units}


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

            // create header titlecell and set its attributes
            const headerCell = document.createElement('th');
            headerCell.setAttribute('align', 'center');
            headerCell.setAttribute('valign', 'middle');
            headerCell.setAttribute('class', 'col-1');
            headerCell.setAttribute('style', 'text-align:center');

            const stmtURI = document.createElement('a');
            stmtURI.setAttribute('href', `https://www.sec.gov/Archives/edgar/data/${stmt.cik}/${stmt.accessionNumber}/${stmt.sourceFile}`);
            stmtURI.setAttribute('target', `_blank`);
            stmtURI.textContent = formatDate(filingKey);

            const subTxt = document.createElement('sub');
            const para = document.createElement('p');
            subTxt.textContent = stmt.parsedData.metadata.otherData;


            headerCell.appendChild(stmtURI);
            para.appendChild(subTxt);
            headerCell.appendChild(para);
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
        headercell.setAttribute('class', 'col-1');
        headercell.innerHTML = rowLabel;
        tblrow.appendChild(headercell);

        const row = { rowLabel };

        filingDates.forEach((date, idx) => {
            row[date] = cols[idx];
            const cell = document.createElement("td");
            cell.setAttribute('align', 'right');
            cell.innerHTML = formatNumberSimple(cols[idx]);
            //console.log(formatNumberSimple(cols[idx]), "................");
            tblrow.appendChild(cell);
        });

        tableRows.push(row);
        tBody.appendChild(tblrow);
    });

    tbl.appendChild(tBody);
    return tbl;
};




// Definition of helper functions (copied from previous version for completeness)
function formatNumberSimple(value) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }

    if (value === null || value === undefined) return '0.00';

    const cleanedValue = String(value).replace(/,/g, '');

    const num = parseFloat(cleanedValue);
    if (!isNaN(num)) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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

    /**
     * Main display router.
     */
    function displayStatements(statements) {
        const container = document.getElementById('stmtContainer');
        container.innerHTML = '';
        if (!statements || statements.length === 0) {
            showInfo('No statements to display.'); return;
        }

        const groupedByType = statements.reduce((acc, stmt) => {
            const type = stmt.statementType?.toUpperCase() || 'UNKNOWN';
            if (!acc[type]) acc[type] = [];
            acc[type].push(stmt);
            return acc;
        }, {});

        const typeOrder = ['BALANCE', 'INCOME', 'CASHFLOW', 'EQUITY'] //, 'EQUITY_SUMMARY', 'UNKNOWN']; // Added EQUITY_SUMMARY

        Object.keys(groupedByType).sort((a,b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)).forEach(statementTypeKey => {
            const group = groupedByType[statementTypeKey];
            if(group.length === 0) return;

            const sectionHeader = document.createElement('h2');
            sectionHeader.className = 'section-title';
            sectionHeader.textContent = `${statementTypeKey.replace(/_/g, ' ')} STATEMENTS`;
            container.appendChild(sectionHeader);

            if (statementTypeKey === 'EQUITY') {
                group.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()); // Sort individual equity statements
                group.forEach(stmt => container.appendChild(transformEquityJSON(group)));  //container.appendChild(renderSingleEquityTable(stmt)));
            } else if (statementTypeKey === 'EQUITY_SUMMARY' || statementTypeKey === 'INCOME' || statementTypeKey === 'BALANCE' || statementTypeKey === 'CASHFLOW') {
                container.appendChild(transformJSON(group)); // Use transformJSON for comparative
            } else {
                 logMessage(`No specific renderer for type: ${statementTypeKey}. Displaying raw.`);
                 group.forEach(stmt => {
                     const pre = document.createElement('pre');
                     pre.textContent = JSON.stringify(stmt, null, 2);
                     container.appendChild(pre);
                 });
            }
        });
    }
document.addEventListener('DOMContentLoaded', async (evt) => {
    const form = document.getElementById('stmtForm');
    const container = document.getElementById('stmtContainer');


    form.addEventListener('submit', async (evt) => {
        evt.preventDefault();

        stmtContainer.innerHTML = '<p class="text-info">Fetching data...</p>';
        showLoading(true); // Show loading indicator

        const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
        const type = document.getElementById('statementTypeInput').value;
        const formType = document.getElementById('formTypeInput').value;
        const limit = document.getElementById('limitInput').value;
        const sort = document.getElementById('sortInput')

        const queryParams = new URLSearchParams();
        // Only add 'type' to query if a specific type is selected
        if (type) queryParams.append('type', type);
        if (formType) queryParams.append('formType', formType);
        if (limit) queryParams.append('limit', limit);
        if (sort) queryParams.append('sort', sort);


        const url = `http://localhost:3000/api/v1/statements/${ticker}?${queryParams.toString()}`;

            try {
                const response = await fetch(url);
                const responseData = await response.json();
                const stmtData = responseData.data;

                //const container = document.getElementById('stmtContainer');
                container.innerHTML = 'Loading...'; // Clear old data

                logMessage("API Response:", responseData);

                    // Using your corrected check
                    if (responseData.statusCode === 200 && Array.isArray(responseData.data)) {
                        container.innerHTML = ''; // Clear loading message

                        if (responseData.data.length > 0) {
                            displayStatements(responseData.data); // Call the router function
                            /*    
                            if (type !== 'EQUITY') {
                                container.appendChild(transformJSON(stmtData));
                            }
                            else {
                                container.appendChild(transformEquityJSON(stmtData));
                            }
                            */
                            showStatus(`Successfully displayed ${responseData.data.length} statements.`);
                        }
                        else {
                                showInfo(`No statements found matching the criteria.`);
                        }
                    } else {
                        throw new Error(responseData.messageTxt || "Invalid data structure from API.");
                    }
                } catch (error) {
                console.error("Fetch or transform error:", error);
                showError(`Error: ${error.message}`);
            } finally {
                showLoading(false); // Hide loading indicator
            }
        });
});