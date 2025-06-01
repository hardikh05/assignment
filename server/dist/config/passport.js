"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPassport = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../models/User");
const setupPassport = () => {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    }, async (accessToken, refreshToken, profile, done) => {
        var _a, _b, _c, _d;
        try {
            // First try to find user by Google ID
            let user = await User_1.User.findOne({ googleId: profile.id });
            if (!user) {
                // If not found by Google ID, try to find by email
                user = await User_1.User.findOne({ email: (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0].value });
                if (user) {
                    // If user exists with email but no Google ID, update with Google ID
                    user.googleId = profile.id;
                    user.avatar = (_b = profile.photos) === null || _b === void 0 ? void 0 : _b[0].value;
                    await user.save();
                }
                else {
                    // Create new user if doesn't exist
                    user = await User_1.User.create({
                        googleId: profile.id,
                        email: (_c = profile.emails) === null || _c === void 0 ? void 0 : _c[0].value,
                        name: profile.displayName,
                        avatar: (_d = profile.photos) === null || _d === void 0 ? void 0 : _d[0].value,
                    });
                }
            }
            return done(null, user);
        }
        catch (error) {
            console.error('Google OAuth error:', error);
            return done(error);
        }
    }));
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const user = await User_1.User.findById(id);
            done(null, user);
        }
        catch (error) {
            done(error);
        }
    });
};
exports.setupPassport = setupPassport;
