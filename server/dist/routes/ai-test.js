"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
/**
 * @route GET /api/ai-test
 * @desc Test endpoint for AI functionality
 * @access Public
 */
router.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'AI test endpoint is working',
        env: {
            openaiKeySet: !!process.env.OPENAI_API_KEY
        }
    });
});
exports.default = router;
