import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'send' | 'import' | 'export';
  entity: 'customer' | 'campaign' | 'segment' | 'order' | 'webhook' | 'user';
  entityId: mongoose.Types.ObjectId;
  entityName: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'send', 'import', 'export'],
      required: true,
    },
    entity: {
      type: String,
      enum: ['customer', 'campaign', 'segment', 'order', 'webhook', 'user'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityName: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
