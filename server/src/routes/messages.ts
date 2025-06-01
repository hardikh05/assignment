import express, { Response, NextFunction, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { Message, IMessage } from '../models/Message';
import { Campaign } from '../models/Campaign';
import { Customer } from '../models/Customer';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { producer } from '../config/kafka';
import { Producer } from 'kafkajs';
import { IUser } from '../models/User';
import vendorApi from '../services/vendorApi';

const router = express.Router();

// Get all messages for the current user
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }
    const messages = await Message.find({ userId: user._id })
      .populate('customerId', 'name email')
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Mark message as read
router.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }
    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { read: true },
      { new: true }
    );

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    res.json(message);
  } catch (error) {
    next(error);
  }
});

// Send campaign message to customers
router.post('/campaign/:campaignId/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }
    const campaign = await Campaign.findById(req.params.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Get all customers in the campaign's segment
    const customers = await Customer.find({ segmentId: campaign.segmentId });

    // Handle empty segment
    if (customers.length === 0) {
      return res.status(400).json({ error: 'No customers found in segment. No messages created.' });
    }

    // Create messages for each customer and send via vendor API
    const messages: any[] = [];
    const errors: any[] = [];

    for (const customer of customers) {
      try {
        const message = await Message.create({
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
        const result = await vendorApi.sendMessage(customer.email, campaign.message);
        const status = result.success ? 'COMPLETED' : 'FAILED';
        await Message.findByIdAndUpdate(message._id, { status });
        messages.push({ ...message.toObject(), status });
      } catch (err) {
        errors.push({ customerId: customer._id, error: err });
      }
    }

    // Update campaign status only if at least one message was created
    let newStatus: 'completed' | 'failed' = 'completed';
    if (messages.length === 0) {
      return res.status(500).json({ error: 'No messages were created for the campaign.', details: errors });
    }
    if (messages.some(msg => msg.status === 'FAILED')) newStatus = 'failed';

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaign._id,
      { status: newStatus },
      { new: true }
    );

    res.status(201).json({
      message: 'Messages sent',
      campaign: updatedCampaign,
      messages,
      errors
    });
  } catch (error) {
    next(error);
  }
});

export default router; 