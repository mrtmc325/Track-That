# Changelog

All notable changes to the Track-That project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-03-22 — Sprint 2 1.4-1.6.3: Contracts, Validation & CI

### Added
- **API Contract Types** (shared/types/src/contracts/)
  - `search.ts` — SearchResponse, SearchQuery, ProductSummary, BestPrice, StoreListing, SuggestResponse
  - `cart.ts` — CartResponse, CartStoreGroup, AddToCartRequest, SetFulfillmentRequest, CheckoutInitiateResponse, OrderSummary
  - `delivery.ts` — DeliveryWebhookPayload, DeliveryQuoteRequest/Response, DeliveryStatusResponse
  - `vendor.ts` — ProductDocument (ES index shape), RawScrapedProduct, NormalizedProduct

- **Zod Validation Schemas** (shared/types/src/validation/)
  - `search.schema.ts` — searchQuerySchema (min 2 chars, max 200, radius cap 50, coercion for query params)
  - `cart.schema.ts` — addToCartSchema (UUID + quantity 1-99), setFulfillmentSchema (delivery requires address, ZIP regex)
  - `delivery.schema.ts` — deliveryWebhookSchema (event enum, ISO timestamp, phone_last4 format)

- **Frontend Contract Types** — `frontend/src/types/contracts.ts` (response-only mirrors, no Zod)

- **CI Pipeline** (.github/workflows/ci.yml) — 13 checks:
  - Merge blockers: lint, format, typecheck, unit tests, integration tests, dependency audit, container scan (Trivy), secret scan (TruffleHog), license check, migration safety, non-root verify, commit message (commitlint)
  - Release blocker: E2E tests (Playwright)

- **Linting & Formatting** — eslint.config.mjs (ESLint 9 flat config), .prettierrc, commitlint.config.cjs

- **Root Workspace** — package.json with npm workspaces (shared/*, services/*, frontend, database)

- **Test Infrastructure** — vitest.config.ts (80% coverage thresholds), database/package.json

- **Unit Tests** (32 passing)
  - shared/logger: 10 tests (severity mapping, redaction, metadata handling)
  - shared/types: 22 tests (AppError, ErrorCodes, Zod schemas for search/cart/delivery)

- **E2E Test Scaffolds** (Playwright, all 10 scenarios with skip markers)
  - auth.spec.ts — registration flow, rate limiting, CSRF protection
  - search.spec.ts — similar items fallback, fuzzy correction, price staleness
  - cart-checkout.spec.ts — multi-store cart, Stripe payment, delivery tracking
  - infrastructure.spec.ts — non-root container verification

### Added
- **TRACK_THAT_PLAN.md**: Comprehensive 15-phase planning document covering:
  - Phase 1: System architecture with microservices topology, domain entity model, Docker Compose layout
  - Phase 2: Authentication flows (JWT + refresh tokens, bcrypt, CSRF protection, rate limiting)
  - Phase 3: Product search pipeline (Elasticsearch, query normalization, fuzzy matching, similar items fallback)
  - Phase 4: Vendor & store integration (scraping adapters, data normalization, deduplication, ethics controls)
  - Phase 5: Price comparison engine (deal scoring algorithm, coupon application, staleness handling)
  - Phase 6: Geolocation & map integration (Leaflet/OSM, Haversine distance, privacy controls)
  - Phase 7: Multi-store cart & checkout (split-cart model, Stripe PaymentIntents, price lock window)
  - Phase 8: Delivery brokering (DoorDash/Uber integration, weight-based routing, webhook handling)
  - Phase 9: Ad & coupon ingestion pipeline (flyer parsing, OCR, coupon extraction, scheduling)
  - Phase 10: Security & observability (threat model, syslog severity 0-7, structured logging, input sanitization)
  - Phase 11: Data layer (PostgreSQL schema, encryption at rest, backup strategy, migration policy)
  - Phase 12: API gateway (Traefik routing, rate limiting tiers, CORS, request ID propagation)
  - Phase 13: Frontend web application (React/Vite/Tailwind, component hierarchy, responsive design, accessibility)
  - Phase 14: Testing strategy (test pyramid, CI/CD pipeline, non-root validation, security scanning)
  - Phase 15: Release & operations (canary deployment, rollback criteria, feature flags, runbooks)
  - End-to-end user journey sequence diagram
  - Prompt turn roadmap for code implementation
- **ADR-001**: Microservices architecture decision
- **ADR-002**: Stripe payment gateway decision
- **ADR-003**: Non-root container runtime decision
- **CHANGELOG.md**: This file

## [0.1.0] - 2026-03-22 — Sprint 1-1.3.3: Project Scaffolding

### Added
- **Infrastructure**
  - `docker-compose.yml` — Full dev orchestration (10 app containers + 3 data stores), all app containers non-root (UID 1000), read-only rootfs, no-new-privileges
  - `docker-compose.test.yml` — CI test runner overlay
  - `gateway/` — Traefik v3 API gateway with TLS, 5-tier rate limiting, CORS, security headers (CSP, HSTS, X-Frame-Options)
  - `.env.example` — Environment template with per-service DB credentials
  - `Makefile` — Common commands (up, down, build, test, lint, migrate, verify-non-root)
  - `scripts/` — dev-setup.sh, generate-certs.sh, verify-non-root.sh

- **Shared Libraries**
  - `shared/logger` — Structured JSON logger enforcing syslog severity 0-7 with PII redaction
  - `shared/types` — API contracts (ApiResponse, PaginatedResponse), inter-service events, AppError class with 9 error codes
  - `shared/middleware` — JWT authentication, X-Request-ID propagation, /healthz + /readyz handlers

- **Backend Services** (8 services, each with Dockerfile, package.json, tsconfig.json, config, logger, Express bootstrap)
  - `services/auth` (:3001) — bcryptjs, jsonwebtoken
  - `services/search` (:3002) — @elastic/elasticsearch
  - `services/price-engine` (:3003) — ioredis
  - `services/cart-checkout` (:3004) — stripe, ioredis
  - `services/delivery-broker` (:3005) — webhook HMAC verification
  - `services/ads-ingestion` (:3006) — cheerio, bullmq, ioredis
  - `services/vendor-adapter` (:3007) — cheerio, bullmq, ioredis
  - `services/geo` (:3008) — ioredis

- **Database**
  - `database/prisma/schema.prisma` — 13 models across 5 PostgreSQL schemas (auth, catalog, commerce, promotions, reviews)
  - `database/prisma/seed.ts` — Dev seed data (2 users, 5 stores, 10 products, 13 listings, 3 coupons)
  - `database/scripts/` — create-schemas.sql, create-roles.sql (per-service least-privilege)

- **Frontend**
  - `frontend/` — React 18 + Vite + Tailwind + TypeScript scaffold
  - Axios client with CSRF + request-ID interceptors
  - Route definitions for 11 pages (lazy-loaded)
  - Nginx config with SPA fallback, security headers, gzip
  - Multi-stage Dockerfile (node build → nginx serve)

### Security
- All application Dockerfiles use `USER trackuser` (UID 1000)
- `read_only: true` and `no-new-privileges:true` on all app containers
- Sensitive field redaction in all loggers (password, token, secret, card, etc.)
- Zod-validated environment config at startup in every service
- CSRF double-submit token pattern in frontend API client
- Per-service PostgreSQL roles with least-privilege grants
