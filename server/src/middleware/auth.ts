import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { Document } from 'mongoose';
import { AppError } from './errorHandler';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { id: string };
      
      // Find the user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Attach user to request
      (req as AuthRequest).user = user;
      next();
    } catch (jwtError) {
      // Only log critical errors
      if (jwtError instanceof jwt.JsonWebTokenError) {
        next(new AppError('Invalid token', 401));
      } else {
        next(jwtError);
      }
    }
  } catch (error) {
    // Only log critical errors
    next(error);
  }
}; 