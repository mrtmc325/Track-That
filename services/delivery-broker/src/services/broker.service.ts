/**
 * Delivery Broker — selects optimal provider per sub-order.
 * Per Phase 8 spec: weight-based routing decision tree.
 *
 * Weight classes:
 *   < 10 lbs: DoorDash, Uber, USPS
 *   < 30 lbs: DoorDash, Uber
 *   > 30 lbs: Store delivery / specialized courier
 *
 * reliability.timeouts_retries_and_circuit_breakers — provider calls have timeouts
 * operability.observability_by_default — logs all quote/dispatch operations
 */
import type { DeliveryProvider, DeliveryQuote, DispatchResult } from '../providers/provider.interface.js';
import { DoorDashProvider } from '../providers/doordash.provider.js';
import { UberDirectProvider } from '../providers/uber.provider.js';
import { PickupProvider } from '../providers/pickup.provider.js';
import { logger } from '../utils/logger.js';

const providers: DeliveryProvider[] = [
  new DoorDashProvider(),
  new UberDirectProvider(),
  new PickupProvider(),
];

export interface QuoteRequest {
  pickup_address: string;
  delivery_address: string;
  weight_lbs: number;
  distance_miles: number;
  item_category: string;
}

/**
 * Get delivery quotes from all eligible providers.
 * Filters by weight class, returns sorted by fee ascending.
 */
export async function getQuotes(request: QuoteRequest): Promise<DeliveryQuote[]> {
  const startTime = Date.now();
  const quotes: DeliveryQuote[] = [];

  // Get quotes from all providers in parallel
  const results = await Promise.allSettled(
    providers
      .filter(p => p.name !== 'pickup') // Pickup always available, handled separately
      .map(p => p.getQuote(request)),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      quotes.push(result.value);
    } else {
      logger.error('broker.quote_failed', 'Provider quote failed', { error: result.reason?.message });
    }
  }

  // Always add pickup as an option
  quotes.push({
    provider: 'pickup',
    estimated_fee: 0,
    estimated_minutes: 0,
    weight_limit_lbs: Infinity,
    available: true,
  });

  // Sort available quotes by fee ascending
  const sorted = quotes
    .filter(q => q.available)
    .sort((a, b) => a.estimated_fee - b.estimated_fee);

  logger.info('broker.quotes', 'Delivery quotes retrieved', {
    available_count: sorted.length,
    cheapest_fee: sorted[0]?.estimated_fee,
    cheapest_provider: sorted[0]?.provider,
    response_time_ms: Date.now() - startTime,
  });

  return sorted;
}

/**
 * Select the best provider based on weight and cost.
 * Returns the cheapest available provider meeting weight requirements.
 */
export function selectProvider(quotes: DeliveryQuote[], weightLbs: number): DeliveryQuote | null {
  return quotes.find(q => q.available && q.weight_limit_lbs >= weightLbs) || null;
}

/**
 * Dispatch a delivery to the selected provider.
 */
export async function dispatch(
  providerName: string,
  params: { order_id: string; pickup_address: string; delivery_address: string; items: { name: string; quantity: number }[]; weight_lbs: number },
): Promise<DispatchResult | { error: string }> {
  const provider = providers.find(p => p.name === providerName);
  if (!provider) return { error: `Unknown provider: ${providerName}` };

  try {
    const result = await provider.dispatch(params);
    logger.notice('broker.dispatched', 'Delivery dispatched', {
      provider: providerName,
      order_id: params.order_id,
      provider_order_id: result.provider_order_id,
    });
    return result;
  } catch (err) {
    logger.error('broker.dispatch_failed', 'Delivery dispatch failed', {
      provider: providerName,
      order_id: params.order_id,
      error: (err as Error).message,
    });
    return { error: `Dispatch failed: ${(err as Error).message}` };
  }
}
