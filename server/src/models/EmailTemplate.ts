import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  subject: string;
  htmlContent: string;
  jsonDesign: Record<string, any>; // Unlayer design JSON
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, default: '' },
    htmlContent: { type: String, default: '' },
    jsonDesign: { type: Schema.Types.Mixed, default: {} },
    thumbnail: { type: String },
  },
  { timestamps: true }
);

emailTemplateSchema.index({ userId: 1 });

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);
