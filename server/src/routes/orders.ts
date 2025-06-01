import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Order } from '../models/Order';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { producer } from '../config/kafka';
import { Producer } from 'kafkajs';
import { IUser } from '../models/User';

interface AuthRequest extends Request {
  user?: IUser;
}

const router = express.Router();

// Get all orders with pagination
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .populate('customerId', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Calculate total amount for each order if not set
    const ordersWithTotal = orders.map(order => {
      if (!order.totalAmount && Array.isArray(order.items)) {
        order.totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      }
      return order;
    });

    const total = await Order.countDocuments();

    res.json({
      orders: ordersWithTotal,
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

// Get orders for a specific customer
router.get('/customer/:customerId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId })
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Create a new order
router.post(
  '/',
  authenticate,
  [
    body('customerId').isMongoId(),
    body('items').isArray().notEmpty(),
    body('items.*.name').trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.price').isFloat({ min: 0 }),
    body('shippingAddress.street').trim().notEmpty(),
    body('shippingAddress.city').trim().notEmpty(),
    body('shippingAddress.state').trim().notEmpty(),
    body('shippingAddress.zipCode').trim().notEmpty(),
    body('shippingAddress.country').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // Always calculate totalAmount from items
      const items = req.body.items || [];
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const order = await Order.create({
        ...req.body,
        totalAmount,
        orderNumber,
      });

      // Send order creation event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'order-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'ORDER_CREATED',
                data: order
              })
            }
          ]
        });
      }

      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Update order status
router.patch(
  '/:id/status',
  authenticate,
  [
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      ).populate('customerId', 'name email');

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Send order status update event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'order-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'ORDER_STATUS_UPDATED',
                data: order
              })
            }
          ]
        });
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Update order
router.put(
  '/:id',
  authenticate,
  [
    body('customerId').isMongoId(),
    body('items').isArray().notEmpty(),
    body('items.*.name').trim().notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.price').isFloat({ min: 0 }),
    body('shippingAddress.street').trim().notEmpty(),
    body('shippingAddress.city').trim().notEmpty(),
    body('shippingAddress.state').trim().notEmpty(),
    body('shippingAddress.zipCode').trim().notEmpty(),
    body('shippingAddress.country').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // Calculate totalAmount from items
      const items = req.body.items || [];
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

      const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          totalAmount,
        },
        { new: true }
      ).populate('customerId', 'name email');

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Send order update event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'order-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'ORDER_UPDATED',
                data: order
              })
            }
          ]
        });
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Delete an order
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Send order deletion event to Kafka if available
    if (producer) {
      const kafkaProducer = producer as Producer;
      await kafkaProducer.send({
        topic: 'order-events',
        messages: [
          {
            value: JSON.stringify({
              type: 'ORDER_DELETED',
              data: { id: req.params.id }
            })
          }
        ]
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router; 