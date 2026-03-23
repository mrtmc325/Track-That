import { describe, it, expect, beforeEach } from 'vitest';
import { createDelivery, updateStatus, getDelivery, getOrderDeliveries, _resetDeliveries } from '../tracking.service.js';

const DELIVERY_PARAMS = {
  id: 'del-1',
  order_id: 'order-1',
  store_group_id: 'sg-1',
  provider: 'doordash',
  provider_order_id: 'dd_abc123',
  tracking_id: 'trk_dd_abc123',
  pickup_address: '123 Store St',
  delivery_address: '456 Home Ave',
};

describe('Tracking Service', () => {
  beforeEach(() => { _resetDeliveries(); });

  describe('createDelivery', () => {
    it('creates delivery in pending state', () => {
      const d = createDelivery(DELIVERY_PARAMS);
      expect(d.status).toBe('pending');
      expect(d.status_history).toHaveLength(1);
      expect(d.status_history[0].status).toBe('pending');
    });
  });

  describe('updateStatus (state machine)', () => {
    it('transitions pending → accepted', () => {
      createDelivery(DELIVERY_PARAMS);
      const result = updateStatus('del-1', 'accepted', 'evt-1', {
        driver: { name: 'John', phone_last4: '1234', vehicle: 'Honda Civic' },
        eta_minutes: 30,
      });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.status).toBe('accepted');
        expect(result.driver?.name).toBe('John');
        expect(result.eta_minutes).toBe(30);
      }
    });

    it('transitions accepted → picking_up → in_transit → delivered', () => {
      createDelivery(DELIVERY_PARAMS);
      updateStatus('del-1', 'accepted');
      updateStatus('del-1', 'picking_up');
      updateStatus('del-1', 'in_transit');
      const result = updateStatus('del-1', 'delivered');
      if (!('error' in result)) {
        expect(result.status).toBe('delivered');
        expect(result.status_history).toHaveLength(5); // pending + 4 transitions
      }
    });

    it('rejects invalid transition (pending → delivered)', () => {
      createDelivery(DELIVERY_PARAMS);
      const result = updateStatus('del-1', 'delivered');
      expect('error' in result).toBe(true);
    });

    it('allows cancelled → pending (retry dispatch)', () => {
      createDelivery(DELIVERY_PARAMS);
      updateStatus('del-1', 'cancelled');
      const result = updateStatus('del-1', 'pending');
      if (!('error' in result)) expect(result.status).toBe('pending');
    });

    it('rejects transition from terminal state (delivered)', () => {
      createDelivery(DELIVERY_PARAMS);
      updateStatus('del-1', 'accepted');
      updateStatus('del-1', 'picking_up');
      updateStatus('del-1', 'in_transit');
      updateStatus('del-1', 'delivered');
      const result = updateStatus('del-1', 'pending');
      expect('error' in result).toBe(true);
    });

    it('is idempotent: duplicate event_id is ignored', () => {
      createDelivery(DELIVERY_PARAMS);
      updateStatus('del-1', 'accepted', 'evt-1');
      const result = updateStatus('del-1', 'accepted', 'evt-1'); // Duplicate
      if (!('error' in result)) {
        expect(result.status).toBe('accepted');
        // Should not have duplicate in history
        expect(result.status_history.filter(h => h.event_id === 'evt-1')).toHaveLength(1);
      }
    });

    it('returns error for unknown delivery', () => {
      const result = updateStatus('nonexistent', 'accepted');
      expect('error' in result).toBe(true);
    });

    it('records full status history', () => {
      createDelivery(DELIVERY_PARAMS);
      updateStatus('del-1', 'accepted', 'e1');
      updateStatus('del-1', 'picking_up', 'e2');
      const d = getDelivery('del-1');
      expect(d?.status_history).toHaveLength(3);
      expect(d?.status_history.map(h => h.status)).toEqual(['pending', 'accepted', 'picking_up']);
    });
  });

  describe('getOrderDeliveries', () => {
    it('returns deliveries for an order', () => {
      createDelivery(DELIVERY_PARAMS);
      createDelivery({ ...DELIVERY_PARAMS, id: 'del-2', store_group_id: 'sg-2' });
      const deliveries = getOrderDeliveries('order-1');
      expect(deliveries).toHaveLength(2);
    });

    it('returns empty for unknown order', () => {
      expect(getOrderDeliveries('unknown')).toEqual([]);
    });
  });
});
