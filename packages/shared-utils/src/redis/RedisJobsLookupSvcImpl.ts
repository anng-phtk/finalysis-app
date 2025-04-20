import { HTTPStatusCodes, JobsMetadata } from "../app-config/ApplicationConfig.js";
import { RedisSvcError } from "../error-handlers/app-errors.js";
import { Log, LoggingService } from "../logging/logging.types.js";
import { RedisJobsSvc, RedisService } from "./redis.types.js";

class RedisJobsLookupSvcImpl implements RedisJobsSvc {
    private cmdClientSvc:RedisService;
    private logger:Log;

    constructor(redisSvc:RedisService, loggingSvc:LoggingService) {
        this.cmdClientSvc = redisSvc;
        this.logger = loggingSvc.getLogger('job-worker');

    }
    public async clearActiveTicker(ticker: string): Promise<void> {
        try {
            await this.cmdClientSvc.getCommandClient().srem(JobsMetadata.ActiveJobs.ticker, ticker);
        }
        catch (error) {
            this.logger.error(`[UNRECOVERABLE] Unknown error: ${error}`);
            throw error;
        }
    }
    public async getNextJob(jobName:string): Promise<string> {
        try {
            const result:[string, string]|null = await this.cmdClientSvc.getCommandClient().blpop(jobName, 1);
            if (!result) throw new RedisSvcError('Job cannot be parsed', HTTPStatusCodes.NotAcceptable, "unknown");

            let [_,job] = result;
            
            return job;
        } catch (error) {
            // log these errors
            if (error instanceof RedisSvcError && error.statusCode === HTTPStatusCodes.NotAcceptable) {
                this.logger.error(`[JOB NOT FOUND] ${error.message}`);
            }
            else {
                this.logger.error(`[UNRECOVERABLE] Unknown error: ${error}`);
            }
            throw error;
        }  
    }
}

let redisJobSvcInstance:RedisJobsSvc|null;
export function createRedisJobsSvc(redisSvc:RedisService, loggingSvc:LoggingService):RedisJobsSvc{
    if (!redisJobSvcInstance) redisJobSvcInstance = new RedisJobsLookupSvcImpl(redisSvc, loggingSvc);

    return redisJobSvcInstance;
}