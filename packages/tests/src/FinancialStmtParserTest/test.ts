import * as fs from 'fs';
import path from 'path';
import {createFinancialStmtParserSvc, createLoggingSvc, FinancialStmtParserSvc, LoggingService, ParsedStatement} from "@finalysis-app/shared-utils";

//financialstmtparser
const loggingSvc:LoggingService = createLoggingSvc({
        env: 'dev',
        type: 'both',
        level: 'debug',
        maxLogSize: 100,
        backups: 1,
        compress: true
    });


loggingSvc.getLogger('financialstmtparser');
const parserTester: FinancialStmtParserSvc = createFinancialStmtParserSvc(loggingSvc);


// call our functions here
async function main() {
    console.log('..................................................');
    // Assuming AMDR2.htm is in a 'static' folder relative to where this script runs
    const htmlFilePath = path.join(process.cwd(), '../src/static/AMDEquityR7.htm');
    try {
        const htmlDoc: string = await fs.promises.readFile(htmlFilePath, 'utf-8');
        const data:ParsedStatement = parserTester.parseStatement(htmlDoc);
        //const data:ParsedStatement = parserTester.parseEquityStatement(htmlDoc)
        console.log(data);
        
    } catch (err) {
        console.error("Error in main:", err);
    }
}

// run the test
main();