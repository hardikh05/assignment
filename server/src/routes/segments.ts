import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Segment } from '../models/Segment';
import { Customer } from '../models/Customer';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import OpenAI from 'openai';

// Define User type
interface User {
  _id: string;
  email: string;
  name: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const router = express.Router();

// Initialize OpenAI with error handling
let openai: OpenAI;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY is not set. AI features will be disabled.');
  } else {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.error('Error initializing OpenAI:', error);
}

// Get all segments with pagination
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const segments = await Segment.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Segment.countDocuments();

    res.json({
      segments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create a new segment
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty(),
    body('description').optional().trim(),
    body('rules').isArray(),
    body('ruleOperator').isIn(['AND', 'OR']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const user = req.user as { _id: string };
      const segment = await Segment.create({
        ...req.body,
        createdBy: user._id,
      });

      // Calculate customer count
      const customerCount = await calculateSegmentSize(segment.rules, segment.ruleOperator);
      segment.customerCount = customerCount;
      await segment.save();

      res.status(201).json(segment);
    } catch (error) {
      next(error);
    }
  }
);

// Preview segment size
router.post('/preview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rules, ruleOperator } = req.body;
    const count = await calculateSegmentSize(rules, ruleOperator);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// Convert natural language to segment rules
router.post('/convert-rules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description } = req.body;

    if (!openai) {
      throw new AppError('AI features are disabled. Please set OPENAI_API_KEY.', 503);
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

    const rules = JSON.parse(completion.choices[0].message?.content || '[]');

    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

// Update a segment
router.put(
  '/:id',
  authenticate,
  [
    body('name').trim().notEmpty(),
    body('description').optional().trim(),
    body('rules').isArray(),
    body('ruleOperator').isIn(['AND', 'OR']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const segment = await Segment.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!segment) {
        throw new AppError('Segment not found', 404);
      }

      // Recalculate customer count
      const customerCount = await calculateSegmentSize(segment.rules, segment.ruleOperator);
      segment.customerCount = customerCount;
      await segment.save();

      res.json(segment);
    } catch (error) {
      next(error);
    }
  }
);

// Get segment by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) {
      throw new AppError('Segment not found', 404);
    }
    res.json(segment);
  } catch (error) {
    next(error);
  }
});

// Delete a segment
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = await Segment.findByIdAndDelete(req.params.id);
    if (!segment) {
      throw new AppError('Segment not found', 404);
    }
    res.status(200).json({ message: 'Segment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get customers in segment
router.get('/:id/customers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) {
      throw new AppError('Segment not found', 404);
    }

    // Build query based on segment rules
    const conditions = segment.rules.map((rule: any) => {
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
    const customers = await Customer.aggregate([
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
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate segment size
async function calculateSegmentSize(rules: any[], operator: 'AND' | 'OR') {
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
  return Customer.countDocuments(query);
}

export default router; 