import {
    CacheSvc, CacheSvcConfig, createCacheSvc,
    createLoggingSvc, Log, LoggingService, LoggingServiceConfigOptions,
    createRedisSvc, RedisService, RedisServiceConfig,
    createRemoteFetchSvc, RemoteFileSvc, RemoteFileSvcConfig,
    RedisJobsSvc,
    createRedisJobsSvc,
    FinancialStmtParserSvc,
    createFinancialStmtParserSvc,
    StatementDao,
    createStatementDao,
    MongoClientConfiguration,
    createMongoConnection,
} from '@finalysis-app/shared-utils';

import { configDotenv } from 'dotenv';

import { wrkrLookupCIK } from './workers/lookupCIK.js';
import { wrkrLookupRecentFilings } from './workers/lookupRecentFilings.js';
import { wrkrFetchFilingSummaries } from './workers/fetchFilingSummaries.js';
import { wrkrFetchStatments } from './workers/fetchStatements.js';
import { bootstrapApiServices } from './bootstrap-svcs.js';

// define env
configDotenv({ path: '../../.env' });


console.timeStamp('Worker Setup');

const bootstrap = await bootstrapApiServices();
// initialize Logger
const loggingSvc: LoggingService = bootstrap.loggingSvc;
const log:Log = bootstrap.log; //loggingSvc.getLogger('wrkr-main');

// init Redis Connection
const redisSvc: RedisService = bootstrap.redisSvc
const redisJobSvc: RedisJobsSvc = bootstrap.redisJobSvc;
// init remote files
const remotefetchSvc: RemoteFileSvc = bootstrap.remotefetchSvc;

// initialize local cache fetching
const fileSvc: CacheSvc = bootstrap.fileSvc;
const stmtParserSvc: FinancialStmtParserSvc = bootstrap.stmtParserSvc;
// create DAO service
const statementDao: StatementDao = bootstrap.statementDao;

// --- Graceful Shutdown Setup ---
let isShuttingDown = false;
function signalShutdown() {
    if (!isShuttingDown) {
        log.warn('>>> Shutdown signal received! Worker loop will stop after current cycle/timeout. <<<');
        isShuttingDown = true;
    }
};


process.on('SIGTERM', signalShutdown);
process.on('SIGINT', signalShutdown); // Catches Ctrl+C

async function runCentralWorker(redisJobSvc:RedisJobsSvc, fileSvc:CacheSvc, stmtParserSvc:FinancialStmtParserSvc, stmtDao:StatementDao, loggingSvc:LoggingService) {
log.info('Starting central worker loop...');
    while (!isShuttingDown) {
        let workDoneInCycle = false;
        try {
            // Sequentially try to process one job from each queue
            workDoneInCycle ||= await wrkrLookupCIK(redisJobSvc, fileSvc, loggingSvc.getLogger('wrkr-cik'));
            workDoneInCycle ||= await wrkrLookupRecentFilings(redisJobSvc, fileSvc, loggingSvc.getLogger('wrkr-filings'));
            workDoneInCycle ||= await wrkrFetchFilingSummaries(redisJobSvc, fileSvc, loggingSvc.getLogger('wrkr-summary'));
            workDoneInCycle ||= await wrkrFetchStatments(redisJobSvc, fileSvc, stmtParserSvc, statementDao, loggingSvc.getLogger('wrkr-statements'));
            // ... add other stages ...

            // Pause only if completely idle AND using timed BLPOP internally
            if (!workDoneInCycle && !isShuttingDown) {
                log.info('Idle cycle, pausing...');
                console.log('Idle cycle, pausing...');
                await new Promise(resolve => setTimeout(resolve, 200)); // Adjust pause as needed
            }
            // Optional yield
            // await setImmediate();

        } catch (loopError) {
            log.error('Critical error in central worker loop!');
            if (!isShuttingDown) await new Promise(resolve => setTimeout(resolve, 5000)); // Pause after error
        }
    } // end while
    log.info('Central worker loop exited.');
    console.log('Central worker loop exited.');
}

// --- Main Startup Function ---
async function startApp() {
    try {
        log.info('Dependencies initialized. Starting worker loop.');
        // Start the loop directly, passing dependencies
        await runCentralWorker(redisJobSvc, fileSvc, stmtParserSvc, statementDao, loggingSvc); // Pass main logger or loggerSvc

    } catch (startupError) {
        console.error("FATAL: Worker failed during startup.", startupError);
        process.exitCode = 1;
    } finally {
        // Final cleanup (ensure this runs after loop exits)
        const shutdownLogger = loggingSvc?.getLogger('shutdown') ?? console;
        shutdownLogger.warn('Performing final cleanup...');
        // await dbConnection.disconnect();
        // await redisSvc.disconnect();
        // if (loggingSvc) await new Promise<void>(resolve => loggingSvc.shutdown(resolve));
        shutdownLogger.warn('Cleanup complete. Exiting.');
    }
}

// --- Run ---
startApp();