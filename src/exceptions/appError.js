class AppError extends Error {
    constructor(message, status=400, code=null) {
        super(message);
        this.statusCode = status;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;