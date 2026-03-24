import express, { Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Customer } from '../models/Customer';
import { Campaign } from '../models/Campaign';
import { Order } from '../models/Order';
import { Segment } from '../models/Segment';
import { Message } from '../models/Message';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

// Allowed fields per collection for AI queries (whitelist)
const ALLOWED_FIELDS: Record<string, string[]> = {
  customers: ['name', 'email', 'phone', 'totalSpent', 'visits', 'createdAt'],
  campaigns: ['name', 'description', 'status', 'message', 'sentAt', 'stats', 'createdAt'],
  orders: ['customerId', 'orderNumber', 'totalAmount', 'status', 'items', 'createdAt'],
  segments: ['name', 'description', 'rules', 'customerCount', 'createdAt'],
  messages: ['customerId', 'campaignId', 'campaignName', 'status', 'timestamp'],
};

// Dangerous MongoDB operators that should never appear in AI-generated queries
const DANGEROUS_OPERATORS = ['$where', '$expr', '$function', '$accumulator'];
const DANGEROUS_AGGREGATION_STAGES = ['$out', '$merge', '$collStats', '$indexStats', '$planCacheStats'];

// Recursively strip dangerous operators from a query/filter object
function sanitizeQueryObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeQueryObject);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block dangerous operators
    if (DANGEROUS_OPERATORS.includes(key)) continue;
    sanitized[key] = sanitizeQueryObject(value);
  }
  return sanitized;
}

// Sanitize aggregation pipeline: strip dangerous stages and cap limits
function sanitizeAggregation(pipeline: any[]): any[] {
  if (!Array.isArray(pipeline)) return [];
  return pipeline
    .filter((stage) => {
      if (typeof stage !== 'object' || stage === null) return false;
      const stageKey = Object.keys(stage)[0];
      return !DANGEROUS_AGGREGATION_STAGES.includes(stageKey);
    })
    .map(sanitizeQueryObject)
    .slice(0, 5); // Cap pipeline length
}

// AI Chat endpoint - natural language CRM queries
router.post('/query', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, message: userMessage } = req.body;
    const queryText = question || userMessage;
    if (!queryText) return res.status(400).json({ error: 'Question or message is required' });

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI features are disabled' });
    }

    // Step 1: Ask AI to generate a query plan
    const planResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a CRM database assistant. Given a user's question about their CRM data, determine which MongoDB queries to run.

Available collections and their fields:
- customers: name, email, phone, totalSpent, visits, createdAt
- campaigns: name, description, status (draft/completed/failed), message, sentAt, stats {totalAudience, sent, delivered, failed, opened, clicked}, createdAt
- orders: customerId, orderNumber, totalAmount, status (pending/processing/shipped/delivered/cancelled), items [{name, quantity, price}], createdAt
- segments: name, description, rules, customerCount, createdAt
- messages: customerId, campaignId, campaignName, status (pending/delivered/failed), timestamp

Return a JSON object with:
{
  "queries": [
    {
      "collection": "customers|campaigns|orders|segments|messages",
      "operation": "count|find|aggregate",
      "filter": {},
      "sort": {},
      "limit": 10,
      "aggregation": [] // only for aggregate operations
    }
  ],
  "intent": "brief description of what the user wants to know"
}

Return ONLY valid JSON, no markdown, no explanation.`,
        },
        { role: 'user', content: queryText },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const planContent = planResponse.choices[0]?.message?.content?.trim() || '{}';
    const cleaned = planContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    let plan: any;
    try {
      plan = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'AI could not understand the question. Please try rephrasing.' });
    }

    // Step 2: Execute the queries (with sanitization)
    const collectionMap: Record<string, any> = {
      customers: Customer,
      campaigns: Campaign,
      orders: Order,
      segments: Segment,
      messages: Message,
    };

    const results: any[] = [];
    for (const q of (plan.queries || []).slice(0, 3)) {
      const Model = collectionMap[q.collection];
      if (!Model) continue;

      // Sanitize all query objects to strip dangerous operators
      const sanitizedFilter = sanitizeQueryObject(q.filter || {});
      const sanitizedSort = sanitizeQueryObject(q.sort || { createdAt: -1 });
      const safeLimit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 50); // Cap at 50 results

      try {
        let result;
        if (q.operation === 'count') {
          result = await Model.countDocuments(sanitizedFilter);
        } else if (q.operation === 'aggregate') {
          const sanitizedPipeline = sanitizeAggregation(q.aggregation || []);
          // Always add a $limit at the end to prevent unbounded results
          sanitizedPipeline.push({ $limit: safeLimit });
          result = await Model.aggregate(sanitizedPipeline);
        } else {
          result = await Model.find(sanitizedFilter)
            .sort(sanitizedSort)
            .limit(safeLimit)
            .lean();
        }
        results.push({ collection: q.collection, operation: q.operation, data: result });
      } catch (err) {
        results.push({ collection: q.collection, error: 'Query failed' });
      }
    }

    // Step 3: Ask AI to interpret the results
    const answerResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful CRM assistant. Given the user\'s question and the database query results, provide a clear, concise answer. Use numbers and specifics from the data. Format nicely with bullet points if listing items. Keep it brief - 2-4 sentences for simple questions, bullet list for listing questions.',
        },
        {
          role: 'user',
          content: `Question: ${queryText}\n\nDatabase Results:\n${JSON.stringify(results, null, 2)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const answer = answerResponse.choices[0]?.message?.content?.trim() || 'Unable to process your question.';

    res.json({
      reply: answer,
      answer,
      intent: plan.intent,
      queryCount: results.length,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    next(error);
  }
});

export default router;
