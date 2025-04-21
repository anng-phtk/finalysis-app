import { HTTPResponseError, RemoteFetchError } from "../error-handlers/app-errors.js";
import { Log, LoggingService } from "../logging/logging.types.js";
import { RemoteFileSvc, RemoteFileSvcConfig } from "./remotefetch.types.js";

class RemoteFileSvcImpl implements RemoteFileSvc {
    private config: RemoteFileSvcConfig;
    private log: Log;

    constructor(config: RemoteFileSvcConfig, logger: LoggingService) {
        this.config = config;
        this.log = logger.getLogger('remote-file-svc');

    }
    /**
     * Fetches a remote file from the specified URL.
     * @returns {Promise<string>} - A promise that resolves to the content of the remote file as a string.
     * @throws {HTTPResponseError} - Throws an error if the fetch fails or if the response is not ok.
     */
    async getRemoteFile(fileURL:string): Promise<string> {
        let url:string = fileURL;
        let response: Response;
        let numRetry:number = this.config.retry;
        let retryDelay:number = this.config.retryDelay;

        this.log.debug(`[START] Start fetching remote file from URL: ${url}`);

        while (numRetry > 0) {
            try {
                response = await fetch(url, {
                    headers: {
                        "User-Agent": "Finalysis-App finalyze.admin@gmail.com"
                    }
                });

                if (response.ok) {
                    this.log.debug(`[IN PROGRESS] Called ${url} and got ${response.ok} for file with ${response.headers.get('content-type')}`);

                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const content = await response.json();
                        // Decide: Return object or stringify? Returning object is usually better.
                        const content2String = JSON.stringify(content);
                        this.log.debug(`[FINISHED] Called ${url} and got ${response.ok}. Returning JSON:\n${content2String.substring(0, 100)}`);
                        return content2String; // Return parsed object
                        //return content;
                    } else if (contentType && (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/xml'))) {

                        const content = await response.text();
                        this.log.debug(`[FINISHED] Called ${url} and got ${response.ok}.  body:\n${content.substring(0, 100)}`);

                        return content;

                    } else {
                        this.log.error(`[REMOTE RESPONSE] Called ${url} and got ${response.status}.`);
                        
                        switch (response.status) {
                            case 400:
                                
                                throw new HTTPResponseError('Bad Request', response.statusText, response.status);
                            case 401:
                                throw new HTTPResponseError('Unauthorized', response.statusText, response.status);
                            case 403:
                                throw new HTTPResponseError('Forbidden', response.statusText, response.status);
                            case 404:
                                throw new HTTPResponseError('Not Found', response.statusText, response.status);
                            case 429:
                                // Handle rate limiting
                                this.log.error(`[RECOVERABLE] Got rate limited. Backoff and retrying ${url} after ${retryDelay} sec`);
                                throw new HTTPResponseError('Too Many Requests', response.statusText, response.status);
                            case 500:
                                throw new HTTPResponseError('Internal Server Error', response.statusText, response.status);
                            case 503:
                                throw new HTTPResponseError('Service Unavailable', response.statusText, response.status);
                            default:
                                throw new HTTPResponseError('Unexpected Error', response.statusText, response.status);
                                break;
                        }

                        //throw new HTTPResponseError('Fetch Succeeded but Unhandled Content Type', `Content-Type: ${contentType}`, response.status);
                    }
                } else {
                    // Your existing error handling for non-ok status is good
                    throw new HTTPResponseError('Fetch failed with an error.', response.statusText, response.status);
                }

            } catch (error) {
                if (error instanceof HTTPResponseError && error.statusCode === 429) {
                    numRetry--;
                    await new Promise(resolve => {
                        setTimeout(() => {
                            retryDelay = retryDelay * this.config.backOff;
                            this.log.error(`[RETRY] Retrying in ${retryDelay} seconds`);
                            return resolve(true);
                        }, retryDelay);
                    });
                    this.log.error(`[RETRY] Got rate limited. Retrying ${url} ${numRetry} more times before giving up`);
                    // promise completed, time to rety from the start
                    continue;
                }
                this.log.error(`[FINISHED] Giving up ${numRetry}. Throwing : ${error}`);
                throw error;
            }
        }

        this.log.error(`All retries have been exausted for ${url}`);
        throw new RemoteFetchError('Unexpected Error');
    }
}


export function createRemoteFetchSvc(remoteFetchConfig:RemoteFileSvcConfig, logger:LoggingService): RemoteFileSvc {
    return new RemoteFileSvcImpl(remoteFetchConfig, logger); 
}