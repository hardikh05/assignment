"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const openai_1 = require("../services/openai");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * @route POST /api/ai/generate-message
 * @desc Generate campaign message using AI
 * @access Private
 */
router.post('/generate-message', auth_1.authenticate, async (req, res) => {
    try {
        const { segmentName, campaignName, campaignDescription } = req.body;
        if (!segmentName || !campaignName) {
            return res.status(400).json({
                success: false,
                message: 'Segment name and campaign name are required'
            });
        }
        const message = await (0, openai_1.generateCampaignMessage)(segmentName, campaignName, campaignDescription || '');
        return res.status(200).json({
            success: true,
            message,
        });
    }
    catch (error) {
        console.error('Error generating AI message:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate message',
        });
    }
});
exports.default = router;
