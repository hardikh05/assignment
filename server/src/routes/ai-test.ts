import express from 'express';

const router = express.Router();

/**
 * @route GET /api/ai-test
 * @desc Test endpoint for AI functionality
 * @access Public
 */
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'AI test endpoint is working',
    env: {
      openaiKeySet: !!process.env.OPENAI_API_KEY
    }
  });
});

export default router;
