import cron from 'node-cron';
import { Campaign } from '../models/Campaign';
import { Customer } from '../models/Customer';
import { Message } from '../models/Message';
import { Segment } from '../models/Segment';
import { TrackingEvent } from '../models/TrackingEvent';
import vendorApi from './vendorApi';
import { emitCampaignProgress, emitCampaignComplete } from '../config/socket';
import { fireWebhooks } from './webhookService';
import { buildSegmentQuery } from '../utils/segmentQueryBuilder';

// Check for scheduled campaigns every minute
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const campaigns = await Campaign.find({
        status: 'scheduled',
        scheduledFor: { $lte: now },
      });

      for (const campaign of campaigns) {
        console.log(`[Scheduler] Sending scheduled campaign: ${campaign.name} (${campaign._id})`);
        await sendCampaignAsync(campaign);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing scheduled campaigns:', error);
    }
  });

  console.log('[Scheduler] Campaign scheduler started (checking every minute)');
}

export async function sendCampaignAsync(campaign: any) {
  try {
    // Get customers
    let customers: any[] = [];
    if (campaign.customers && campaign.customers.length > 0) {
      customers = await Customer.find({ _id: { $in: campaign.customers } });
    } else {
      const segment = await Segment.findById(campaign.segmentId);
      if (segment) {
        const query = buildSegmentQuery(segment.rules as any[], segment.ruleOperator);
        customers = await Customer.find(query);
        campaign.customers = customers.map((c: any) => c._id);
      }
    }

    if (customers.length === 0) {
      campaign.status = 'failed';
      campaign.stats = { totalAudience: 0, sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 };
      await campaign.save();
      return;
    }

    campaign.status = 'completed';
    campaign.sentAt = new Date();
    await campaign.save();

    const totalAudience = customers.length;
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    const messageRecords: any[] = [];

    // Process in batches with real-time progress
    const batchSize = 5;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (customer: any) => {
          try {
            const result = await vendorApi.sendMessage(customer.email, campaign.message);
            sent++;
            if (result.success) delivered++;
            else failed++;

            return {
              customerId: customer._id,
              campaignId: campaign._id,
              campaignName: campaign.name,
              message: campaign.message,
              timestamp: new Date(),
              read: false,
              status: result.success ? 'delivered' : 'failed',
              vendorMessageId: result.messageId || null,
              error: result.error || null,
            };
          } catch {
            sent++;
            failed++;
            return {
              customerId: customer._id,
              campaignId: campaign._id,
              campaignName: campaign.name,
              message: campaign.message,
              timestamp: new Date(),
              read: false,
              status: 'failed',
              error: 'Send error',
            };
          }
        })
      );

      messageRecords.push(...batchResults);

      // Emit real-time progress
      emitCampaignProgress(campaign._id.toString(), {
        totalAudience,
        sent,
        delivered,
        failed,
        progress: Math.round((sent / totalAudience) * 100),
        status: 'sending',
      });
    }

    // Save messages
    if (messageRecords.length > 0) {
      // Use campaign.createdBy for userId (set during campaign creation)
      const messagesWithUser = messageRecords.map(m => ({
        ...m,
        userId: campaign.createdBy,
      }));
      await Message.insertMany(messagesWithUser);
    }

    // Final stats - query real tracking events for opened/clicked counts
    const [openedCount, clickedCount] = await Promise.all([
      TrackingEvent.countDocuments({ campaignId: campaign._id, type: 'opened' }),
      TrackingEvent.countDocuments({ campaignId: campaign._id, type: 'clicked' }),
    ]);

    const stats = {
      totalAudience,
      sent,
      delivered,
      failed,
      // Use real tracking data; falls back to 0 if no tracking events yet
      // (tracking events are recorded when recipients open/click via /api/tracking routes)
      opened: openedCount,
      clicked: clickedCount,
    };
    campaign.stats = stats;
    await campaign.save();

    emitCampaignComplete(campaign._id.toString(), stats);
    fireWebhooks('campaign.completed', { campaignId: campaign._id, stats });
  } catch (error) {
    console.error(`[Scheduler] Error sending campaign ${campaign._id}:`, error);
    campaign.status = 'failed';
    await campaign.save();
  }
}
