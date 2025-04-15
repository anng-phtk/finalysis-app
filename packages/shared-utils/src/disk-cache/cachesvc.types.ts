/** 
 * Allows consumers to configure service with options like
 * 1. where/which folder to look for sec files in local
 * 2. which files to look for
 *  
 * @interface 
 * */
export interface CacheSvcConfig {
    // simplest to put this in user homedir
    baseDir:string;
    fileName:string;
    fileURL:string; // if not in cache, this will be used to fetch the file 
    refreshAfter?:number; // dateModified + refreshAfter in days. If the resulting time is past that, then we will get new file from sec     
}

