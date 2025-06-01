"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Campaign = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const campaignSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    segmentId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Segment',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    customers: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Customer'
        }],
    status: {
        type: String,
        enum: ['draft', 'completed', 'failed'],
        default: 'draft'
    },
    scheduledFor: {
        type: Date
    },
    sentAt: {
        type: Date
    },
    stats: {
        totalAudience: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        opened: { type: Number, default: 0 },
        clicked: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});
// Indexes for better query performance
campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduledFor: 1 });
exports.Campaign = mongoose_1.default.model('Campaign', campaignSchema);
