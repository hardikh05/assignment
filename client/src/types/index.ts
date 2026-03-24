// Auth Types
export interface AuthState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Customer Types
export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  totalSpent: number;
  totalVisits: number;
  visits?: number;
  lastVisit?: Date;
  customFields?: Record<string, string>;
}

export interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
}

// Segment Types
export interface SegmentRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan';
  value: string;
}

export interface Segment {
  _id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  ruleOperator: 'AND' | 'OR';
  createdAt: string;
  updatedAt: string;
}

export interface SegmentState {
  segments: Segment[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

// Campaign Types
export interface Campaign {
  _id: string;
  name: string;
  description: string;
  segmentId: string | Segment | { _id: string; name: string; };
  message?: string;
  customerIds: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduledFor?: string;
  totalSpent?: number;
  stats?: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  totalAudience: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
}

export interface CampaignState {
  campaigns: Campaign[];
  customers: Customer[];
  statistics: {
    totalCustomers: number;
    totalVisits: number;
    totalSpent: number;
    averageSpent: number;
  };
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

// Order Types
export interface Order {
  _id: string;
  customerId: string;
  orderNumber: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderState {
  orders: Order[];
  loading: boolean;
  error: string | null;
}

// Message Types
export interface Message {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  read: boolean;
}

export interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
}

// Form Types
export interface CustomerFormData {
  name: string;
  email: string;
}

export interface SegmentFormData {
  name: string;
  description: string;
  rules: SegmentRule[];
  ruleOperator: 'AND' | 'OR';
}

export interface CampaignFormData {
  name: string;
  description: string;
  scheduledFor?: string;
}

export interface OrderFormData {
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: Order['status'];
  orderNumber: string;
}

// Webhook Types
export interface Webhook {
  _id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookState {
  webhooks: Webhook[];
  loading: boolean;
  error: string | null;
}

// Audit Log Types
export interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface AuditLogState {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// Email Template Types
export interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  htmlContent: string;
  jsonDesign?: any;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateState {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
}

// Tracking / Analytics Types
export interface TrackingEvent {
  _id: string;
  campaignId: string;
  customerId: string;
  type: 'open' | 'click';
  url?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AnalyticsData {
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  timeline: { date: string; opens: number; clicks: number }[];
}

export interface AnalyticsState {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
}

// AI Chat Types
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  data?: any;
}

export interface AIChatState {
  messages: AIChatMessage[];
  loading: boolean;
  error: string | null;
}

// Activity Timeline Types
export interface ActivityEvent {
  type: 'order' | 'message' | 'campaign';
  date: string;
  title: string;
  description: string;
  status: string;
  data: any;
}

// Socket.io event types
export interface CampaignProgress {
  campaignId: string;
  totalAudience: number;
  sent: number;
  delivered: number;
  failed: number;
  progress: number;
  status: string;
}