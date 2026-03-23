import { Request, Response } from 'express';
import { nearbyStoresSchema, distanceSchema, geocodeSchema, reverseGeocodeSchema } from '../schemas/geo.schema.js';
import * as proximityService from '../services/store-proximity.service.js';
import * as geocodingService from '../services/geocoding.service.js';

export async function nearbyStores(req: Request, res: Response): Promise<void> {
  const parsed = nearbyStoresSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query' },
    });
    return;
  }

  const { lat, lng, radius, type } = parsed.data;
  const stores = proximityService.queryNearbyStores(lat, lng, radius, type);
  res.json({ success: true, data: { stores, total: stores.length } });
}

export async function distanceToStore(req: Request, res: Response): Promise<void> {
  const parsed = distanceSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query' },
    });
    return;
  }

  const { from_lat, from_lng, store_id } = parsed.data;
  const result = proximityService.distanceToStore(from_lat, from_lng, store_id);

  if (!result) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } });
    return;
  }

  res.json({ success: true, data: result });
}

export async function geocodeAddress(req: Request, res: Response): Promise<void> {
  const parsed = geocodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid address' },
    });
    return;
  }

  const result = await geocodingService.geocode(parsed.data.address);
  if (!result) {
    res.status(404).json({
      success: false,
      error: { code: 'GEOCODE_FAILED', message: 'Could not resolve address to coordinates' },
    });
    return;
  }

  res.json({ success: true, data: result });
}

export async function reverseGeocode(req: Request, res: Response): Promise<void> {
  const parsed = reverseGeocodeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid coordinates' },
    });
    return;
  }

  const result = await geocodingService.reverseGeocode(parsed.data.lat, parsed.data.lng);
  if (!result) {
    res.status(404).json({
      success: false,
      error: { code: 'REVERSE_FAILED', message: 'Could not resolve coordinates to address' },
    });
    return;
  }

  res.json({ success: true, data: result });
}
