import { Request, Response } from 'express';
import { addItemSchema, updateQuantitySchema, setFulfillmentSchema, completeCheckoutSchema } from '../schemas/cart.schema.js';
import * as cartService from '../services/cart.service.js';
import * as checkoutService from '../services/checkout.service.js';

/** Simulated user ID extraction (requireAuth middleware sets req.user in production) */
function getUserId(req: Request): string {
  return (req as any).user?.id || req.headers['x-user-id'] as string || 'anonymous';
}

export async function getCart(req: Request, res: Response): Promise<void> {
  const cart = cartService.getOrCreateCart(getUserId(req));
  res.json({ success: true, data: cart });
}

export async function addItem(req: Request, res: Response): Promise<void> {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const result = cartService.addItem(getUserId(req), parsed.data);
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'CART_ERROR', message: result.error } });
    return;
  }
  res.status(201).json({ success: true, data: result });
}

export async function updateQuantity(req: Request, res: Response): Promise<void> {
  const parsed = updateQuantitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const result = cartService.updateItemQuantity(getUserId(req), req.params.id, parsed.data.quantity);
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'CART_ERROR', message: result.error } });
    return;
  }
  res.json({ success: true, data: result });
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  const result = cartService.removeItem(getUserId(req), req.params.id);
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'CART_ERROR', message: result.error } });
    return;
  }
  res.json({ success: true, data: result });
}

export async function initiateCheckout(req: Request, res: Response): Promise<void> {
  const result = checkoutService.initiateCheckout(getUserId(req));
  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }
  res.json({ success: true, data: result });
}

export async function setFulfillment(req: Request, res: Response): Promise<void> {
  const parsed = setFulfillmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const cart = cartService.getOrCreateCart(getUserId(req));
  const result = cartService.setFulfillment(cart.id, parsed.data.store_id, parsed.data.fulfillment, parsed.data.delivery_fee);
  if ('error' in result) {
    res.status(400).json({ success: false, error: { code: 'CART_ERROR', message: result.error } });
    return;
  }
  res.json({ success: true, data: result });
}

export async function processPayment(req: Request, res: Response): Promise<void> {
  const cart = cartService.getOrCreateCart(getUserId(req));
  const result = checkoutService.processPayment(cart.id);
  if ('error' in result) {
    const status = result.error.code === 'PRICE_LOCK_EXPIRED' ? 409 : 400;
    res.status(status).json({ success: false, error: result.error });
    return;
  }
  res.json({ success: true, data: result });
}

export async function completeCheckout(req: Request, res: Response): Promise<void> {
  const parsed = completeCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const cart = cartService.getOrCreateCart(getUserId(req));
  const result = checkoutService.completeCheckout(cart.id, parsed.data.payment_intent_id);
  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }
  res.status(201).json({ success: true, data: result });
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  const orders = checkoutService.getUserOrders(getUserId(req));
  res.json({ success: true, data: { orders, total: orders.length } });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const order = checkoutService.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    return;
  }
  // Verify ownership
  if (order.user_id !== getUserId(req)) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    return;
  }
  res.json({ success: true, data: order });
}
