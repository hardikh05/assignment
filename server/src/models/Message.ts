import mongoose, { Document } from 'mongoose';

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  campaignName: string;
  message: string;
  timestamp: Date;
  read: boolean;
  status: 'pending' | 'delivered' | 'failed';
  vendorMessageId?: string | null;
  error?: string | null;
}

const messageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  campaignName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    required: true
  },
  vendorMessageId: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  }
});

// Add indexes for better query performance
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ customerId: 1 });
messageSchema.index({ campaignId: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema); 