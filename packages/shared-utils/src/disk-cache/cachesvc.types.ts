import { LoggingService, LoggingServiceConfigOptions } from "../logging/logging.types.js";
import * as fs from 'fs';
import { homedir } from "os";
import path from "path";
import { RemoteFileSvc, RemoteFileSvcConfig } from "../utils/remotefetch.types.js";
import { createRemoteFetchSvc } from "../utils/RemoteFetchSvcImpl.js";
import { createLoggerSvc } from "../logging/LoggingSvcImpl.js";

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
    writeFileToCache():Promise<boolean>;
}

class CacheSvcImpl implements CacheSvc {
    private config:CacheSvcConfig;
    constructor(cacheSvcConfig:CacheSvcConfig, logger:LoggingService) {
        this.config = cacheSvcConfig;

    }
    /**
     * @override
     * @returns {Promise<string>} - file content
     */
    public async getFileFromCache(): Promise<string> {
        try {
            // check if file is in cache
            const file = await fs.promises.readFile(path.join(homedir(), this.config.cacheDir, this.config.fileName), {encoding:'utf-8'}); 
            // if its not get it from remote location
            if (!file) {
                const fileFetcherSvc:RemoteFileSvc = createRemoteFetchSvc({
                    url:this.config.fileURL,
                    retry:3,
                    backOff:3,
                    retryDelay:1000,
                    timeout:5000
                } as RemoteFileSvcConfig, 
                createLoggerSvc({type:'both'} as LoggingServiceConfigOptions));

                // write this file to cache
                //const remoteFile:Promise<string> = await fileFetcherSvc.getRemoteFile();
            }
            


            // return the content
            return new Promise(resolve=>'');
            
        // if it fails, throw an error
        } catch (error) {
            throw error;
        }
        
    }

    /**
     * No one should need to access this method directly
     * @override
     * @returns {Promise<boolean>} - returns if file was written to cache
     */

    public async writeFileToCache():Promise<boolean> {

        return false;
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