import { Customer } from '../models/Customer';

// Whitelist of allowed fields to prevent NoSQL injection
const ALLOWED_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'totalSpent',
  'visits',
  'createdAt',
  'updatedAt',
]);

function isAllowedField(field: string): boolean {
  // Reject fields starting with $ (MongoDB operators)
  if (field.startsWith('$')) return false;
  // Reject fields containing dots (nested operator injection)
  if (field.includes('.')) return false;
  return ALLOWED_FIELDS.has(field);
}

export interface SegmentRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains';
  value: any;
}

/**
 * Build a MongoDB query from segment rules.
 * Shared utility used across campaigns, segments, and message routes.
 */
export function buildSegmentQuery(rules: SegmentRule[], ruleOperator: 'AND' | 'OR'): Record<string, any> {
  if (!rules || rules.length === 0) {
    return {};
  }

  const conditions = rules
    .filter(rule => rule.field && rule.operator && rule.value !== undefined)
    .map((rule) => {
      // Sanitize field name to prevent NoSQL injection
      if (!isAllowedField(rule.field)) {
        console.warn(`Blocked disallowed segment rule field: "${rule.field}"`);
        return null;
      }

      switch (rule.operator) {
        case 'equals': {
          const value = rule.value;
          if (typeof value === 'string' && !isNaN(Number(value))) {
            return {
              $or: [
                { [rule.field]: value },
                { [rule.field]: Number(value) }
              ]
            };
          }
          return { [rule.field]: value };
        }
        case 'notEquals': {
          const notEqualsValue = rule.value;
          if (typeof notEqualsValue === 'string' && !isNaN(Number(notEqualsValue))) {
            return {
              $and: [
                { [rule.field]: { $ne: notEqualsValue } },
                { [rule.field]: { $ne: Number(notEqualsValue) } }
              ]
            };
          }
          return { [rule.field]: { $ne: notEqualsValue } };
        }
        case 'greaterThan':
          return { [rule.field]: { $gt: Number(rule.value) } };
        case 'lessThan':
          return { [rule.field]: { $lt: Number(rule.value) } };
        case 'contains':
          return { [rule.field]: { $regex: String(rule.value), $options: 'i' } };
        default:
          return null;
      }
    })
    .filter((condition): condition is Record<string, any> => condition !== null);

  if (conditions.length === 0) {
    return {};
  }

  return ruleOperator === 'AND' ? { $and: conditions } : { $or: conditions };
}

/**
 * Calculate the number of customers matching segment rules.
 */
export async function calculateSegmentSize(rules: SegmentRule[], ruleOperator: 'AND' | 'OR'): Promise<number> {
  const query = buildSegmentQuery(rules, ruleOperator);
  return Customer.countDocuments(query);
}

/**
 * Aggregation pipeline stages to compute totalSpent from delivered orders.
 * Uses the consistent field name 'totalAmount' and filters for 'delivered' status.
 */
export function getTotalSpentPipelineStages() {
  return [
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'customerId',
        as: 'orders'
      }
    },
    {
      $addFields: {
        totalSpent: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$orders',
                  as: 'order',
                  cond: { $eq: ['$$order.status', 'delivered'] }
                }
              },
              as: 'order',
              in: { $ifNull: ['$$order.totalAmount', 0] }
            }
          }
        }
      }
    }
  ];
}
