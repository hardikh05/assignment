import { Document, Types } from 'mongoose';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
} 