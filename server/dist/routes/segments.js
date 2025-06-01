"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Segment_1 = require("../models/Segment");
const Customer_1 = require("../models/Customer");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const openai_1 = __importDefault(require("openai"));
const router = express_1.default.Router();
// Initialize OpenAI with error handling
let openai;
try {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('Warning: OPENAI_API_KEY is not set. AI features will be disabled.');
    }
    else {
        openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
}
catch (error) {
    console.error('Error initializing OpenAI:', error);
}
// Get all segments with pagination
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const segments = await Segment_1.Segment.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        const total = await Segment_1.Segment.countDocuments();
        res.json({
            segments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Create a new segment
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('name').trim().notEmpty(),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('rules').isArray(),
    (0, express_validator_1.body)('ruleOperator').isIn(['AND', 'OR']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        if (!req.user) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const user = req.user;
        const segment = await Segment_1.Segment.create({
            ...req.body,
            createdBy: user._id,
        });
        // Calculate customer count
        const customerCount = await calculateSegmentSize(segment.rules, segment.ruleOperator);
        segment.customerCount = customerCount;
        await segment.save();
        res.status(201).json(segment);
    }
    catch (error) {
        next(error);
    }
});
// Preview segment size
router.post('/preview', auth_1.authenticate, async (req, res, next) => {
    try {
        const { rules, ruleOperator } = req.body;
        const count = await calculateSegmentSize(rules, ruleOperator);
        res.json({ count });
    }
    catch (error) {
        next(error);
    }
});
// Convert natural language to segment rules
router.post('/convert-rules', auth_1.authenticate, async (req, res, next) => {
    var _a;
    try {
        const { description } = req.body;
        if (!openai) {
            throw new errorHandler_1.AppError('AI features are disabled. Please set OPENAI_API_KEY.', 503);
        }
        const prompt = `Convert the following customer segment description into structured rules:
    Description: ${description}
    Requirements:
    - Return only valid JSON array of rules
    - Each rule should have 'field', 'operator', and 'value' properties
    - Supported operators: equals, not_equals, contains, not_contains, greater_than, less_than
    - Use proper data types for values (string, number, boolean)
    Example format:
    [
      {
        "field": "age",
        "operator": "greater_than",
        "value": 25
      }
    ]`;
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.7,
        });
        const rules = JSON.parse(((_a = completion.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) || '[]');
        res.json({ rules });
    }
    catch (error) {
        next(error);
    }
});
// Update a segment
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('name').trim().notEmpty(),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('rules').isArray(),
    (0, express_validator_1.body)('ruleOperator').isIn(['AND', 'OR']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        const segment = await Segment_1.Segment.findByIdAndUpdate(req.params.id, {
            ...req.body,
            updatedAt: new Date(),
        }, { new: true });
        if (!segment) {
            throw new errorHandler_1.AppError('Segment not found', 404);
        }
        // Recalculate customer count
        const customerCount = await calculateSegmentSize(segment.rules, segment.ruleOperator);
        segment.customerCount = customerCount;
        await segment.save();
        res.json(segment);
    }
    catch (error) {
        next(error);
    }
});
// Get segment by ID
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const segment = await Segment_1.Segment.findById(req.params.id);
        if (!segment) {
            throw new errorHandler_1.AppError('Segment not found', 404);
        }
        res.json(segment);
    }
    catch (error) {
        next(error);
    }
});
// Delete a segment
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const segment = await Segment_1.Segment.findByIdAndDelete(req.params.id);
        if (!segment) {
            throw new errorHandler_1.AppError('Segment not found', 404);
        }
        res.status(200).json({ message: 'Segment deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Get customers in segment
router.get('/:id/customers', auth_1.authenticate, async (req, res, next) => {
    try {
        const segment = await Segment_1.Segment.findById(req.params.id);
        if (!segment) {
            throw new errorHandler_1.AppError('Segment not found', 404);
        }
        // Build query based on segment rules
        const conditions = segment.rules.map((rule) => {
            switch (rule.operator) {
                case 'equals':
                    const value = rule.value;
                    if (typeof value === 'string' && !isNaN(Number(value))) {
                        return {
                            $or: [
                                { [rule.field]: value },
                                { [rule.field]: Number(value) }
                            ]
                        };
                    }
                    return { [rule.field]: value };
                case 'notEquals':
                    const notEqualsValue = rule.value;
                    if (typeof notEqualsValue === 'string' && !isNaN(Number(notEqualsValue))) {
                        return {
                            $and: [
                                { [rule.field]: { $ne: notEqualsValue } },
                                { [rule.field]: { $ne: Number(notEqualsValue) } }
                            ]
                        };
                    }
                    return { [rule.field]: { $ne: notEqualsValue } };
                case 'greaterThan':
                    return { [rule.field]: { $gt: Number(rule.value) } };
                case 'lessThan':
                    return { [rule.field]: { $lt: Number(rule.value) } };
                default:
                    return {};
            }
        });
        const query = segment.ruleOperator === 'AND' ? { $and: conditions } : { $or: conditions };
        // Get customers with their total spent
        const customers = await Customer_1.Customer.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'customerId',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    totalSpent: {
                        $sum: '$orders.total'
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    totalSpent: 1,
                    lastOrderDate: { $max: '$orders.createdAt' }
                }
            }
        ]);
        res.json({
            customers,
            statistics: {
                totalCustomers: customers.length,
                totalSpent: customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
                averageSpent: customers.length > 0
                    ? customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / customers.length
                    : 0
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Helper function to calculate segment size
async function calculateSegmentSize(rules, operator) {
    const conditions = rules.map((rule) => {
        switch (rule.operator) {
            case 'equals':
                // Handle both string and number values
                const value = rule.value;
                if (typeof value === 'string' && !isNaN(Number(value))) {
                    // If the value is a numeric string, try both string and number comparison
                    return {
                        $or: [
                            { [rule.field]: value },
                            { [rule.field]: Number(value) }
                        ]
                    };
                }
                return { [rule.field]: value };
            case 'notEquals':
                // Handle both string and number values for not equals
                const notEqualsValue = rule.value;
                if (typeof notEqualsValue === 'string' && !isNaN(Number(notEqualsValue))) {
                    // If the value is a numeric string, exclude both string and number
                    return {
                        $and: [
                            { [rule.field]: { $ne: notEqualsValue } },
                            { [rule.field]: { $ne: Number(notEqualsValue) } }
                        ]
                    };
                }
                return { [rule.field]: { $ne: notEqualsValue } };
            case 'greaterThan':
                return { [rule.field]: { $gt: Number(rule.value) } };
            case 'lessThan':
                return { [rule.field]: { $lt: Number(rule.value) } };
            default:
                return {};
        }
    });
    const query = operator === 'AND' ? { $and: conditions } : { $or: conditions };
    return Customer_1.Customer.countDocuments(query);
}
exports.default = router;
