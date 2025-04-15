import { Logger } from 'log4js';

/**
 * 
 * @interface
 */
export interface LoggingService {
    getLogger(category:string): Log; // Get the logger instance
    shutdown(): void;
}

export interface LoggingServiceConfigOptions {
    type: 'console' | 'file' | 'both';
    filename?: string; // Only used if type is 'file' or 'both'
    level?: string; // Log level (default: 'info')
    env: 'dev' | 'prod'; // Environment (default: 'dev')
    maxLogSize?: string; // Max size of log file in bytes (default: 10MB)
    backups?: number; // Number of backup files to keep (default: 3)
    compress?: boolean; // Whether to compress backup files (default: true)
}

// logging.types.ts
export interface Log {
    debug(message: string, ...meta: any[]): void;
    info(message: string, ...meta: any[]): void;
    warn(message: string, ...meta: any[]): void;
    error(message: string, error?: Error, ...meta: any[]): void;
    // Add fatal, trace if needed
}