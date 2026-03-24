import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Customer } from '../models/Customer';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { Producer } from 'kafkajs';
import { Order } from '../models/Order';
import { getTotalSpentPipelineStages } from '../utils/segmentQueryBuilder';

const router = express.Router();

// Get all customers with pagination (uses aggregation instead of N+1 queries)
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Use aggregation to compute totalSpent in a single query instead of N+1
    const customers = await Customer.aggregate([
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      ...getTotalSpentPipelineStages(),
      {
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          totalSpent: 1,
          visits: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      }
    ]);

    const total = await Customer.countDocuments();

    res.json({
      customers,
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

// Create a new customer
router.post(
  '/',
  authenticate,
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      .withMessage('Please provide a valid email address (e.g., user@example.com)')
      .normalizeEmail(),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters long'),
    body('phone')
      .optional()
      .trim()
      .matches(/^[0-9]{10,}$/)
      .withMessage('Phone number must be at least 10 digits and contain only numbers'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessage = errors.array().map(err => err.msg).join(', ');
        throw new AppError(errorMessage, 400);
      }

      // Generate random number of visits between 1 and 50
      const randomVisits = Math.floor(Math.random() * 50) + 1;

      // Create customer with required fields
      const customerData = {
        name: req.body.name.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone ? req.body.phone.trim() : '',
        visits: randomVisits,
        totalSpent: 0,
      };

      const customer = await Customer.create(customerData);

      // Send customer creation event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'customer-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'CUSTOMER_CREATED',
                data: customer
              })
            }
          ]
        });
      }

      res.status(201).json(customer);
    } catch (error) {
      next(error);
    }
  }
);

// Update a customer
router.put(
  '/:id',
  authenticate,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('visits').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      // Send customer update event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'customer-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'CUSTOMER_UPDATED',
                data: customer
              })
            }
          ]
        });
      }

      res.json(customer);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a customer
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First delete all orders associated with this customer
    const deletedOrders = await Order.deleteMany({ customerId: req.params.id });
    console.log(`Deleted ${deletedOrders.deletedCount} orders for customer ${req.params.id}`);

    // Then delete the customer
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Send customer deletion event to Kafka if available
    if (producer) {
      const kafkaProducer = producer as Producer;
      await kafkaProducer.send({
        topic: 'customer-events',
        messages: [
          {
            value: JSON.stringify({
              type: 'CUSTOMER_DELETED',
              data: { 
                id: req.params.id,
                deletedOrdersCount: deletedOrders.deletedCount 
              }
            })
          }
        ]
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    next(error);
  }
});

export default router;
