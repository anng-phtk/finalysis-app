import { createLoggerSvc, LoggingService, LoggingServiceConfigOptions } from "@finalysis-app/shared-utils";
import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";



const loggingOptions:LoggingServiceConfigOptions = {
    env:'dev',
    filename:'websocket-svc.log',
    type:'both',
    level:'debug',
    maxLogSize:'10K',
    backups:2,
    compress:true
}
const wsLogger:LoggingService= createLoggerSvc(loggingOptions);
const socketLogger = wsLogger.getLogger('websocket');


//factory function
/**
 * @function {createSocketServer}
 * @param   {void}
 * @returns {void}
 */

export interface WebSocketService {
    get serverInstance(): WebSocketServer;
    broadcast(message: any, options?: {
        exclude?: WebSocket
    }): void;
    close(callback?: (err?: Error) => void): void;
}

class WebSocketServiceImpl implements WebSocketService {
    private wss: WebSocketServer;
    constructor(port: number) {
        // declare and start Websocket Server
        this.wss = new WebSocketServer({port: port});
        socketLogger.debug(`port:${port}`);
    }

    /**
     * get ServerInstance
     * @override
     * @returns {WebSocketServer} 
     * 
     */
    get serverInstance(): WebSocketServer {
        return this.wss;
    }

    /**
     * Broadcasts a message to connected clients, with optional exclusions.
     * @override
     * @param {any} message - The message to broadcast (any type)
     * @param {Object} [options] - Optional configuration
     * @param {WebSocket} [options.exclude] - Specific WebSocket connection to exclude
     * @returns {void}
     */
    public broadcast(message: any, options?: { exclude?: WebSocket; }): void {
        socketLogger.debug(`Websocket is broadcasting ${message}`);
        // @todo: implement
    }

    /**
     * Closes the connection with an optional error callback.
     * 
     * @param {Function} [callback] - Callback invoked on close
     * @param {Error} [callback.err] - Possible error that occurred during closing
     * @returns {void}
     */
    public close(callback?: (err?: Error) => void): void {
        // @todo: ensure implementing close
        socketLogger.debug(`websocket is closed}`);
    }
}

export const createSocketServer = (socketport: number) => {
    /**
     * configure logging options for Websocket server
     */
    socketLogger.debug('Websocket server created at port 8000');
    const port: number = socketport || 8000;

    // declare and start Websocket Server
    const wss: WebSocketServer = new WebSocketServer({ port: port});

    wss.on('connection', (client: WebSocket, req: IncomingMessage) => {
        socketLogger.debug('Websocket connected');
    
        client.on('open', () => {
            socketLogger.debug(`client connected: ${client.OPEN}`);
        });

        client.on('message', (data) => {
            socketLogger.debug(`Raw Data: ${data}`);
        });

        client.on('close', (code: number, reason: Buffer) => {
            socketLogger.debug(`client closed connection: ${code} : ${reason.toString()}`);
        });
    });
}