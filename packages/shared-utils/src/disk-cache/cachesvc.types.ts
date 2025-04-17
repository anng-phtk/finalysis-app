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
    cacheBaseDir:string;  
    maxCacheWriteRetry:number;  
}

export interface CacheSvc {
    getFileFromCache(fileOptions:CacheFileOptions):Promise<string>;
    refreshFileInCache(fileOptions:CacheFileOptions):Promise<boolean>;
    writeFileToCache(content:string, fileOptions:CacheFileOptions):Promise<boolean>;
}

export interface CacheFileOptions {
    subDir:string; 
    fileName:string;
    fileURL:string;
    canRefresh:boolean;
    refreshAfterDays?:number; // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec 
} 