import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

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
      console.log('Google auth user:', user ? 'Yes' : 'No');
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' } // Extended token expiration for better user experience
      );
      console.log('Generated token:', token);

      // Redirect to frontend with token - using the exact domain from the error URL
      res.redirect(`https://echoassign.onrender.com/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`https://echoassign.onrender.com/login?error=auth_failed`);
    }
  }
);

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    console.log('Auth headers:', req.headers);
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Token:', token);
    
    if (!token) {
      throw new AppError('No token provided', 401);
    }

    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    console.log('Decoded token:', decoded);
    
    const user = await User.findById(decoded.id);
    console.log('Found user:', user ? 'Yes' : 'No');

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
    console.error('Get current user error:', error);
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
    
    // Verify the token
    try {
      const decoded = jwt.verify(token as string, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      // If token is valid, redirect to the frontend dashboard or home page
      return res.redirect(`https://echoassign.onrender.com/dashboard`);
    } catch (error) {
      console.error('Invalid token:', error);
      return res.status(401).send('Invalid or expired token');
    }
  } catch (error) {
    console.error('Callback route error:', error);
    return res.status(500).send('Server error');
  }
});

export default router; 