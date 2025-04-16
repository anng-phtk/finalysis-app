import { Log, LoggingService, LoggingServiceConfigOptions } from "../logging/logging.types.js";
import * as fs from 'fs';
import { homedir } from "os";
import path from "path";
import { RemoteFileSvc, RemoteFileSvcConfig } from "../utils/remotefetch.types.js";
import { createRemoteFetchSvc } from "../utils/RemoteFetchSvcImpl.js";
import { createLoggerSvc } from "../logging/LoggingSvcImpl.js";
import { rejects } from "assert";

/** 
 * Allows consumers to configure service with options like
 * 1. where/which folder to look for sec files in local
 * 2. which files to look for
 * for general app-wide files like cik_tiker_company.json: these will be stored to homedir/application dir
 * for ticker specific data like filingSummary.xml: these will be in ticker folders.
 *  
 * @interface 
 * */
export interface CacheSvcConfig {
    cacheDir:string; 
    fileName:string;
    fileURL:string; // if not in cache, this will be used to fetch the file 
    refreshAfter?:number; // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec     
}

export interface CacheSvc {
    
    getFileFromCache():Promise<string>;
    refreshFileInCache():Promise<boolean>;
    writeFileToCache(content:string):Promise<boolean>;
    writeRetry:number;
}

export class CacheSvcImpl implements CacheSvc {
    private config:CacheSvcConfig;
    private cachelog:Log;
    public readonly writeRetry:number = 2;
    constructor(cacheSvcConfig:CacheSvcConfig, logger:LoggingService) {
        this.config = cacheSvcConfig;
        this.cachelog = logger.getLogger('cache-logger');
    }
    /**
     * @override
     * @returns {Promise<string>} - file content
     */
    public async getFileFromCache(): Promise<string> {
        let maxRetries = 1;
        while (maxRetries<this.writeRetry) {
            // increment. we only want to run this 2 times
            maxRetries++;

            try {
                // check if file is in cache
                this.cachelog.debug(`starting to log `)
                const file = await fs.promises.readFile(path.join(homedir(), "finalysis-app", this.config.cacheDir, this.config.fileName), {
                    encoding:'utf-8'
                }); 

                return file;
                
            // if it fails, throw an error
            } catch (error) {
                this.cachelog.error(`error thrown. checking error type. Possible retry ${maxRetries}`);

                //if (maxRetries < this.writeRetry) throw error;
                const err = error as NodeJS.ErrnoException
                if (err.errno === -4058 && err.code === 'ENOENT' ) {
                    this.cachelog.error(`File or folder not found error. Recoverable.`);
                    
                    // retry 
                    this.cachelog.debug(`creating directory`);
                    await fs.promises.mkdir(path.join(homedir(), "finalysis-app", this.config.cacheDir), {recursive:true});
                    this.cachelog.debug(`folder created`);

                    this.cachelog.debug(`fetching file`);
                    const fileFetcherSvc:RemoteFileSvc = createRemoteFetchSvc({
                        url:this.config.fileURL,
                        retry:3,
                        backOff:3,
                        retryDelay:1000,
                        timeout:5000
                    } as RemoteFileSvcConfig, 
                    createLoggerSvc({type:'both'} as LoggingServiceConfigOptions));
                    this.cachelog.debug(`Fetched file and folder created`);
                    const content = await fileFetcherSvc.getRemoteFile()
                    this.writeFileToCache(content);
                    this.cachelog.debug(`retry file read operation`);
                    continue;
                }

                this.cachelog.error(`Unrecoverable error, failing`);    
                throw error;

            }
        }

        return new Promise(rejects=>rejects(''));
    }

    /**
     * No one should need to access this method directly
     * @override
     * @returns {Promise<boolean>} - returns if file was written to cache
     */

    public async writeFileToCache(content:string):Promise<boolean> {
        try {
            await fs.promises.writeFile(path.join(this.config.cacheDir, "finalysis-app", this.config.fileName), content.toString(), {encoding:'utf-8'});
            return false;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * The method can be invoked by external callers. But generally we will manage refreshing cached documents based on how old the exiting file is
     * @override
     * @returns {Promise<boolean>} - returns if file was written to cache
     */
    public async refreshFileInCache(): Promise<boolean> {
        
        return false;
    }

}
