/**
 * @interface
 */
export interface RemoteFileSvcConfig {
    retry: number;
    retryDelay: number;
    backOff: 2 | 3 | 4;
    timeout: number;
}

/**
 * Utility function to get the file extension from a URL.
 * @interface RemoteFileSvcConfig 
 * */
export interface RemoteFileSvc {
    getRemoteFile(fileURL:string): Promise<string>;
}
