"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Message_1 = require("../models/Message");
const Campaign_1 = require("../models/Campaign");
const Customer_1 = require("../models/Customer");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const vendorApi_1 = __importDefault(require("../services/vendorApi"));
const router = express_1.default.Router();
// Get all messages for the current user
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { user } = req;
        if (!(user === null || user === void 0 ? void 0 : user._id)) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const messages = await Message_1.Message.find({ userId: user._id })
            .populate('customerId', 'name email')
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(messages);
    }
    catch (error) {
        next(error);
    }
});
// Mark message as read
router.patch('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        const { user } = req;
        if (!(user === null || user === void 0 ? void 0 : user._id)) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const message = await Message_1.Message.findOneAndUpdate({ _id: req.params.id, userId: user._id }, { read: true }, { new: true });
        if (!message) {
            throw new errorHandler_1.AppError('Message not found', 404);
        }
        res.json(message);
    }
    catch (error) {
        next(error);
    }
});
// Send campaign message to customers
router.post('/campaign/:campaignId/send', auth_1.authenticate, async (req, res, next) => {
    try {
        const { user } = req;
        if (!(user === null || user === void 0 ? void 0 : user._id)) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const campaign = await Campaign_1.Campaign.findById(req.params.campaignId);
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        // Get all customers in the campaign's segment
        const customers = await Customer_1.Customer.find({ segmentId: campaign.segmentId });
        // Handle empty segment
        if (customers.length === 0) {
            return res.status(400).json({ error: 'No customers found in segment. No messages created.' });
        }
        // Create messages for each customer and send via vendor API
        const messages = [];
        const errors = [];
        for (const customer of customers) {
            try {
                const message = await Message_1.Message.create({
                    userId: user._id,
                    customerId: customer._id,
                    campaignId: campaign._id,
                    campaignName: campaign.name,
                    message: campaign.message,
                    timestamp: new Date(),
                    read: true, // match your sample
                    status: 'PENDING'
                });
                // Try to send message via vendor API
                const result = await vendorApi_1.default.sendMessage(customer.email, campaign.message);
                const status = result.success ? 'COMPLETED' : 'FAILED';
                await Message_1.Message.findByIdAndUpdate(message._id, { status });
                messages.push({ ...message.toObject(), status });
            }
            catch (err) {
                errors.push({ customerId: customer._id, error: err });
            }
        }
        // Update campaign status only if at least one message was created
        let newStatus = 'completed';
        if (messages.length === 0) {
            return res.status(500).json({ error: 'No messages were created for the campaign.', details: errors });
        }
        if (messages.some(msg => msg.status === 'FAILED'))
            newStatus = 'failed';
        const updatedCampaign = await Campaign_1.Campaign.findByIdAndUpdate(campaign._id, { status: newStatus }, { new: true });
        res.status(201).json({
            message: 'Messages sent',
            campaign: updatedCampaign,
            messages,
            errors
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
