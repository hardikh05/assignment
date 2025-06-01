import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Campaign, ICampaign } from '../models/Campaign';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Producer } from 'kafkajs';
import { IUser } from '../models/User';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Customer } from '../models/Customer';
import { Segment } from '../models/Segment';
import { Message } from '../models/Message';

// Initialize Gemini
let gemini: GoogleGenerativeAI | null = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY is not set. AI features will be disabled.');
  } else {
    gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (error) {
  console.error('Error initializing Gemini:', error);
}

const router = express.Router();

// Validation middleware
const validateCampaign = [
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('segmentId').isMongoId().withMessage('Invalid segment ID'),
  body('message').trim().notEmpty().withMessage('Campaign message is required'),
  body('scheduledFor').optional().isISO8601().withMessage('Invalid date format'),
  body('status').optional().isIn(['draft', 'scheduled', 'running', 'completed', 'failed']).withMessage('Invalid status value')
];

// Get all campaigns
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const campaigns = await Campaign.find()
      .populate('segmentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Campaign.countDocuments();

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get campaign by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    console.log('Fetching campaign details for ID:', req.params.id);
    const campaign = await Campaign.findById(req.params.id)
      .populate('segmentId', 'name')
      .populate({
        path: 'customers',
        select: 'name email phone totalSpent lastOrderDate',
      });
    console.log('Fetched campaign:', campaign);

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    res.json({
      status: 'success',
      data: campaign
    });
  } catch (error) {
    next(error);
  }
});

// Create new campaign
router.post('/', authenticate, validateCampaign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = errors.array().map(err => err.msg).join(', ');
      throw new AppError(errorMessage, 400);
    }

    const { name, segmentId, message, scheduledFor, status, customers: selectedCustomers } = req.body;

    // Check if segment exists
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new AppError('Segment not found', 404);
    }

    // Get customers either from selection or segment
    const customers = selectedCustomers 
      ? selectedCustomers.map((id: string) => new mongoose.Types.ObjectId(id))
      : await Customer.find({ segmentId }).then(custs => custs.map(c => c._id));

    const campaign = await Campaign.create({
      name,
      segmentId,
      message,
      customers,
      scheduledFor,
      // Use the status from the request if provided, otherwise determine based on scheduledFor
      status: status || (scheduledFor ? 'scheduled' : 'draft')
    });

    // Send event to Kafka if available
    if (producer) {
      const kafkaProducer = producer as Producer;
      await kafkaProducer.send({
        topic: 'campaign-events',
        messages: [
          {
            value: JSON.stringify({
              type: 'CAMPAIGN_CREATED',
              data: {
                campaignId: campaign._id,
                segmentId: segment._id,
                customerCount: customers.length
              }
            })
          }
        ]
      });
    }

    res.status(201).json({
      status: 'success',
      data: campaign
    });
  } catch (error) {
    next(error);
  }
});

// Update campaign
router.put('/:id', authenticate, validateCampaign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = errors.array().map(err => err.msg).join(', ');
      throw new AppError(errorMessage, 400);
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status === 'completed') {
      throw new AppError('Cannot update a completed campaign', 400);
    }

    const { name, segmentId, message, scheduledFor, status, customers } = req.body;

    // Update customers if provided
    if (customers) {
      // Convert string IDs to ObjectIds
      campaign.customers = customers.map((id: string) => new mongoose.Types.ObjectId(id));
      
      // Send event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'campaign-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'CAMPAIGN_CUSTOMERS_UPDATED',
                data: {
                  campaignId: campaign._id,
                  customerCount: customers.length
                }
              })
            }
          ]
        });
      }
    }

    // If segment is changed, update customers
    if (segmentId && segmentId.toString() !== campaign.segmentId.toString()) {
      const segment = await Segment.findById(segmentId);
      if (!segment) {
        throw new AppError('Segment not found', 404);
      }

      const customers = await Customer.find({ segmentId });
      campaign.customers = customers.map(c => c._id);
      campaign.segmentId = segmentId;

      // Send event to Kafka if available
      if (producer) {
        const kafkaProducer = producer as Producer;
        await kafkaProducer.send({
          topic: 'campaign-events',
          messages: [
            {
              value: JSON.stringify({
                type: 'CAMPAIGN_SEGMENT_UPDATED',
                data: {
                  campaignId: campaign._id,
                  oldSegmentId: campaign.segmentId,
                  newSegmentId: segmentId,
                  customerCount: customers.length
                }
              })
            }
          ]
        });
      }
    }

    campaign.name = name || campaign.name;
    campaign.message = message || campaign.message;
    campaign.scheduledFor = scheduledFor || campaign.scheduledFor;
    
    // Use the status from the request if provided, otherwise keep the existing status
    if (status) {
      campaign.status = status;
    }

    await campaign.save();

    res.json({
      status: 'success',
      data: campaign
    });
  } catch (error) {
    next(error);
  }
});

