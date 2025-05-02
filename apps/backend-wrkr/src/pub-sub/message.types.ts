export enum MessageTypes {
    interim = "INTERIM",
    final = "FINAL"
}

export interface MessageConfig {
    messageType:string, // use type enum to populate
    status:string,
    message:string,
    data?:JSON
}