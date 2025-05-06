export enum HTTPStatusCodes {
    // 1xx Informational responses
    Continue = 100,
    SwitchingProtocols = 101,
    Processing = 102, // WebDAV

    // 2xx Successful responses
    OK = 200,
    Created = 201,
    Accepted = 202,
    NonAuthoritativeInformation = 203,
    NoContent = 204,
    ResetContent = 205,
    PartialContent = 206,
    MultiStatus = 207, // WebDAV
    AlreadyReported = 208, // WebDAV
    IMUsed = 226, // HTTP Delta encoding

    // 3xx Redirection messages
    MultipleChoices = 300,
    MovedPermanently = 301,
    Found = 302, // Often used for temporary redirect
    SeeOther = 303,
    NotModified = 304,
    UseProxy = 305, // Deprecated
    SwitchProxy = 306, // No longer used
    TemporaryRedirect = 307,
    PermanentRedirect = 308,

    // 4xx Client error responses
    BadRequest = 400,
    Unauthorized = 401,
    PaymentRequired = 402, // Experimental
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    ProxyAuthenticationRequired = 407,
    RequestTimeout = 408,
    Conflict = 409,
    Gone = 410,
    LengthRequired = 411,
    PreconditionFailed = 412,
    PayloadTooLarge = 413,
    URITooLong = 414,
    UnsupportedMediaType = 415,
    RangeNotSatisfiable = 416,
    ExpectationFailed = 417,
    ImATeapot = 418, // :)
    MisdirectedRequest = 421,
    UnprocessableEntity = 422, // WebDAV
    Locked = 423, // WebDAV
    FailedDependency = 424, // WebDAV
    TooEarly = 425, // Experimental
    UpgradeRequired = 426,
    PreconditionRequired = 428,
    TooManyRequests = 429, // Rate Limiting
    RequestHeaderFieldsTooLarge = 431,
    UnavailableForLegalReasons = 451,

    // 5xx Server error responses
    InternalServerError = 500,
    NotImplemented = 501,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
    HTTPVersionNotSupported = 505,
    VariantAlsoNegotiates = 506,
    InsufficientStorage = 507, // WebDAV
    LoopDetected = 508, // WebDAV
    NotExtended = 510,
    NetworkAuthenticationRequired = 511,
}

export interface MessageConfig {
    msgType?:string|'generic', 
    statusCode:number, // best if used http enums
    messageTxt:string,
    data?:any
}
/**
 * Jobs Metatdata class
 */
export const JobsMetadata = {
    ActiveJobs:{
        ticker:'active:ticker',
    }, 
    FailedJobs:{
        ticker:'active:ticker',
    },
    ChannelNames:{
        lookup_cik:'channel:lookup:cik',
        recent_filings:'channel:lookup:recentfilings',
        fetch_summaries:'channel:fetch:filingsummaries',
        fetch_financial_stmts:'channel:fetch:statements'
    },
    JobNames:{
        lookup_cik:'job:lookup:cik',
        recent_filings:'job:lookup:recentfilings',
        fetch_summaries:'job:fetch:filingsummaries',
        fetch_financial_stmts:'job:fetch:statements'
    }
}

export enum StatementTypes {
    equity = 'equity',
    balance = 'balance',
    income = 'income',
    cashflow = 'cashflow'
}


export enum SECOperationFailureCodes {
    Unknown = 'UNKNOWN_EXCEPTION',
    TickerNotFound='TICKER_NOT_FOUND',
    ActiveJobInProgress='ACTIVE_JOB'
}


export enum DiskCacheFailureCodes {
    Unknown = 'UNKNOWN',
    FileSystemRead = 'FS_READ',
    FileSystemWrite = 'FS_WRITE',
    FileSystemMkdir = 'FS_MKDIR',
    FetchFailed = 'REMOTE_FETCH', // If wrapping fetch errors
    InvalidState = 'INVALID_STATE',
    RefreshFailed = 'REFRESH_FAILED',
    NothingToFetch = 'NOTHING_TO_FETCH'
}