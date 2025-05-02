import { createRedisSvc, JobsMetadata, RedisService } from "@finalysis-app/shared-utils"

export const checkActiveJobs = async (redisSvc:RedisService):Promise<boolean> => {
    try {
        const activeTickers:string[] = await redisSvc.getCommandClient().smembers(JobsMetadata.ActiveJobs.ticker);
        //(activeTickers)
        return (activeTickers.length > 0);
    }
    catch (error){
        throw error;
    }
}