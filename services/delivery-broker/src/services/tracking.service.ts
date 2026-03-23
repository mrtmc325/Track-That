/**
 * Delivery Tracking — state machine for delivery lifecycle.
 * Per Phase 8 spec section 8.4.
 *
 * States: pending → accepted → picking_up → in_transit → delivered
 *         pending → cancelled → pending (retry)
 *         in_transit → failed (refund)
 *
 * security.auditability_for_privileged_actions — all status changes logged
 * reliability.idempotent_and_retry_safe_interfaces — webhook processing is idempotent
 */
import { logger } from '../utils/logger.js';

export type DeliveryStatus = 'pending' | 'accepted' | 'picking_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';

export interface DeliveryRecord {
  id: string;
  order_id: string;
  store_group_id: string;
  provider: string;
  provider_order_id: string;
  tracking_id: string;
  status: DeliveryStatus;
  driver?: { name: string; phone_last4: string; vehicle: string };
  eta_minutes?: number;
  pickup_address: string;
  delivery_address: string;
  status_history: { status: DeliveryStatus; timestamp: string; event_id?: string }[];
  created_at: string;
  updated_at: string;
}

const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['picking_up', 'cancelled'],
  picking_up: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'failed'],
  delivered: [],     // Terminal
  cancelled: ['pending'], // Retry dispatch
  failed: [],        // Terminal (refund)
};

// In-memory delivery store
const deliveries = new Map<string, DeliveryRecord>();

/**
 * Create a new delivery record.
 */
export function createDelivery(params: {
  id: string;
  order_id: string;
  store_group_id: string;
  provider: string;
  provider_order_id: string;
  tracking_id: string;
  pickup_address: string;
  delivery_address: string;
}): DeliveryRecord {
  const record: DeliveryRecord = {
    ...params,
    status: 'pending',
    status_history: [{ status: 'pending', timestamp: new Date().toISOString() }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  deliveries.set(params.id, record);
  logger.notice('tracking.created', 'Delivery created', { delivery_id: params.id, order_id: params.order_id, provider: params.provider });
  return record;
}

/**
 * Update delivery status via webhook event.
 * Idempotent: duplicate event_ids are ignored.
 */
export function updateStatus(
  deliveryId: string,
  newStatus: DeliveryStatus,
  eventId?: string,
  metadata?: { driver?: { name: string; phone_last4: string; vehicle: string }; eta_minutes?: number },
): DeliveryRecord | { error: string } {
  const record = deliveries.get(deliveryId);
  if (!record) return { error: 'Delivery not found' };

  // Idempotency: skip if this event was already processed
  if (eventId && record.status_history.some(h => h.event_id === eventId)) {
    logger.debug('tracking.duplicate_event', 'Duplicate webhook event ignored', { delivery_id: deliveryId, event_id: eventId });
    return record;
  }

  const allowed = VALID_TRANSITIONS[record.status];
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot transition from '${record.status}' to '${newStatus}'` };
  }

  const oldStatus = record.status;
  record.status = newStatus;
  record.updated_at = new Date().toISOString();
  record.status_history.push({ status: newStatus, timestamp: record.updated_at, event_id: eventId });

  if (metadata?.driver) record.driver = metadata.driver;
  if (metadata?.eta_minutes !== undefined) record.eta_minutes = metadata.eta_minutes;

  logger.notice('tracking.status_changed', `Delivery ${oldStatus} → ${newStatus}`, {
    delivery_id: deliveryId,
    from: oldStatus,
    to: newStatus,
    provider: record.provider,
  });

  return record;
}

/** Get delivery by ID */
export function getDelivery(id: string): DeliveryRecord | null {
  return deliveries.get(id) || null;
}

/** Get deliveries for an order */
export function getOrderDeliveries(orderId: string): DeliveryRecord[] {
  return Array.from(deliveries.values()).filter(d => d.order_id === orderId);
}

/** Clear (testing) */
export function _resetDeliveries(): void {
  deliveries.clear();
}
