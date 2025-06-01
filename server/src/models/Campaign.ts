import mongoose, { Document } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  segmentId: mongoose.Types.ObjectId;
  message: string;
  customers: mongoose.Types.ObjectId[];
  status: 'draft' | 'completed' | 'failed';
  scheduledFor?: Date;
  sentAt?: Date;
  stats?: {
    totalAudience: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  customers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  }],
  status: {
    type: String,
    enum: ['draft', 'completed', 'failed'],
    default: 'draft'
  },
  scheduledFor: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  stats: {
    totalAudience: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduledFor: 1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema); 