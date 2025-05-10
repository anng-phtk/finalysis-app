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
    JobsMetadata,
} from '@finalysis-app/shared-utils';

import { configDotenv } from 'dotenv';

import { wrkrLookupCIK } from './workers/lookupCIK.js';
import { wrkrLookupRecentFilings } from './workers/lookupRecentFilings.js';
import { wrkrFetchFilingSummaries } from './workers/fetchFilingSummaries.js';
import { wrkrFetchStatments } from './workers/fetchStatements.js';
import { checkActiveJobs } from './workers/checkActiveJobs.js';
import { MessageTypes } from './pub-sub/message.types.js';

// define env
configDotenv({ path: '../../.env' });


console.timeStamp('Worker Setup');
// initialize Logger
const loggingOptions: LoggingServiceConfigOptions = {
    env: 'dev',
    type: 'both',
    level: 'debug',
    maxLogSize: 10000,
    backups: 2,
    compress: true
};
const loggingSvc: LoggingService = createLoggingSvc(loggingOptions);
const log:Log = loggingSvc.getLogger('wrkr-main');


// init Redis Connection
const redisConfig: RedisServiceConfig = {
    commandConnectionOptions: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    },
    subscriberOptions: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
};
const redisSvc: RedisService = createRedisSvc(redisConfig, loggingSvc);
const redisJobSvc: RedisJobsSvc = createRedisJobsSvc(redisSvc, loggingSvc);


// initialize remoteFile fetcher, its needed for our cache file fetcher
const fetchConfig: RemoteFileSvcConfig = {
    timeout: 2000,
    retryDelay: 1000,
    retry: 3,
    backOff: 2
};
const remotefetchSvc: RemoteFileSvc = createRemoteFetchSvc(fetchConfig, loggingSvc);

// initialize local cache fetching
const cacheConfig: CacheSvcConfig = {
    cacheBaseDir: 'finalysis-app',
    maxCacheWriteRetry: 2,
};
const fileSvc: CacheSvc = createCacheSvc(cacheConfig, remotefetchSvc, loggingSvc);
const stmtParserSvc: FinancialStmtParserSvc = createFinancialStmtParserSvc(loggingSvc);


//configure db connection
const dbConfig: MongoClientConfiguration = {
    uri: process.env.MONGO_HOST ?? 'mongodb://localhost:27017',
    dbName: process.env.DB_NAME ?? 'finalysisdb'
};

//connect to the db
const dbConnection = createMongoConnection(dbConfig, loggingSvc);
dbConnection.connect();

// create DAO service
const statementDao: StatementDao = createStatementDao(dbConnection.getDB(), loggingSvc);

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
                await new Promise(resolve => setTimeout(resolve, 1000)); // Adjust pause as needed
            }
            // Optional yield
            // await setImmediate();

        } catch (loopError) {
            log.error('Critical error in central worker loop!');
            if (!isShuttingDown) await new Promise(resolve => setTimeout(resolve, 5000)); // Pause after error
        }
    } // end while
    log.info('Central worker loop exited.');
}

// --- Main Startup Function ---
async function startApp() {
    try {
        // ... (Initialize all services as you have done) ...
        await dbConnection.connect(); // Ensure DB is connected before starting loop
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