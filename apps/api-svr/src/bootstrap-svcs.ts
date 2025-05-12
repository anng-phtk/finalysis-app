import { CacheSvc, CacheSvcConfig, createCacheSvc, createLoggingSvc, createMongoConnection, createRedisSvc, createRemoteFetchSvc, createStatementDao, LoggingService, LoggingServiceConfigOptions, MongoClientConfiguration, MongoConnectionService, RedisService, RedisServiceConfig, RemoteFileSvc, RemoteFileSvcConfig, StatementDao } from "@finalysis-app/shared-utils";





export const bootstrapApiServices = async () => {

    /**
     * 1.  Initialize Logging Service
     */
    const loggingOptions: LoggingServiceConfigOptions = {
        env: 'dev',
        filename: 'api-svc.log',
        type: 'both',
        level: 'debug',
        maxLogSize: 10240,
        backups: 2,
        compress: true
    }
    const loggingSvc: LoggingService = createLoggingSvc(loggingOptions);

    /**
     * 2. Initialize Redis
     */
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

    /**
     * 3. Initialize the Remote File Fetcher Svc
     * Pass this as a dependency into File Fetcher to get file from remote location if it is not found locally.
     */
    const remotefetcher: RemoteFileSvc = createRemoteFetchSvc({
        // url:url,
        retry: 3,
        retryDelay: 1000,
        backOff: 3,
    } as RemoteFileSvcConfig, loggingSvc);

    /**
     * 4. Initialize fetching file from local disk
     * 
     */
    const cachedFileConfig: CacheSvcConfig = {
        cacheBaseDir: 'finalysis-app',   // will stay unchanged through out the life of our app
        maxCacheWriteRetry: 2
    };
    const cacheSvc: CacheSvc = createCacheSvc(cachedFileConfig, remotefetcher, loggingSvc);
    /**
     * 5. Init Mongo
     */

    //configure db connection
    const dbConfig: MongoClientConfiguration = {
        uri: process.env.MONGO_HOST ?? 'mongodb://localhost:27017',
        dbName: process.env.DB_NAME ?? 'finalysisdb'
    };

    //connect to the db
    const mongoConnection:MongoConnectionService = createMongoConnection(dbConfig, loggingSvc);
    await mongoConnection.connect();
    const mongoClient = mongoConnection.getClient();
    const collection = mongoConnection.getDB();

    /**
     * 6. Iniit Statement DAO
     */
    const stmtDao: StatementDao = createStatementDao(collection, loggingSvc)
    // -------------------------------
    // initialize all deps - done
    // -------------------------------
    // now provide a bootstrap function
    return {
        loggingSvc,                 //1
        redisSvc,                   //2
                                    //3 - remote fetcher not needed
        cacheSvc,                   //4
        mongoConnection,            //5 - Monogo not required
        mongoClient, collection,    //5a. - Mongo stuff in case it is required.
        stmtDao                     //6
    };
}
