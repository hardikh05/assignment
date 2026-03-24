import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Webhook } from '../models/Webhook';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/auditService';

const router = express.Router();

// Get all webhooks for current user
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const webhooks = await Webhook.find({ userId: user!._id }).sort({ createdAt: -1 });
    res.json({ webhooks });
  } catch (error) {
    next(error);
  }
});

// Create webhook
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty(),
    body('url').trim().isURL(),
    body('events').isArray({ min: 1 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const { user } = req as AuthRequest;
      const webhook = await Webhook.create({ ...req.body, userId: user!._id });

      await createAuditLog({
        userId: user!._id.toString(),
        userName: user!.name || user!.email,
        action: 'create',
        entity: 'webhook',
        entityId: webhook._id.toString(),
        entityName: webhook.name,
        ipAddress: req.ip,
      });

      res.status(201).json(webhook);
    } catch (error) {
      next(error);
    }
  }
);

// Update webhook (whitelist allowed fields to prevent mass assignment)
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    // Only allow updating safe, user-controlled fields
    const { name, url, events, active, secret } = req.body;
    const allowedUpdates: Record<string, any> = {};
    if (name !== undefined) allowedUpdates.name = name;
    if (url !== undefined) allowedUpdates.url = url;
    if (events !== undefined) allowedUpdates.events = events;
    if (active !== undefined) allowedUpdates.active = active;
    if (secret !== undefined) allowedUpdates.secret = secret;

    const webhook = await Webhook.findOneAndUpdate(
      { _id: req.params.id, userId: user!._id },
      allowedUpdates,
      { new: true }
    );
    if (!webhook) throw new AppError('Webhook not found', 404);

    await createAuditLog({
      userId: user!._id.toString(),
      userName: user!.name || user!.email,
      action: 'update',
      entity: 'webhook',
      entityId: webhook._id.toString(),
      entityName: webhook.name,
      ipAddress: req.ip,
    });

    res.json(webhook);
  } catch (error) {
    next(error);
  }
});

// Delete webhook
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const webhook = await Webhook.findOne({ _id: req.params.id, userId: user!._id });
    if (!webhook) throw new AppError('Webhook not found', 404);

    await createAuditLog({
      userId: user!._id.toString(),
      userName: user!.name || user!.email,
      action: 'delete',
      entity: 'webhook',
      entityId: webhook._id.toString(),
      entityName: webhook.name,
      ipAddress: req.ip,
    });

    await webhook.deleteOne();
    res.json({ message: 'Webhook deleted' });
  } catch (error) {
    next(error);
  }
});

// Test webhook
router.post('/:id/test', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthRequest;
    const webhook = await Webhook.findOne({ _id: req.params.id, userId: user!._id });
    if (!webhook) throw new AppError('Webhook not found', 404);

    const fetch = (await import('node-fetch')).default;
    const body = JSON.stringify({
      event: 'webhook.test',
      data: { message: 'This is a test webhook from Mini CRM' },
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      timeout: 10000,
    });

    res.json({ success: response.ok, status: response.status });
  } catch (error) {
    next(error);
  }
});

export default router;
