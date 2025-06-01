"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    campaignId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    campaignName: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'delivered', 'failed'],
        required: true
    },
    vendorMessageId: {
        type: String,
        default: null
    },
    error: {
        type: String,
        default: null
    }
});
// Add indexes for better query performance
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ customerId: 1 });
messageSchema.index({ campaignId: 1 });
exports.Message = mongoose_1.default.model('Message', messageSchema);
