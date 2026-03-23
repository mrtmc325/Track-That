import { Request, Response } from 'express';
import { quoteSchema, dispatchSchema, webhookPayloadSchema } from '../schemas/delivery.schema.js';
import * as brokerService from '../services/broker.service.js';
import * as trackingService from '../services/tracking.service.js';
import { verifyWebhookSignature } from '../security/hmac.js';
import { logger } from '../utils/logger.js';

export async function getQuotes(req: Request, res: Response): Promise<void> {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const quotes = await brokerService.getQuotes(parsed.data);
  res.json({ success: true, data: { quotes } });
}

export async function dispatchDelivery(req: Request, res: Response): Promise<void> {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const result = await brokerService.dispatch(parsed.data.provider, parsed.data);
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'DISPATCH_FAILED', message: result.error } });
    return;
  }
  res.status(201).json({ success: true, data: result });
}

export async function getDeliveryStatus(req: Request, res: Response): Promise<void> {
  const delivery = trackingService.getDelivery(req.params.id);
  if (!delivery) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Delivery not found' } });
    return;
  }
  res.json({ success: true, data: delivery });
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const provider = req.params.provider;
  const signature = req.headers['x-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  // Verify HMAC signature
  const verification = verifyWebhookSignature(
    provider,
    signature || '',
    rawBody,
    req.body?.timestamp,
    req.body?.event_id,
  );

  if (!verification.valid) {
    logger.warning('webhook.rejected', 'Webhook rejected', { provider, reason: verification.error });
    res.status(401).json({ success: false, error: { code: 'WEBHOOK_REJECTED', message: verification.error } });
    return;
  }

  // Validate payload
  const parsed = webhookPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }

  const { event, delivery_id, driver, eta_minutes, event_id } = parsed.data;

  // Map webhook events to delivery statuses
  const statusMap: Record<string, trackingService.DeliveryStatus> = {
    driver_assigned: 'accepted',
    pickup_complete: 'in_transit',
    delivery_complete: 'delivered',
    delivery_failed: 'failed',
    delivery_cancelled: 'cancelled',
  };

  const newStatus = statusMap[event];
  if (!newStatus) {
    res.status(400).json({ success: false, error: { code: 'UNKNOWN_EVENT', message: `Unknown event: ${event}` } });
    return;
  }

  const result = trackingService.updateStatus(delivery_id, newStatus, event_id, { driver, eta_minutes });
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'STATUS_UPDATE_FAILED', message: result.error } });
    return;
  }

  res.json({ success: true, data: { status: result.status } });
}
