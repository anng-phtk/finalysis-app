
/**
 * @todo -  move this to its own class and factory function. then call it here and pass all the dependencies into it
 * 
 * */ 

/*
redisSvc.getSubscriberClient().on('connect', ()=> {
    // this wrkrLogger must be passed in
    const wrkrLogger:Log = loggingSvc.getLogger('worker-svc');

    wrkrLogger.debug('redis has connected in subscriber mode');
    wrkrLogger.debug(`subscribing to ${channels}`);
    redisSvc.getSubscriberClient().subscribe(...channels, (err, count)=> {
        wrkrLogger.debug(`Subscribing to ${count} channels`);        
    });

    redisSvc.getSubscriberClient().on('message', (channel, message)=> {
        if (!message || message === '') {
            wrkrLogger.error(`[LISTENING FOR MESSAGE] Got an empty message from  ${channel} :  ${message}`);
            //throw new Error('Message does not have a valid job');
        }
        wrkrLogger.debug(`Got a message from  ${channel} :  ${message}`);
        
        switch (channel) {
            case JobsMetadata.ChannelNames.lookup_cik:
                wrkrLogger.debug(`[CALL Worker]: wrkrLookupCIK(${message})`);
                    // start the call
                wrkrLookupCIK(redisSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.recent_filings:
                wrkrLogger.debug(`[CALL Worker]:wrkrLookupRecentFilings(${message})`);

                // start the call
                wrkrLookupRecentFilings(redisJobSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.fetch_summaries:
                wrkrLogger.debug(`[CALL Worker]:fetchFilingSummaries(${message})`);

                // start the call
                wrkrFetchFilingSummaries(redisJobSvc, fileSvc, wrkrLogger);
            break;
            case JobsMetadata.ChannelNames.fetch_financial_stmts:
                wrkrLogger.debug(`[CALL Worker]:fetchFilingSummaries(${message})`);

                // start the call
                wrkrFetchStatments(
                    redisJobSvc, 
                    fileSvc, 
                    stmtParserSvc,
                    statementDao,
                    wrkrLogger);
            break;
        }
    })
});







// start worker-listener and listen on these channels:
const channels:string[] = [];
Object.values(JobsMetadata.ChannelNames).forEach(val => {
    channels.push(val)
});
console.debug(channels);

*/