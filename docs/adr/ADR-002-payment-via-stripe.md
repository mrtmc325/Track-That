# ADR-002: Payment Processing via Stripe (No Card Data on Our Servers)

## Status
Accepted

## Context
Track-That processes payments for multi-store orders. Handling card data directly would require PCI DSS Level 1 compliance — a significant cost and operational burden.

## Decision
Use Stripe as the exclusive payment gateway. Card data is collected via Stripe.js/Elements on the frontend and tokenized by Stripe. Our backend only handles PaymentIntent IDs and never sees raw card numbers.

## Alternatives Considered
1. **Direct card processing:** Full PCI compliance required. Cost and risk too high for initial launch.
2. **PayPal:** Higher transaction fees; less developer-friendly API.
3. **Square:** Good for in-person; less mature for marketplace/split-payment models.

## Consequences
- (+) SAQ-A level PCI compliance (simplest tier)
- (+) Stripe handles fraud detection, 3D Secure, saved cards
- (+) Built-in refund and dispute management
- (-) 2.9% + $0.30 per transaction cost
- (-) Vendor lock-in to Stripe

## Security Impact
No card data touches our servers, logs, or database. Stripe tokens are the only payment artifacts we store.
