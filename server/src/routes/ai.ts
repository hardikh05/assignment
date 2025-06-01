import express from 'express';
import { generateCampaignMessage } from '../services/openai';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/ai/generate-message
 * @desc Generate campaign message using AI
 * @access Private
 */
router.post('/generate-message', authenticate, async (req, res) => {
  try {
    const { segmentName, campaignName, campaignDescription } = req.body;
    
    if (!segmentName || !campaignName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Segment name and campaign name are required' 
      });
    }

    const message = await generateCampaignMessage(
      segmentName,
      campaignName,
      campaignDescription || ''
    );

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error generating AI message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate message',
    });
  }
});

export default router;
