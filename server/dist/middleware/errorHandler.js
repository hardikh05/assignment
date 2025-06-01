"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
class AppError extends Error {
    constructor(message, statusCode, errors) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    // Handle Mongoose validation errors
    if (err instanceof mongoose_1.default.Error.ValidationError) {
        const errors = Object.values(err.errors).map(error => ({
            field: error.path,
            message: error.message
        }));
        return res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            errors
        });
    }
    // Handle Mongoose duplicate key errors
    if (err instanceof mongoose_1.default.Error && err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0];
        return res.status(400).json({
            status: 'error',
            message: 'Duplicate Error',
            errors: [{
                    field,
                    message: `${field} already exists`
                }]
        });
    }
    // Handle Mongoose cast errors (invalid ObjectId)
    if (err instanceof mongoose_1.default.Error.CastError) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid ID',
            errors: [{
                    field: err.path,
                    message: 'Invalid ID format'
                }]
        });
    }
    // Handle express-validator errors
    if (Array.isArray(err) && err.length > 0 && 'param' in err[0] && 'msg' in err[0]) {
        const errors = err.map(error => ({
            field: error.param,
            message: error.msg
        }));
        return res.status(400).json({
            status: 'error',
            message: 'Validation Error',
            errors
        });
    }
    // Handle custom AppError
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            errors: err.errors
        });
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token',
            errors: [{
                    message: 'Please log in again'
                }]
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'error',
            message: 'Token expired',
            errors: [{
                    message: 'Please log in again'
                }]
        });
    }
    // Handle unknown errors
    return res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        errors: process.env.NODE_ENV === 'development' ? [{
                message: err.message,
                stack: err.stack
            }] : undefined
    });
};
exports.errorHandler = errorHandler;
