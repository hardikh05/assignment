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
}

// Campaign Types
export interface Campaign {
  _id: string;
  name: string;
  description: string;
  segmentId: string | Segment | { _id: string; name: string; };
  message?: string;
  customerIds: string[];
  status: 'draft' | 'completed' | 'failed';
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
}

// Order Types
export interface Order {
  _id: string;
  customerId: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  items: OrderItem[];
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
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
} 