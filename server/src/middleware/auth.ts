import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { AppError } from './errorHandler';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: IUser;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }
  return secret;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, getJwtSecret()) as { id: string };
      
      // Find the user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Attach user to request
      (req as AuthRequest).user = user;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.JsonWebTokenError) {
        next(new AppError('Invalid token', 401));
      } else {
        next(jwtError);
      }
    }
  } catch (error) {
    next(error);
  }
};
