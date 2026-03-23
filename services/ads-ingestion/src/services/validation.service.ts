/**
 * Coupon Validation Service
 * Per Phase 9 spec section 9.5:
 * - Reject expired coupons
 * - Flag suspiciously high discounts (>80%) for review
 * - Deduplicate by store_id + code + valid_period
 * - Confidence < 0.6 → manual review queue
 *
 * security.validate_all_untrusted_input — all coupon data validated before storage
 * quality.inline_documentation_for_non_obvious_logic — validation rules documented
 */
import type { CouponExtraction } from './extraction.service.js';
import { logger } from '../utils/logger.js';

export type ValidationStatus = 'valid' | 'expired' | 'duplicate' | 'needs_review' | 'suspicious';

export interface ValidationResult {
  status: ValidationStatus;
  coupon: CouponExtraction;
  reasons: string[];
}

// Deduplication set: store_id:code:valid_period
const seenCoupons = new Set<string>();

// Review queue
const reviewQueue: { coupon: CouponExtraction; reasons: string[] }[] = [];

/**
 * Validate a coupon extraction against all rules.
 * Returns validation status and any issues found.
 */
export function validateCoupon(coupon: CouponExtraction): ValidationResult {
  const reasons: string[] = [];
  const now = new Date();

  // Rule 1: Reject expired coupons
  if (coupon.valid_until < now) {
    logger.debug('validation.expired', 'Coupon rejected: expired', {
      store_id: coupon.store_id,
      valid_until: coupon.valid_until.toISOString(),
    });
    return { status: 'expired', coupon, reasons: ['Coupon has expired'] };
  }

  // Rule 2: Deduplicate by store_id + code + valid_period
  const dedupKey = buildDedupKey(coupon);
  if (seenCoupons.has(dedupKey)) {
    return { status: 'duplicate', coupon, reasons: ['Duplicate coupon'] };
  }

  // Rule 3: Flag suspiciously high discounts (>80%)
  if (coupon.discount_type === 'percent' && coupon.discount_value > 80) {
    reasons.push('Suspiciously high percentage discount (>80%)');
  }
  if (coupon.discount_type === 'absolute' && coupon.discount_value > 100) {
    reasons.push('Suspiciously high absolute discount (>$100)');
  }

  // Rule 4: Confidence score < 0.6 → manual review
  if (coupon.confidence_score < 0.6) {
    reasons.push(`Low confidence score: ${coupon.confidence_score}`);
  }

  // If any suspicious flags, send to review
  if (reasons.length > 0) {
    reviewQueue.push({ coupon, reasons });
    logger.info('validation.review', 'Coupon sent to review queue', {
      store_id: coupon.store_id,
      code: coupon.code,
      reasons,
      confidence: coupon.confidence_score,
    });
    return { status: reasons.some(r => r.includes('Suspiciously')) ? 'suspicious' : 'needs_review', coupon, reasons };
  }

  // Valid — mark as seen for dedup
  seenCoupons.add(dedupKey);

  logger.debug('validation.valid', 'Coupon validated', {
    store_id: coupon.store_id,
    code: coupon.code,
    discount: `${coupon.discount_type}:${coupon.discount_value}`,
  });

  return { status: 'valid', coupon, reasons: [] };
}

/**
 * Validate a batch of coupons. Returns counts by status.
 */
export function validateBatch(coupons: CouponExtraction[]): {
  results: ValidationResult[];
  summary: Record<ValidationStatus, number>;
} {
  const results = coupons.map(c => validateCoupon(c));
  const summary: Record<ValidationStatus, number> = {
    valid: 0, expired: 0, duplicate: 0, needs_review: 0, suspicious: 0,
  };
  for (const r of results) {
    summary[r.status]++;
  }

  logger.info('validation.batch', 'Batch validation complete', { summary });
  return { results, summary };
}

/** Build deduplication key: store_id:code:YYYY-MM */
function buildDedupKey(coupon: CouponExtraction): string {
  const code = coupon.code || 'no_code';
  const period = `${coupon.valid_from.getFullYear()}-${String(coupon.valid_from.getMonth() + 1).padStart(2, '0')}`;
  return `${coupon.store_id}:${code}:${period}`;
}

/** Get review queue items */
export function getReviewQueue(): { coupon: CouponExtraction; reasons: string[] }[] {
  return [...reviewQueue];
}

/** Clear review queue (testing/admin) */
export function clearReviewQueue(): number {
  const count = reviewQueue.length;
  reviewQueue.length = 0;
  return count;
}

/** Clear dedup set (testing) */
export function _resetValidation(): void {
  seenCoupons.clear();
  reviewQueue.length = 0;
}
