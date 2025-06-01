"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCampaignMessage = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai = new openai_1.default({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000", // Site URL for rankings on openrouter.ai
        "X-Title": "Mini CRM", // Site title for rankings on openrouter.ai
    },
});
const generateCampaignMessage = async (segmentName, campaignName, campaignDescription) => {
    var _a, _b, _c;
    try {
        const prompt = `You are creating a marketing campaign message for a segment named "${segmentName}" for a campaign called "${campaignName}".
    
    Campaign description: ${campaignDescription}
    
    Your task is to write a highly targeted marketing message that speaks directly to this customer segment.
    The message should:
    - Be personalized for the "${segmentName}" segment
    - Highlight the value proposition of the "${campaignName}" campaign
    - Include a clear call-to-action
    - Be professional, engaging, and persuasive
    - VERY IMPORTANT: The entire message must be exactly 2 lines maximum
    
    Write only the message content, without any explanations or notes.`;
        const completion = await openai.chat.completions.create({
            model: "meta-llama/llama-3.3-8b-instruct:free",
            messages: [
                { role: "system", content: "You are a professional marketing copywriter." },
                { role: "user", content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.7,
        });
        return ((_c = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) || 'Unable to generate message';
    }
    catch (error) {
        console.error('Error generating campaign message:', error);
        throw new Error('Failed to generate campaign message');
    }
};
exports.generateCampaignMessage = generateCampaignMessage;
