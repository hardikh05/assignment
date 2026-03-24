import { AuditLog } from '../models/AuditLog';

export async function createAuditLog(params: {
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'send' | 'import' | 'export';
  entity: 'customer' | 'campaign' | 'segment' | 'order' | 'webhook' | 'user';
  entityId: string;
  entityName: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    await AuditLog.create(params);
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}
