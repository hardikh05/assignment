import crypto from 'crypto';
import fetch from 'node-fetch';
import { Webhook } from '../models/Webhook';

// Fire webhooks for a given event
export async function fireWebhooks(event: string, payload: Record<string, any>) {
  try {
    const webhooks = await Webhook.find({ events: event, active: true });
    if (webhooks.length === 0) return;

    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
        const signature = webhook.secret
          ? crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')
          : undefined;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (signature) headers['X-Webhook-Signature'] = signature;

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          timeout: 10000,
        });

        webhook.lastTriggered = new Date();
        if (!response.ok) {
          webhook.failureCount += 1;
          if (webhook.failureCount >= 10) webhook.active = false;
        } else {
          webhook.failureCount = 0;
        }
        await webhook.save();

        return { webhookId: webhook._id, status: response.status };
      })
    );

    return results;
  } catch (error) {
    console.error('Error firing webhooks:', error);
  }
}
