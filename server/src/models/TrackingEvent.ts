import mongoose, { Document, Schema } from 'mongoose';

export interface ITrackingEvent extends Document {
  campaignId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  messageId?: mongoose.Types.ObjectId;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'converted';
  trackingId: string; // unique per customer-campaign pair
  linkUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

const trackingEventSchema = new Schema<ITrackingEvent>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    type: {
      type: String,
      enum: ['sent', 'delivered', 'opened', 'clicked', 'converted'],
      required: true,
    },
    trackingId: { type: String, required: true, index: true },
    linkUrl: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

trackingEventSchema.index({ campaignId: 1, type: 1 });
trackingEventSchema.index({ customerId: 1 });
trackingEventSchema.index({ trackingId: 1 });

export const TrackingEvent = mongoose.model<ITrackingEvent>('TrackingEvent', trackingEventSchema);
