import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Producer } from 'kafkajs';
import { Customer } from '../models/Customer';
import { Segment } from '../models/Segment';
import { Message } from '../models/Message';
import { buildSegmentQuery, getTotalSpentPipelineStages } from '../utils/segmentQueryBuilder';

const router = express.Router();

// Validation middleware
const validateCampaign = [
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('segmentId').isMongoId().withMessage('Invalid segment ID'),
  body('message').trim().notEmpty().withMessage('Campaign message is required'),
  body('scheduledFor').optional().isISO8601().withMessage('Invalid date format'),
  body('status').optional().isIn(['draft', 'scheduled', 'completed', 'failed']).withMessage('Invalid status value')
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
      createdBy: user._id,
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

    // Build query using the shared utility
    const query = buildSegmentQuery(segment.rules, segment.ruleOperator);

    // Use $facet to get both customers and stats in a single aggregation
    const [result] = await Customer.aggregate([
      { $match: query },
      ...getTotalSpentPipelineStages(),
      {
        $facet: {
          customers: [
            {
              $project: {
                name: 1,
                email: 1,
                visits: 1,
                totalSpent: 1
              }
            }
          ],
          statistics: [
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
          ]
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        customers: result.customers,
        statistics: result.statistics[0] || {
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
import { emitCampaignProgress, emitCampaignComplete } from '../config/socket';
import { fireWebhooks } from '../services/webhookService';

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
      
      // Build query from segment rules using the shared utility
      const query = buildSegmentQuery(segment.rules || [], segment.ruleOperator || 'AND');
      
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
    
    // Mark campaign as sending
    campaign.status = 'sending' as any;
    await campaign.save();
    
    // Initialize stats based on success/failure
    const totalAudience = customers.length;
    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    
    // Send messages to customers using vendor API
    const messageResults = [];
    const successfulDeliveries: any[] = [];
    const failedDeliveries: any[] = [];
    
    // Process customers in batches to avoid overwhelming the vendor API
    const batchSize = 10;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Send messages in parallel for this batch
      const batchResults = await Promise.all(
        batch.map(async (customer) => {
          try {
            // Determine message success based on campaign success
            let result;
            if (isSuccessful) {
              result = await vendorApi.sendMessage(
                customer.email, 
                campaign.message
              );
            } else {
              result = {
                success: false,
                messageId: null,
                error: 'Campaign failed to send'
              };
            }
            
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
            
            if (result.success) {
              successfulDeliveries.push(message);
              deliveredCount++;
            } else {
              failedDeliveries.push(message);
              failedCount++;
            }
            sentCount++;
            
            return message;
          } catch (error) {
            console.error(`Error sending message to customer ${customer._id}:`, error);
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
            sentCount++;
            failedCount++;
            return failedMessage;
          }
        })
      );
      
      messageResults.push(...batchResults);

      // Emit real-time progress via Socket.io
      emitCampaignProgress(campaign._id.toString(), {
        totalAudience,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        progress: Math.round((sentCount / totalAudience) * 100),
        status: 'sending',
      });
    }
    
    // Save all messages to the database
    if (messageResults.length > 0) {
      await Message.insertMany(messageResults);
      console.log(`Processed ${messageResults.length} messages for campaign ${campaign._id}`);
    }
    
    // Compute final stats inline instead of using setTimeout (#21)
    campaign.status = isSuccessful ? 'completed' : 'failed';
    campaign.sentAt = new Date();
    const finalStats = {
      totalAudience: customers.length,
      sent: messageResults.length,
      delivered: successfulDeliveries.length,
      failed: failedDeliveries.length,
      opened: isSuccessful ? Math.floor(successfulDeliveries.length * 0.8) : 0,
      clicked: isSuccessful ? Math.floor(successfulDeliveries.length * 0.4) : 0
    };
    campaign.stats = finalStats;
    await campaign.save();

    // Emit completion via Socket.io
    emitCampaignComplete(campaign._id.toString(), finalStats);
    // Fire webhooks
    fireWebhooks('campaign.completed', { campaignId: campaign._id, stats: finalStats });

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