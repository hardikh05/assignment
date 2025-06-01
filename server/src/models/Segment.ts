import mongoose, { Document, Schema } from 'mongoose';

export interface ISegmentRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface ISegment extends Document {
  name: string;
  description: string;
  rules: ISegmentRule[];
  ruleOperator: 'AND' | 'OR';
  customerCount: number;
  customers: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const segmentRuleSchema = new Schema<ISegmentRule>({
  field: {
    type: String,
    required: true,
  },
  operator: {
    type: String,
    enum: ['equals', 'notEquals', 'greaterThan', 'lessThan'],
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

const segmentSchema = new Schema<ISegment>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    rules: [segmentRuleSchema],
    ruleOperator: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    customerCount: {
      type: Number,
      default: 0,
    },
    customers: [{
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
segmentSchema.index({ createdBy: 1 });
segmentSchema.index({ customers: 1 });

export const Segment = mongoose.model<ISegment>('Segment', segmentSchema); 