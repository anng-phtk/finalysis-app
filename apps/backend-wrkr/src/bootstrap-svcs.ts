import { CacheSvc, CacheSvcConfig, createCacheSvc, createFinancialStmtParserSvc, createLoggingSvc, 
    createMongoConnection, 
    createRedisJobsSvc, createRedisSvc, createRemoteFetchSvc, createStatementDao, 
    FinancialStmtParserSvc, Log, LoggingService, LoggingServiceConfigOptions, MongoClientConfiguration, 
    RedisJobsSvc, RedisService, RedisServiceConfig, RemoteFileSvc, RemoteFileSvcConfig, 
    StatementDao } from "@finalysis-app/shared-utils";





export const bootstrapApiServices = async () => {
    // initialize Logger
    const loggingOptions: LoggingServiceConfigOptions = {
        env: 'dev',
        type: 'both',
        level: 'error',
        maxLogSize: 10000,
        backups: 2,
        compress: true
    };
    const loggingSvc: LoggingService = createLoggingSvc(loggingOptions);
    const log: Log = loggingSvc.getLogger('wrkr-main');

    

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
    const mongoConnection = createMongoConnection(dbConfig, loggingSvc);
    await mongoConnection.connect();

    
    // create DAO service
    const statementDao: StatementDao = createStatementDao(mongoConnection.getDB(), loggingSvc);

    return {
        loggingSvc, log,
        redisSvc, redisJobSvc,
        remotefetchSvc,
        fileSvc,
        stmtParserSvc,
        mongoConnection,
        statementDao
    }
}