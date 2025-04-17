import { createLoggerSvc, Log, LoggingService } from "@finalysis-app/shared-utils";
import { log } from "console";
import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";



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
    private websocketLogger:Log;

    constructor(port: number, loggingSvc:LoggingService) {
        this.websocketLogger = loggingSvc.getLogger('web-socket');
        this.websocketLogger.debug(`[START] COnfiguring Web SocketsServer on port:${port}`);
        
        // declare and start Websocket Server
        this.wss = new WebSocketServer({port: port});
        this.registerEventHandlers();
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
        this.websocketLogger.debug(`Websocket is broadcasting ${message}`);
        // @todo: implement
    }

    private registerEventHandlers():void {
        this.wss.on('connection', (client: WebSocket, req: IncomingMessage) => {
            this.websocketLogger.debug('Websocket connected');
            client.on('open', () => {
                this.websocketLogger.debug(`client connected: ${client.OPEN}`);
            });
    
            client.on('message', (data) => {
                this.websocketLogger.debug(`Raw Data: ${data}`);
            });
    
            client.on('close', (code: number, reason: Buffer) => {
                this.websocketLogger.debug(`client closed connection: ${code} : ${reason.toString()}`);
            });
        });
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
        this.websocketLogger.debug(`websocket is closed}`);
    }
}


let wssInstance:WebSocketService|null;
export const createWebSocketServer = (socketport: number, loggingSvc:LoggingService):WebSocketService => {

    if (!wssInstance) wssInstance = new WebSocketServiceImpl(socketport, loggingSvc);

    return wssInstance;

    /*
    const wss: WebSocketServer = new WebSocketServer({ port: port});
    
    websocketLogger.debug(`[START] Websocket server created at port ${port}`);

    
    */
}