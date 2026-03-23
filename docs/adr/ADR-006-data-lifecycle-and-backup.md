# ADR-006: Data Lifecycle & Backup Strategy

**Status:** Accepted
**Date:** 2026-03-23
**Context:** Phase 11 — Data Layer & Storage Architecture

## Decision

### Data Lifecycle Tiers

| Tier | Age | Contents | Storage | Action |
|------|-----|----------|---------|--------|
| Hot | < 30 days | Active carts, recent orders, current prices, active coupons | Primary PostgreSQL | Full read/write access |
| Warm | 30-180 days | Completed orders, price history, expired coupons, scrape logs | Partitioned tables | Read-only, reduced indexing |
| Cold | > 180 days | Archived orders, historical analytics, audit logs | Object storage (S3/MinIO) | Compressed, accessed on-demand |

### Partitioning Strategy

- Orders: range-partitioned by `placed_at` month
- Price history: range-partitioned by `recorded_at` month
- Coupons: auto-archived on `valid_until` + 30 days
- Scrape logs: retained 90 days, then compressed to object storage

### Backup Strategy

| Component | Method | RPO | RTO | Retention |
|-----------|--------|-----|-----|-----------|
| PostgreSQL | Continuous WAL archiving + daily base backup | 5 min | 30 min | 30 days (daily), 1 year (weekly) |
| Elasticsearch | Daily snapshots to object storage | 24 hours | 2 hours | 7 days |
| Redis | RDB every 15 min + AOF | 15 min | 5 min | 3 days |

### Encryption at Rest

| Layer | Method | Key Management |
|-------|--------|---------------|
| PostgreSQL volumes | LUKS/dm-crypt on Docker volumes | Host-level key in vault |
| Elasticsearch snapshots | Encrypted at snapshot level | Snapshot key in vault |
| Redis AOF/RDB | Volume-level encryption (LUKS) | Host-level key |
| Sensitive DB fields | AES-256-GCM application-level | FIELD_ENCRYPTION_KEY env var |

## Consequences

- Monthly partition rotation requires a scheduled job (cron or BullMQ)
- Cold storage queries are slower — acceptable for analytics/audit use cases
- WAL archiving requires object storage (S3/MinIO) configured in Docker volume
- AES-256-GCM adds ~0.1ms latency per encrypt/decrypt operation — negligible
