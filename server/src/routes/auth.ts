import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }
  return secret;
};

const getFrontendUrl = (): string => {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const token = jwt.sign(
        { id: user._id },
        getJwtSecret(),
        { expiresIn: '30d' }
      );

      // Redirect to frontend with token
      res.redirect(`${getFrontendUrl()}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${getFrontendUrl()}/login?error=auth_failed`);
    }
  }
);

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('No token provided', 401);
    }

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || null,
      role: user.role
    });
  } catch (error) {
    next(error);
  }
});

// Handle direct callback with token
router.get('/callback', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send('Token is required');
    }
    
    try {
      jwt.verify(token as string, getJwtSecret());
      // If token is valid, redirect to the frontend dashboard
      return res.redirect(`${getFrontendUrl()}/`);
    } catch (error) {
      console.error('Invalid token');
      return res.status(401).send('Invalid or expired token');
    }
  } catch (error) {
    console.error('Callback route error:', error);
    return res.status(500).send('Server error');
  }
});

export default router;
