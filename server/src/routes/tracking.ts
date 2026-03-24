import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { TrackingEvent } from '../models/TrackingEvent';
import { Campaign } from '../models/Campaign';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 1x1 transparent PNG pixel
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Generate a tracking ID for a customer-campaign pair
export function generateTrackingId(campaignId: string, customerId: string): string {
  return crypto.createHash('sha256').update(`${campaignId}:${customerId}:${Date.now()}`).digest('hex').slice(0, 24);
}

// Tracking pixel endpoint - records email opens (no auth needed)
router.get('/pixel/:trackingId', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    const existing = await TrackingEvent.findOne({ trackingId, type: 'sent' });
    if (existing) {
      await TrackingEvent.create({
        campaignId: existing.campaignId,
        customerId: existing.customerId,
        messageId: existing.messageId,
        type: 'opened',
        trackingId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
      });

      // Update campaign stats
      await Campaign.findByIdAndUpdate(existing.campaignId, { $inc: { 'stats.opened': 1 } });
    }
  } catch (error) {
    console.error('Tracking pixel error:', error);
  }

  // Always return the pixel
  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': TRACKING_PIXEL.length, 'Cache-Control': 'no-cache, no-store' });
  res.end(TRACKING_PIXEL);
});

// Link redirect endpoint - records clicks (no auth needed)
router.get('/click/:trackingId', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    const url = req.query.url as string;
    const existing = await TrackingEvent.findOne({ trackingId, type: 'sent' });

    if (existing) {
      await TrackingEvent.create({
        campaignId: existing.campaignId,
        customerId: existing.customerId,
        messageId: existing.messageId,
        type: 'clicked',
        trackingId,
        linkUrl: url,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
      });

      await Campaign.findByIdAndUpdate(existing.campaignId, { $inc: { 'stats.clicked': 1 } });
    }

    res.redirect(url || '/');
  } catch (error) {
    console.error('Tracking click error:', error);
    res.redirect(req.query.url as string || '/');
  }
});

// Get tracking analytics for a campaign (auth required)
router.get('/analytics/:campaignId', authenticate, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    const [funnel, timeline] = await Promise.all([
      // Funnel data
      TrackingEvent.aggregate([
        { $match: { campaignId: require('mongoose').Types.ObjectId.createFromHexString(campaignId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      // Timeline: events per hour
      TrackingEvent.aggregate([
        { $match: { campaignId: require('mongoose').Types.ObjectId.createFromHexString(campaignId) } },
        {
          $group: {
            _id: {
              type: '$type',
              hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.hour': 1 } },
      ]),
    ]);

    const funnelMap: Record<string, number> = {};
    funnel.forEach((f: any) => { funnelMap[f._id] = f.count; });

    res.json({
      funnel: {
        sent: funnelMap.sent || 0,
        delivered: funnelMap.delivered || 0,
        opened: funnelMap.opened || 0,
        clicked: funnelMap.clicked || 0,
        converted: funnelMap.converted || 0,
      },
      timeline,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
