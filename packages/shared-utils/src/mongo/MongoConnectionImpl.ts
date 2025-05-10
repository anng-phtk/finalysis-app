import { CommandFailedEvent, Db, MongoClient, MongoClientOptions } from "mongodb";
import { MongDBError, MongoClientConfiguration, MongoConnectionService } from "./mongo.types.js";
import { Log, LoggingService } from "../logging/logging.types.js";


class MongoConnectionServiceImpl implements MongoConnectionService {
    private config:MongoClientConfiguration;
    private client:MongoClient;
    private db:Db;
    private log:Log;

    /**
     * @constructor
     * @param {MongoClientConfiguration} config - passing in uri: "mongodb://192.186.1.96:27017" and db:finalysis-app 
     * @param logger - log4js logger with .debug(), .warn, .erroor methods for logging
      */
    constructor(config:MongoClientConfiguration, loggingSvc:LoggingService) {
        this.config = config;

        this.log = loggingSvc.getLogger('mongdb');
        this.client = new MongoClient(config.uri);
        this.db = this.client.db(config.dbName);
        this.registerListeners();
    }

    /**
     * @override
     * @@returns {Promise<void>}
     * 
     */
    public async connect(): Promise<void> {
        try {

            this.log.info(`Connecting to MongoDB: ${this.config.uri}`);
            await this.client.connect();
            // test the connection 
            await this.client.db(this.config.dbName).command({ping:1});
            this.log.info(`success: pinged db: ${this.config.dbName}`);
        } catch (error) {
            this.log.error(`Error ocurred connecting to mongodb. check ${this.config.uri} and ${this.config.dbName}`);
            throw new MongDBError(`Mongo Connection Failed: ${error}`)
        }
    }
    /**
     * @override
     * @returns {Promise<void>}
     * 
     */
    public async disconnect():Promise<void> {
        try {
            await this.client.close(true);
            
        } catch (error) {
            this.log.debug('error ocurred connecting to mongodb');
        }
    }
    /**
     * @override
     * @returns {MongoClient} - returns mongo client
     */
    public getClient(): MongoClient {
        return this.client;
    }

    /**
     * @override
     * @returns {Db} - returns mongo db
     */
    public getDB(): Db {
        return this.db;
    }

    /**
     * Register Mongo Client Events
     * @returns {void}
     */
    public registerListeners():void {
        this.client.on('open', (event:CommandFailedEvent)=> {
            this.log.debug(`Mongo connected`);
        });

        this.client.on('close', ()=>{
            this.log.debug(`Connection closed`);
        });

        this.client.on('connectionClosed', ()=>{
            this.log.debug(`Mongo connection closed`);
        });
        this.client.on('commandFailed', (event:CommandFailedEvent)=> {
            this.log.debug(`Mongo command failed`);
        });
        this.client.on('commandStarted', (event:CommandFailedEvent)=> {
            this.log.debug(`Mongo command started`);
        });
        this.client.on('commandSucceeded', (event:CommandFailedEvent)=> {
            this.log.debug(`Mongo command succeeded`);
        });
    }
}


let cachedClient:MongoConnectionService|null = null;
export function createMongoConnection(config:MongoClientConfiguration, logger:LoggingService):MongoConnectionService {
    if (!cachedClient) {
        cachedClient = new MongoConnectionServiceImpl(config, logger);
    }

    return cachedClient;
}