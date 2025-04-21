import { HTTPStatusCodes, JobsMetadata } from "../app-config/ApplicationConfig.js";
import { RedisSvcError } from "../error-handlers/app-errors.js";
import { Log, LoggingService } from "../logging/logging.types.js";
import { RedisJobsSvc, RedisService } from "./redis.types.js";

class RedisJobsLookupSvcImpl implements RedisJobsSvc {
    private cmdClientSvc: RedisService;
    private logger: Log;

    /**
     * @constructor
     * @param {RedisService} redisSvc - dependency to get a reference to command client 
     * @param {LoggingService} loggingSvc 
     */
    constructor(redisSvc: RedisService, loggingSvc: LoggingService) {
        this.cmdClientSvc = redisSvc;
        this.logger = loggingSvc.getLogger('job-worker');

    }
    public async publishJob(channelName:string, message:string): Promise<void> {
        try {
            await this.cmdClientSvc.getCommandClient().publish(channelName, message);
        } catch (err) {
            throw new Error("Method not implemented.");
        }
    }

    /** 
    * @override 
    * @param {string} jobName - set a jobname for the next worker to pick up 
    * @throws {RedisSvcError} - to indicate that a job was not added
    * */

    public async getNextJob(jobName: string): Promise<string|null> {
        try {
            const result: [string, string] | null = await this.cmdClientSvc.getCommandClient().blpop(jobName, 1);
            if (!result) throw new RedisSvcError('Job cannot be parsed', HTTPStatusCodes.NotFound, "unknown");
            let [_, job] = result;
            return job;
        } catch (error) {
            // log these errors
            if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NotFound) {
                this.logger.error(`[JOB NOT FOUND] ${error}`);
                //throw new RedisSvcError(`Could not find a job : ${jobName}`, HTTPStatusCodes.NotFound);
                return null;
            }
            else {
                this.logger.error(`[UNRECOVERABLE] Unknown error: ${error}`);
                throw new RedisSvcError(`An error occurred when trying to acces the job  ${jobName}`, HTTPStatusCodes.NotAcceptable);
            }
        }
    }
    /** 
         * @override 
         * @param {string} jobName - Name of the job in redis 
         * @param {string} jobData - Stringified JSON that can be converted to FilingsDataConfig object type
         * @returns {Promise<void>}
         * @throws {RedisSvcError} - to indicate data was not added and remove active job from the set
         * */
    public async addJob(jobName: string, jobData: string): Promise<void> {
        try {
            await this.cmdClientSvc.getCommandClient().rpush(jobName, jobData);
        }
        catch (error) {
            // let the caller handle this
            this.logger.error(`[UNRECOVERABLE] Unknown error: ${error}`);
            throw new RedisSvcError(`A new job could not be added for ${jobData}`, HTTPStatusCodes.NotAcceptable);
        }
    }

    /** 
     * @override 
     * @param {string} ticker - based on the ticker removes this job from the active job set 
     * @throws {RedisSvcError} - to remove active job from the set
     * */
    public async clearActiveTicker(ticker: string): Promise<void> {
        try {
            await this.cmdClientSvc.getCommandClient().srem(JobsMetadata.ActiveJobs.ticker, ticker);
        }
        catch (error) {
            this.logger.error(`[UNRECOVERABLE] Unknown error: ${error}`);
            throw new RedisSvcError(`An active job for  ${ticker} could not be cleared `, HTTPStatusCodes.NotAcceptable);
        }
    }
}

let redisJobSvcInstance: RedisJobsSvc | null;
export function createRedisJobsSvc(redisSvc: RedisService, loggingSvc: LoggingService): RedisJobsSvc {
    if (!redisJobSvcInstance) redisJobSvcInstance = new RedisJobsLookupSvcImpl(redisSvc, loggingSvc);

    return redisJobSvcInstance;
}