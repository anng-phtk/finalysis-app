import { DiskCacheFailureCodes, HTTPStatusCodes, SECOperationFailureCodes } from "../app-config/ApplicationConfig.js";

export class BaseAppError extends Error {
    public readonly statusCode: number = 500;
    /**
     * @override constructor
     */
    public constructor(message: string, statusCode: number = 500) {
        super(message);

        // set error name and status code
        this.name = this.constructor.name;
        this.statusCode = statusCode;

        //if (Error.ca) Error.captureStackTrace(this, this.constructor);
    }
}

// 400 Bad Request for validation
export class ValidationError extends BaseAppError {
    constructor(message: string = 'Input validation failed') {
        super(message, 400); // Pass message and status code to base
        this.name = 'ValidationError';
    }
}

// 404 Not Found
export class NotFoundError extends BaseAppError {
    constructor(message: string = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

// 401 Unauthorized
export class AuthenticationError extends BaseAppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

// 401 Unauthorized
export class HTTPResponseError extends BaseAppError {
    private readonly statusText:string;
    constructor(message:string, statusText:string, statusCode:number) {
        super(message, statusCode);
        this.statusText = statusText;
        //if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    }
}

export class RemoteFetchError extends BaseAppError {
    constructor(message: string = 'Remote Fetch Failed') {
        super(message); // Pass message and status code to base
        this.name = this.constructor.name;
    }
}


export class DiskCacheError extends BaseAppError {
    constructor(
        message: string,
        public readonly code: DiskCacheFailureCodes = DiskCacheFailureCodes.Unknown,
        public readonly innerError?: Error // Optional wrapped error
    ) {
        super(message);
        this.name = 'CacheError';
        // ... captureStackTrace ...
    }
}

export class SECOperationError extends BaseAppError {
    constructor(
        message: string,
        public readonly statusCode:number = HTTPStatusCodes.NotFound,
        public readonly statusText:string = SECOperationFailureCodes.Unknown,
        public readonly innerError?: Error // Optional wrapped error
    ) {
        super(message, statusCode);
        this.name = 'CacheError';
        // ... captureStackTrace ...
    }
}

export class RedisSvcError extends BaseAppError {
    constructor(
        message: string,
        public readonly statusCode:number = HTTPStatusCodes.NotFound,
        public readonly statusText:string = SECOperationFailureCodes.Unknown,
        public readonly innerError?: Error // Optional wrapped error
    ) {
        super(message, statusCode);
        this.name = 'CacheError';
        // ... captureStackTrace ...
    }
}




export class FinancialStmtParsingError extends BaseAppError {
    constructor(
        message: string,
        public readonly statusCode:number = HTTPStatusCodes.BadRequest,
        public readonly innerError?: Error // Optional wrapped error
    ) {
        super(message, statusCode);
        this.name = 'FinancialStatementParsingError';
        // ... captureStackTrace ...
    }
}



export class DatabaseError extends BaseAppError {
    constructor(
        message: string,
        public readonly innerError?: Error // Optional wrapped error
    ) {
        super(message);
        this.name = 'DatabaseError';
        // ... captureStackTrace ...
    }
}