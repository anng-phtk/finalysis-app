import path from "path";
import * as fs from 'fs';
import { homedir } from "os";

import { Log, LoggingService } from "../logging/logging.types.js";
import { RemoteFileSvc } from "../remote-fetch/remotefetch.types.js";
import { CacheFileOptions, CacheSvc, CacheSvcConfig } from "./cachesvc.types.js";
import { DiskCacheError, DiskCacheFailureCodes } from "../error-handlers/app-errors.js";


class CacheSvcImpl implements CacheSvc {
    private config:CacheSvcConfig;
    private logger;
    private cachelog:Log;
    private baseDirPath:string;
    private remoteFetcher;

    private numMilisInADay:number = 1000*60*60*24;

    constructor(cacheSvcConfig:CacheSvcConfig, remoteFileSvc:RemoteFileSvc, logger:LoggingService) {
        this.config = cacheSvcConfig;
        this.logger = logger;
        this.cachelog = logger.getLogger('cache-logger');
        this.baseDirPath = path.join(homedir(), this.config.cacheBaseDir);
        this.remoteFetcher = remoteFileSvc;
    }
    /**
     * @override
     * @returns {Promise<string>} - file content
     */
    public async getFileFromCache(fileOptions:CacheFileOptions): Promise<string> {
        console.log('........................')
        let maxRetries:number = this.config.maxCacheWriteRetry;
        while (maxRetries > 0) {

            // log the attempt for file fetch op
            let attemptNumber:number = this.config.maxCacheWriteRetry - maxRetries + 1;
            this.cachelog.debug(`[START] Start attempt number ${attemptNumber} for fetching file from cache.`)
            // increment. we only want to run this 2 times
            maxRetries--;

            try {
                // check if file is in cache
                this.cachelog.debug(`[IN PROGRESS] Looking for the file in cache.`);
                
                // check if this is a type of file thats refreshable
                if (fileOptions.canRefresh) {
                    // if file is more than 60 days old, we need a new one only if refreshCache is set to true
                    const fileModifiedDate = (await fs.promises.stat(path.join(this.baseDirPath, fileOptions.subDir, fileOptions.fileName))).mtime;
                
                    this.cachelog.debug(`[SUCCESS] Found file ${fileOptions.fileName} in cache. It was last modified on ${fileModifiedDate}.`);
                    const modifiedDate:Date = new Date(fileModifiedDate);
                    const fileAgeInMillis:number = Date.now() - modifiedDate.getTime();
                    const fileAgeInDays = Math.floor(fileAgeInMillis/this.numMilisInADay)
                    
                    if (fileOptions.refreshAfterDays && fileAgeInDays > fileOptions.refreshAfterDays) {
                        // rewrite the file
                        await this.refreshFileInCache(fileOptions);
                    }
                }
                
                const file:string = await fs.promises.readFile(path.join(this.baseDirPath, fileOptions.subDir, fileOptions.fileName), {
                    encoding:'utf-8'
                }); 
                
                return file;
                
            // if it fails, throw an error
            } catch (error) {
                this.cachelog.error(`[CATCH] error thrown. checking error type. Possible retry ${maxRetries}`);
                //if (maxRetries < this.writeRetry) throw error;
                const err = error as NodeJS.ErrnoException
                if (err.errno === -4058 && err.code === 'ENOENT' ) {
                    this.cachelog.error(`[RECOVERABLE ERROR] Either the file, or file and folder were not found locally.`);
                    // Starting retry 
                    this.cachelog.debug(`[IN PROGRESS] Trying to handle recoverable error. Creating the directory if it does not exist`);
                    
                    await fs.promises.mkdir(path.join(this.baseDirPath, fileOptions.subDir), {recursive:true});
                    this.cachelog.debug(`[IN PROGRESS] Folder created (or it already exists)`);
                    
                    this.cachelog.debug(`[IN PROGRESS] Fetching file from remote location.Look in remote-file-svc-log file for file download logs.`);
                    this.cachelog.debug(`[LOG BRANCH] remote-file-svc-log.`);
                    
                    const content = await this.remoteFetcher.getRemoteFile(fileOptions.fileURL);
                    this.cachelog.debug(`[IN PROGRESS] fetched from remote ${fileOptions.fileURL}`);
                    
                    await this.writeFileToCache(content, fileOptions);
                    this.cachelog.debug(`[IN PROGRESS] Now, retry file read operation`);

                    continue;
                }

                this.cachelog.error(`Unrecoverable error, ${error}`);   
                throw new DiskCacheError('Unrecoverable error in reading file from cache. Unable to get file from local or remote location.', DiskCacheFailureCodes.Unknown); 
                
            }
        }

        // After the while loop
        this.cachelog.error(`Failed to get file ${fileOptions.fileName} from cache after ${this.config.maxCacheWriteRetry ?? 2} attempts.`);
        throw new DiskCacheError(`Failed to get file ${fileOptions.fileName} after retries`, DiskCacheFailureCodes.Unknown);
    }

    /**
     * No one should need to access this method directly
     * @override
     * @returns {Promise<boolean>} - returns if file was written to cache
     */

    public async writeFileToCache(content:string, fileOptions:CacheFileOptions):Promise<boolean> {
        try {
            await fs.promises.writeFile(path.join(this.baseDirPath, fileOptions.subDir, fileOptions.fileName), content.toString(), {encoding:'utf-8'});
            return true;
        }
        catch (error) {
            this.cachelog.error(`File write error , failing, ${error}`); 
            throw new DiskCacheError('Failed to write file to cache', DiskCacheFailureCodes.FileSystemWrite);
        }
    }
    /**
     * The method can be invoked by external callers. But generally we will manage refreshing cached documents based on how old the exiting file is
     * @override
     * @returns {Promise<boolean>} - returns if file was written to cache
     */
    public async refreshFileInCache(fileOptions:CacheFileOptions): Promise<boolean> {
        
        try {
            const content = await this.remoteFetcher.getRemoteFile(fileOptions.fileURL);
            await this.writeFileToCache(content, fileOptions);
            return true;
        } catch (error) {
            this.cachelog.error(`Failed to refresh disk cache ${error}`);
            throw new DiskCacheError('Failed Cache Refresh', DiskCacheFailureCodes.RefreshFailed);
        }
        return false;
    }

}

// enforce singleton
let instance:CacheSvc|null;
export function createCacheSvc(config:CacheSvcConfig, remoteFileSvc:RemoteFileSvc, loggingSvc:LoggingService):CacheSvc {
    if (!instance) instance = new CacheSvcImpl(config,remoteFileSvc,loggingSvc);
    return instance;
}