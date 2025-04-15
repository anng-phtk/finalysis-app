import { HTTPResponseError, RemoteFetchError } from "../error-handlers/app-errors.js";
import { Log, LoggingService } from "../logging/logging.types.js";

import { createLoggerSvc } from "../logging/LoggingSvcImpl.js";
import { RemoteFileSvc, RemoteFileSvcConfig } from "./remotefetch.types.js";

class RemoteFileSvcImpl implements RemoteFileSvc {
    private config: RemoteFileSvcConfig;
    private log: Log;

    constructor(config: RemoteFileSvcConfig, logger: LoggingService) {
        this.config = config;
        this.log = logger.getLogger('RemoteFileSvcImpl');

    }
    /**
     * Fetches a remote file from the specified URL.
     * @param {string} url - The URL of the remote file to fetch.
     * @returns {Promise<string>} - A promise that resolves to the content of the remote file as a string.
     * @throws {HTTPResponseError} - Throws an error if the fetch fails or if the response is not ok.
     */
    async getRemoteFile(): Promise<string> {
        let url = this.config.url;
        let response: Response;
        this.log.info('Fetching remote file from URL:', this.config.url);

        while (this.config.retry > 0) {
            try {
                response = await fetch(url, {
                    headers: {
                        "User-Agent": "Finalysis-App finalyze.admin@gmail.com",
                        "Accept-Encoding": "gzip, deflate",
                        "Host": "www.sec.gov"
                    }
                });

                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const content = await response.json();
                        // Decide: Return object or stringify? Returning object is usually better.
                        return JSON.stringify(content); // Return parsed object
                        //return content;
                    } else if (contentType && (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/xml'))) {
                        const content = await response.text();
                        return content;

                    } else {
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
                    //if (this.config.retry > 0) {
                        this.config.retry--;
                        await new Promise(resolve => {
                            setTimeout(() => {
                                this.config.retryDelay = this.config.retryDelay * this.config.backOff;
                                this.log.error(`Retrying in ${this.config.retryDelay} seconds`);
                                return resolve(true);
                            }, this.config.retryDelay);
                        });

                        // promise completed, time to rety from the start
                        continue;
                        // while loop instead of a self call
                        //this.getRemoteFile();
                    //}
                }

                this.log.error(`Retries Left: ${this.config.retry}`);
                throw error;
            }
        }

        this.log.error(`All retries have been exausted for ${this.config.url}`);
        throw new RemoteFetchError('Unexpected Error');
    }
}


export function createRemoteFetchSvc(remoteFetchConfig:RemoteFileSvcConfig, logger:LoggingService): RemoteFileSvc {
    return new RemoteFileSvcImpl(remoteFetchConfig, logger); 
}