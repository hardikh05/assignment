"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// Google OAuth routes
router.get('/google', passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
}));
router.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    try {
        const user = req.user;
        console.log('Google auth user:', user ? 'Yes' : 'No');
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' } // Extended token expiration for better user experience
        );
        console.log('Generated token:', token);
        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
    }
    catch (error) {
        console.error('Auth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
    }
});
// Get current user
router.get('/me', async (req, res, next) => {
    var _a;
    try {
        console.log('Auth headers:', req.headers);
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
        console.log('Token:', token);
        if (!token) {
            throw new errorHandler_1.AppError('No token provided', 401);
        }
        console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('Decoded token:', decoded);
        const user = await User_1.User.findById(decoded.id);
        console.log('Found user:', user ? 'Yes' : 'No');
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        res.json({
            id: user._id,
            email: user.email,
            name: user.name,
            avatar: user.avatar || null,
            role: user.role
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        next(error);
    }
});
exports.default = router;
