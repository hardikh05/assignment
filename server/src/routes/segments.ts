import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Segment } from '../models/Segment';
import { Customer } from '../models/Customer';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { convertNaturalLanguageToRules } from '../services/openai';
import { buildSegmentQuery, calculateSegmentSize, getTotalSpentPipelineStages } from '../utils/segmentQueryBuilder';

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

    if (!process.env.GROQ_API_KEY) {
      throw new AppError('AI features are disabled. Please set GROQ_API_KEY.', 503);
    }

    const rules = await convertNaturalLanguageToRules(description);

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

    // Build query using the shared utility
    const query = buildSegmentQuery(segment.rules as any[], segment.ruleOperator);

    // Get customers with their total spent using the shared pipeline
    const customers = await Customer.aggregate([
      { $match: query },
      ...getTotalSpentPipelineStages(),
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

export default router; 