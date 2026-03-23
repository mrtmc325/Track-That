import { Request, Response } from 'express';
import { couponsQuerySchema, todayDealsSchema } from '../schemas/ads.schema.js';
import * as couponStore from '../services/coupon-store.service.js';

export async function getCoupons(req: Request, res: Response): Promise<void> {
  const parsed = couponsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const { store_id, product_id, category, active } = parsed.data;
  const coupons = couponStore.queryCoupons({
    store_id, product_id, category, active_only: active === 'true',
  });
  res.json({ success: true, data: { coupons, total: coupons.length } });
}

export async function getTodayDeals(req: Request, res: Response): Promise<void> {
  const parsed = todayDealsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }
  const deals = couponStore.getTodayDeals(parsed.data.limit);
  res.json({ success: true, data: { deals, total: deals.length } });
}

export async function getFlyer(req: Request, res: Response): Promise<void> {
  const storeId = req.params.store_id;
  if (!storeId) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Store ID required' } });
    return;
  }
  const flyer = couponStore.getCurrentFlyer(storeId);
  if (!flyer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No active flyer for this store' } });
    return;
  }
  res.json({ success: true, data: flyer });
}
