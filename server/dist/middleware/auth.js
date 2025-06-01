"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const errorHandler_1 = require("./errorHandler");
const authenticate = async (req, res, next) => {
    var _a;
    try {
        // Get token from authorization header
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
        if (!token) {
            throw new errorHandler_1.AppError('Authentication required', 401);
        }
        try {
            // Verify the token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            // Find the user
            const user = await User_1.User.findById(decoded.id);
            if (!user) {
                throw new errorHandler_1.AppError('User not found', 404);
            }
            // Attach user to request
            req.user = user;
            next();
        }
        catch (jwtError) {
            // Only log critical errors
            if (jwtError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                next(new errorHandler_1.AppError('Invalid token', 401));
            }
            else {
                next(jwtError);
            }
        }
    }
    catch (error) {
        // Only log critical errors
        next(error);
    }
};
exports.authenticate = authenticate;
