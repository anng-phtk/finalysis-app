import Log4jsMethods from "log4js";
import {Appender, Configuration,Logger } from "log4js";
import { LoggingService , LoggingServiceConfigOptions, Log } from "./logging.types.js";

const { configure, getLogger, shutdown } = Log4jsMethods;

class LoggingServiceImpl implements LoggingService {
    /**
     * @constructor
     * @param {LoggerConfigOptions} config - Configuration options for the logging service.
     */
   
    constructor(config: LoggingServiceConfigOptions) {
        this.configureLogger(config);
    }

    /**
     * Shutdown the logger and release resources.
     * @returns {void}
     */
    public shutdown(): void {
        shutdown(() => {
            console.log('Logger shutdown complete.');
        });
    }
    private configureLogger(options: LoggingServiceConfigOptions): void {
        const { type, filename, level, env, maxLogSize, backups, compress } = options;
        const appenders: { [key: string]: Appender} = {};

        const appendersList: string[] = [];
        
        appenders['consoleOut'] = {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%[%d{ISO8601} %p %c - %m%]',
            },
        };
    
        if (type === 'file' || type === 'both') {
            console.log('Configuring file appender...', filename);
            appenders['fileout'] = {
                type: 'multiFile',
                base: `logs`, //|| 'logs/app.log',
                layout: {
                    type: 'pattern',
                    pattern: '%d{ISO8601} %p %c %f- %n%m',
                },
                property: "categoryName",
                extension: ".log",
                maxLogSize: 10485760, // 10MB
                backups: backups || 3,
                compress: compress !== undefined ? compress : true,
            };
        }

        // push the appender names to the appendersList array
        Object.keys(appenders).forEach((key) => {
            appendersList.push(key);
        });

        const composedConfig: Configuration = {
            appenders,
            categories: {
                default: { appenders: appendersList, level: level || '' },
                //apiserver: { appenders: appendersList, level: 'debug' },
                //websocket: { appenders: appendersList, level: 'debug' }
            }
        }

        // Configure log4js with the composed configuration
        Log4jsMethods.configure(composedConfig);
    }

    public getLogger(category:string):Log {
        
        const log4jsLogger = Log4jsMethods.getLogger(category);

        // Return a wrapper object implementing ILogger
        return {
            debug: (message: string, ...meta: any[]) => log4jsLogger.debug(message, ...meta),
            info:  (message: string, ...meta: any[]) => log4jsLogger.info(message, ...meta),
            warn:  (message: string, ...meta: any[]) => log4jsLogger.warn(message, ...meta),
            error: (message: string, error?: Error, ...meta: any[]) => {
                const args: any[] = [message];
                if (error) args.push(error); // Pass error object if present
                args.push(...meta);
                log4jsLogger.error(message, ...args)
            },
        }
    }
}


// control and enforce singleton
let loggingSvcIntance:LoggingService|null;
export function createLoggerSvc(options:LoggingServiceConfigOptions):LoggingService {
    /** if we need a singleton logging svc. here we want different loggers running different files */
    if (!loggingSvcIntance) loggingSvcIntance = new LoggingServiceImpl(options)
    return loggingSvcIntance;
}
