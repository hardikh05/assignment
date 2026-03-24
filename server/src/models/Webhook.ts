import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhook extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  lastTriggered?: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const webhookSchema = new Schema<IWebhook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    events: [{
      type: String,
      enum: [
        'customer.created', 'customer.updated', 'customer.deleted',
        'campaign.created', 'campaign.sent', 'campaign.completed',
        'order.created', 'order.updated', 'order.delivered',
        'segment.created',
      ],
    }],
    secret: { type: String },
    active: { type: Boolean, default: true },
    lastTriggered: { type: Date },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

webhookSchema.index({ userId: 1 });
webhookSchema.index({ events: 1, active: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', webhookSchema);
