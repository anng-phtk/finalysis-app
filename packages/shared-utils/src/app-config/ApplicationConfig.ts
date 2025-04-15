export interface ConfigSettings {
   port:number;
   host?:string|'localhost';
   db?:string|'finalysis-db';
}

export class ApplicationConfig {
    public readonly api_server:ConfigSettings = {
        port:3000
    };
    public readonly websocket_server:ConfigSettings = {
        port:3001,
        host:'localhost'
    };
    public readonly redis:ConfigSettings = {
        port:6379,
        host:'192.168.1.96'
    };
    public readonly mongodb:ConfigSettings = {
        port:27017,
        host:'192.168.1.96',
        db:'finanlysis-db'
    };
}