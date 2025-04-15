import { Db, MongoClient } from "mongodb";
import { LoggingService } from "../logging/logging.types.js";

export interface MongoClientConfiguration {
    uri:string; //mongodb://localhost:<port>
    dbName:string
}

// MongoDB errors
export class MongDBError extends Error {

    constructor(message: string = 'MongoDB Error') {
        super(message)

        // set error name
        this.name = this.constructor.name;
        if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    }
}

export interface MongoConnectionService {
    connect():Promise<void>
    disconnect():Promise<void>
    getClient():MongoClient;
    getDB():Db;
    //registerMongoEvents():void;
}