// Delete campaign
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status === 'completed') {
      throw new AppError('Cannot delete a completed campaign', 400);
    }

    await campaign.deleteOne();

    // Send event to Kafka if available
    if (producer) {
      const kafkaProducer = producer as Producer;
      await kafkaProducer.send({
        topic: 'campaign-events',
        messages: [
          {
            value: JSON.stringify({
              type: 'CAMPAIGN_DELETED',
              data: {
                campaignId: campaign._id,
                segmentId: campaign.segmentId
              }
            })
          }
        ]
      });
    }

    res.json({
      status: 'success',
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Generate campaign message using Gemini
router.post(
  '/generate-message',
  authenticate,
  [
    body('description').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Description is required for AI message generation.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set. AI features are disabled.');
        return res.status(503).json({ error: 'AI features are disabled. Please set GEMINI_API_KEY on the server.' });
      }

      if (!gemini) {
        try {
          gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        } catch (err) {
          console.error('Failed to initialize Gemini:', err);
          return res.status(503).json({ error: 'Failed to initialize AI features. Check your Gemini API key.' });
        }
      }

      const { description } = req.body;

      const prompt = `Generate a compelling marketing message based on the following campaign description:\nDescription: ${description}\nRequirements:\n- Keep the message concise and engaging\n- Include a clear call to action\n- Maintain a professional tone\n- Focus on the value proposition`;

      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const message = result.response.text();
        res.json({ message });
      } catch (err: any) {
        if (err && err.status === 404) {
          // Log a clear error message for debugging
          console.error('Gemini API 404 error: Model not found. Please check your Gemini API key permissions and model availability.');
          return res.status(500).json({ error: 'Gemini AI model not found or not available for your API key. Please check your Gemini API key permissions and model availability.' });
        }
        console.error('Gemini API error:', err);
        return res.status(500).json({ error: 'Failed to generate message using AI. Please try again later.' });
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get customers matching segment rules
router.get('/:id/customers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate({
      path: 'segmentId',
      model: 'Segment'
    }).populate({
      path: 'customers',
      model: 'Customer'
    });
    
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Check if the campaign has directly attached customers (for completed campaigns)
    if (campaign.status === 'completed' || campaign.status === 'failed') {
      if (campaign.customers && campaign.customers.length > 0) {
        // For completed campaigns, use the directly attached customers
        const populatedCustomers = campaign.customers as any[];
        
        // Calculate statistics from the populated customers
        const totalCustomers = populatedCustomers.length;
        const totalVisits = populatedCustomers.reduce((sum, customer) => sum + (customer.visits || 0), 0);
        const totalSpent = populatedCustomers.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
        const averageSpent = totalCustomers > 0 ? totalSpent / totalCustomers : 0;
        
        return res.json({
          status: 'success',
          data: {
            customers: populatedCustomers,
            statistics: {
              totalCustomers,
              totalVisits,
              totalSpent,
              averageSpent
            }
          }
        });
      }
    }

    const segment = campaign.segmentId as any;
    if (!segment) {
      throw new AppError('No segment associated with this campaign', 400);
    }

    // Build query based on segment rules
    const conditions = segment.rules.map((rule: any) => {
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

    const query = segment.ruleOperator === 'AND' ? { $and: conditions } : { $or: conditions };

    // Aggregate customers with up-to-date totalSpent from delivered orders
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
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$orders',
                    as: 'order',
                    cond: { $eq: ['$$order.status', 'delivered'] }
                  }
                },
                as: 'order',
                in: { $ifNull: ['$$order.totalAmount', 0] }
              }
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          visits: 1,
          totalSpent: 1
        }
      }
    ]);

    // Calculate aggregate statistics
    const stats = await Customer.aggregate([
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
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$orders',
                    as: 'order',
                    cond: { $eq: ['$$order.status', 'delivered'] }
                  }
                },
                as: 'order',
                in: { $ifNull: ['$$order.totalAmount', 0] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalVisits: { $sum: '$visits' },
          totalSpent: { $sum: '$totalSpent' },
          averageVisits: { $avg: '$visits' },
          averageSpent: { $avg: '$totalSpent' }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        customers,
        statistics: stats[0] || {
          totalCustomers: 0,
          totalVisits: 0,
          totalSpent: 0,
          averageVisits: 0,
          averageSpent: 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Import vendor API service
import vendorApi from '../services/vendorApi';

// Send campaign
router.post('/:id/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    if (!user?._id) {
      throw new AppError('User not authenticated', 401);
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status === 'completed' || campaign.status === 'failed') {
      throw new AppError('Campaign has already been sent', 400);
    }

    // Get customers for the campaign
    const customerIds = campaign.customers || [];
    
    // If there are no customers in the campaign, we need to find them based on the segment
    let customers = [];
    
    if (customerIds.length === 0) {
      // Populate the segment to get the rules
      const populatedCampaign = await Campaign.findById(req.params.id).populate({
        path: 'segmentId',
        model: 'Segment'
      });
      
      if (!populatedCampaign || !populatedCampaign.segmentId) {
        throw new AppError('Campaign segment not found', 404);
      }
      
      const segment = populatedCampaign.segmentId as any;
      
      // Build query from segment rules
      const query: any = {};
      
      if (segment.rules && segment.rules.length > 0) {
        // Process segment rules to build MongoDB query
        segment.rules.forEach((rule: any) => {
          if (rule.field && rule.operator && rule.value !== undefined) {
            switch (rule.operator) {
              case 'equals':
                query[rule.field] = rule.value;
                break;
              case 'contains':
                query[rule.field] = { $regex: rule.value, $options: 'i' };
                break;
              case 'greaterThan':
                query[rule.field] = { $gt: Number(rule.value) };
                break;
              case 'lessThan':
                query[rule.field] = { $lt: Number(rule.value) };
                break;
              // Add more operators as needed
            }
          }
        });
      }
      
      // Find customers matching the segment rules
      customers = await Customer.find(query);
      
      // Update campaign with found customers
      campaign.customers = customers.map(customer => customer._id);
      await campaign.save();
    } else {
      // Find customers by IDs
      customers = await Customer.find({ _id: { $in: customerIds } });
    }
    
    if (customers.length === 0) {
      throw new AppError('No customers found for this campaign or its segment', 400);
    }

    // Determine if campaign succeeds (90%) or fails (10%)
    const isSuccessful = Math.random() <= 0.9;
    
    // Update campaign status based on success rate
    campaign.status = isSuccessful ? 'completed' : 'failed';
    campaign.sentAt = new Date();
    
    // Initialize stats based on success/failure
    const totalAudience = customers.length;
    const delivered = isSuccessful ? Math.floor(totalAudience * 0.95) : 0; // 95% delivery rate for successful campaigns
    const failed = isSuccessful ? totalAudience - delivered : totalAudience;
    
    campaign.stats = {
      totalAudience: totalAudience,
      sent: totalAudience,
      delivered: delivered,
      failed: failed,
      opened: isSuccessful ? Math.floor(delivered * 0.7) : 0, // 70% open rate for delivered messages
      clicked: isSuccessful ? Math.floor(delivered * 0.3) : 0  // 30% click rate for delivered messages
    };
    
    await campaign.save();
    
    // Send messages to customers using vendor API
    const messageResults = [];
    const successfulDeliveries = [];
    const failedDeliveries = [];
    
    // Process customers in batches to avoid overwhelming the vendor API
    const batchSize = 10;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Send messages in parallel for this batch
      const batchResults = await Promise.all(
        batch.map(async (customer) => {
          try {
            // Determine message success based on campaign success
            // For successful campaigns: 95% message success rate
            // For failed campaigns: 0% message success rate
            let result;
            if (isSuccessful) {
              // Use vendor API only for successful campaigns
              result = await vendorApi.sendMessage(
                customer.email, 
                campaign.message
              );
            } else {
              // For failed campaigns, simulate failure without calling API
              result = {
                success: false,
                messageId: null,
                error: 'Campaign failed to send'
              };
            }
            
            // Create a message record regardless of success/failure
            const message = {
              userId: user._id,
              customerId: customer._id,
              campaignId: campaign._id,
              campaignName: campaign.name,
              message: campaign.message,
              timestamp: new Date(),
              read: false,
              status: result.success ? 'delivered' : 'failed',
              vendorMessageId: result.messageId || null,
              error: result.error || null
            };
            
            // Track success/failure for stats
            if (result.success) {
              successfulDeliveries.push(message);
            } else {
              failedDeliveries.push(message);
            }
            
            return message;
          } catch (error) {
            console.error(`Error sending message to customer ${customer._id}:`, error);
            // Create a failed message record
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const failedMessage = {
              userId: user._id,
              customerId: customer._id,
              campaignId: campaign._id,
              campaignName: campaign.name,
              message: campaign.message,
              timestamp: new Date(),
              read: false,
              status: 'failed',
              error: errorMessage
            };
            failedDeliveries.push(failedMessage);
            return failedMessage;
          }
        })
      );
      
      messageResults.push(...batchResults);
      
      // Update campaign stats after each batch
      campaign.stats = {
        totalAudience: customers.length,
        sent: messageResults.length,
        delivered: successfulDeliveries.length,
        failed: failedDeliveries.length,
        opened: 0, // Will be updated later
        clicked: 0  // Will be updated later
      };
      await campaign.save();
    }
    
    // Save all messages to the database
    if (messageResults.length > 0) {
      await Message.insertMany(messageResults);
      console.log(`Processed ${messageResults.length} messages for campaign ${campaign._id}`);
    }
    
    // Store the total audience count for use in the timeout function
    const totalAudienceCount = customers.length;
    
    // We've already set the campaign status and statistics upfront based on success rate
    // This timeout is just to simulate some delayed opens and clicks for successful campaigns
    if (isSuccessful) {
      setTimeout(async () => {
        try {
          const updatedCampaign = await Campaign.findById(campaign._id);
          if (updatedCampaign && updatedCampaign.status === 'completed') {
            // Get the number of delivered messages
            const deliveredMessages = await Message.countDocuments({ 
              campaignId: campaign._id, 
              status: 'delivered' 
            });
            
            // Update campaign stats with simulated opens and clicks
            // These values increase over time to simulate user engagement
            if (updatedCampaign.stats) {
              updatedCampaign.stats = {
                totalAudience: updatedCampaign.stats.totalAudience,
                sent: updatedCampaign.stats.sent,
                delivered: updatedCampaign.stats.delivered,
                failed: updatedCampaign.stats.failed,
                opened: Math.floor(deliveredMessages * 0.8),  // Increased from 70% to 80%
                clicked: Math.floor(deliveredMessages * 0.4)  // Increased from 30% to 40%
              };
            }
            
            await updatedCampaign.save();
            console.log(`Updated engagement stats for completed campaign ${campaign._id}`);
          }
        } catch (error) {
          console.error('Error updating campaign engagement stats:', error);
        }
      }, 60000); // 1 minute
    }

    // Send event to Kafka if available
    if (producer) {
      const kafkaProducer = producer as Producer;
      await kafkaProducer.send({
        topic: 'campaign-events',
        messages: [
          {
            value: JSON.stringify({
              type: 'CAMPAIGN_SENT',
              data: {
                campaignId: campaign._id,
                segmentId: campaign.segmentId,
                customerCount: campaign.customers.length,
                sentAt: campaign.sentAt
              }
            })
          }
        ]
      });
    }
    
    // Return the updated campaign with current stats
    return res.status(200).json({
      status: 'success',
      data: {
        campaign: {
          _id: campaign._id,
          name: campaign.name,
          status: campaign.status,
          sentAt: campaign.sentAt,
          stats: campaign.stats,
          message: 'Campaign is being sent to customers via the vendor API'
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router; 