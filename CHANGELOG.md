# Changelog

All notable changes to the Track-That project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.9.0] - 2026-03-23 — Sprint 9: Geolocation & Map Integration (Phase 6)

### Added
- **Geocoding Service** (services/geo/src/services/geocoding.service.ts)
  - Forward geocode: address → lat/lng (Nominatim abstraction with in-memory mock for dev)
  - Reverse geocode: lat/lng → address with 4-decimal-place coordinate rounding
  - Geohash-keyed distance cache (24h TTL, commutative key normalization)
  - Address hashing for safe logging (SHA-256, never logs raw addresses)

- **Store Proximity Service** (services/geo/src/services/store-proximity.service.ts)
  - `queryNearbyStores()`: radius filter + store type filter + distance sorting + cache-aware
  - `distanceToStore()`: single-store distance lookup
  - In-memory store registry with active/inactive filtering

- **Geo API Routes**
  - `GET /api/v1/geo/stores?lat=&lng=&radius=&type=` — Stores within radius
  - `GET /api/v1/geo/distance?from_lat=&from_lng=&store_id=` — Distance to specific store
  - `POST /api/v1/geo/geocode` — Address to lat/lng
  - `GET /api/v1/geo/reverse?lat=&lng=` — Lat/lng to address

- **Zod Schemas** for all geo endpoints with coordinate bounds and store type enum

### Tests (40 total in geo service, all passing)
- 11 geocoding tests (forward/reverse, mock resolution, caching, coordinate rounding)
- 11 store proximity tests (radius filter, type filter, distance sorting, inactive exclusion)
- 12 distance tests + 6 privacy tests (unchanged from Sprint 4)

## [0.8.0] - 2026-03-23 — Sprint 8: Price Comparison & Deal Analysis (Phase 5)

### Added
- **Price Comparison Service** (services/price-engine/src/services/price-comparison.service.ts)
  - `compareProductPrices()`: full pipeline — staleness filter → coupon application → scoring → ranked results
  - `getBestDeals()`: top N products by deal score across categories, with location filtering
  - `recordPrice()` / `getPriceHistory()`: price history tracking for trend analysis (last 100 entries per pair)
  - In-memory TTL cache (10-min per spec) with cache-key invalidation on price changes
  - Savings calculation: `savings_vs_highest` in best_deal summary

- **Coupon Service** (services/price-engine/src/services/coupon.service.ts)
  - `findApplicableCoupons()`: filter by store, validity dates, product IDs, categories (product filter takes precedence)
  - `bestCouponDiscount()`: picks max(absolute, percentage, BOGO), respects minimum purchase, caps at base price
  - `purgeExpired()`: auto-cleanup of stale coupons
  - Universal coupons (no product/category filter) apply to all products

- **Similar Items Fallback** (services/price-engine/src/services/similar-items.service.ts)
  - 60% query-term overlap for partial name matches
  - Category-based fallback and brand-alternative matching
  - Relevance-scored results sorted by match quality

- **Price API Routes**
  - `GET /api/v1/prices/compare?product_id=&lat=&lng=&radius=` — Multi-store price comparison
  - `GET /api/v1/prices/best-deals?category=&lat=&lng=&limit=` — Top deals in area
  - `GET /api/v1/prices/history/:id` — Price history for trending

- **Zod Schemas** for all price endpoints with coerced numerics and UUID validation

### Tests (64 total in price-engine, all passing)
- 16 coupon tests (applicability, discounts, BOGO, minimum purchase, purge)
- 15 price comparison tests (ranking, coupons, expired exclusion, cache, savings, metadata)
- 8 similar items tests (partial name, category, brand, exclusion, limit)
- 12 scoring tests + 13 staleness tests (unchanged from Sprint 4)

## [0.7.0] - 2026-03-23 — Sprint 7: Vendor Adapter (Phase 4)

### Added
- **Adapter Plugin Interface** (services/vendor-adapter/src/adapters/)
  - `VendorAdapter` interface with `extract()` and `validateConfig()` contract
  - `RawProduct` / `AdapterResult` types for cross-adapter data exchange
  - `CsvAdapter` — parses CSV feeds with quoted-field handling, column mapping, custom delimiters

- **Data Normalizer** (services/vendor-adapter/src/pipeline/normalizer.ts)
  - Product name: strip 15 store-brand prefixes, extract size/weight via regex, title-case output
  - Price: currency symbol stripping, USD rounding to 2dp, anomaly flags (negative, zero, >$10K, unparseable)
  - HTML/control-char sanitization on all text fields, 1000-char limit
  - Confidence scoring for name extraction quality

- **Deduplication Engine** (services/vendor-adapter/src/pipeline/deduplicator.ts)
  - Sørensen–Dice bigram coefficient for fuzzy product name matching
  - Brand bonus (+0.10) and category bonus (+0.05) on similarity score
  - Thresholds: auto-match ≥0.85, human review 0.60-0.85, new product <0.60
  - In-memory catalog with addToCatalog/removeFromCatalog for pipeline integration

- **Store Manager** (services/vendor-adapter/src/pipeline/store-manager.ts)
  - Full onboarding state machine: discovered → adapter_configured → test_scrape → validated → active → paused/inactive
  - Valid transition enforcement (rejects invalid state changes, terminal state for inactive)
  - `registerStore`, `transitionStore`, `configureAdapter`, `recordScrapeSuccess`
  - Store listing with status/type filtering

### Tests (69 new, all passing)
- 24 normalizer tests (name normalization, price normalization, full pipeline)
- 13 deduplicator tests (Dice coefficient, match/review/new thresholds, brand/category bonuses)
- 19 store manager tests (state machine transitions, adapter config, scrape recording, listing/filtering)
- 13 CSV adapter tests (parsing, validation, quoted fields, delimiters, error handling)

## [0.6.0] - 2026-03-23 — Sprint 6: Search Service (Phase 3)

### Added
- **Query Processor** (services/search/src/services/query-processor.ts)
  - Input validation: 2-200 chars, XSS/SQL injection pattern rejection, pure numeric/special char rejection
  - Normalization: lowercase, strip HTML, remove special chars (preserve hyphens/apostrophes), collapse spaces
  - Abbreviation expansion: oz→ounce, lb→pound, org→organic, etc. (16 mappings)
  - Dictionary check: ~400 common English words (grocery/clothing/household), Levenshtein fuzzy match (distance ≤2)
  - Synonym expansion: 22 synonym groups (soda↔pop↔soft drink, zucchini↔courgette, etc.)
  - Full pipeline returns discriminated union: `{ result: ProcessedQuery }` or `{ error }`

- **Search Service** (services/search/src/services/search.service.ts)
  - In-memory product store with Elasticsearch-compatible interface
  - `search()`: full pipeline → score → category filter → radius filter → paginate → similar items fallback
  - `suggest()`: prefix + substring autocomplete (configurable limit)
  - `getProduct()`: single product lookup by ID
  - `getCategories()`: aggregated category list with counts
  - `indexProduct()` / `removeProduct()`: product management for vendor adapter
  - Haversine distance calculation for store proximity
  - Scoring: exact name (100) > name contains (50) > brand (30) > category (20) > description (10)

- **Search API Routes**
  - `GET /api/v1/search?q=&lat=&lng=&radius=&category=&page=` — Full search with Zod validation
  - `GET /api/v1/search/suggest?q=` — Autocomplete
  - `GET /api/v1/products/:id` — Product detail
  - `GET /api/v1/categories` — Category listing

- **Zod Schemas** for all search endpoints with coerced numerics

### Tests (55 new, all passing)
- 34 query processor tests (validation, normalization, dictionary, synonyms, Levenshtein, full pipeline)
- 21 search service tests (search, suggest, getProduct, getCategories, radius filter, pagination, synonyms)

## [0.5.0] - 2026-03-23 — Sprint 5: Auth Phase 2 Completion

### Added
- **Password Reset Flow** — forgot-password + reset-password endpoints
  - Token generation with SHA-256 hash storage (1-hour expiry, single-use)
  - Password reset revokes all existing sessions for security
  - Generic responses to prevent user/email enumeration
- **requireAuth Middleware** — centralized JWT auth enforcement
  - Validates access_token cookie, sets `req.user = { id, email }`
  - Replaces manual token checks in user controllers (DRY principle)
- **CSRF Double-Submit Cookie** — defense-in-depth CSRF protection
  - `setCsrfToken()` on login/register sets JS-readable cookie + header
  - `validateCsrf` middleware enforces header/cookie match on POST/PATCH/DELETE
  - Constant-time comparison via `crypto.timingSafeEqual`
  - Applied to user routes; safe methods (GET/HEAD/OPTIONS) exempt
- **Rate limiting expanded** — register and forgot-password now rate-limited
- **Profile update** — `updateUser()` persists allowed fields, blocks injection of email/password_hash

### Changed
- User controller simplified — delegates auth to middleware, no more manual token checks
- Logout route now requires authentication via requireAuth middleware

### Tests (64 total, all passing)
- 33 auth service tests (+11 new: 6 password reset, 5 updateUser)
- 11 CSRF middleware tests (new)
- 4 requireAuth middleware tests (new)
- 6 rate limiter tests (unchanged)
- 10 schema validation tests (unchanged)

## [0.4.0] - 2026-03-23 — Sprint 4: Auth Service + Core Domain Algorithms

### Added
- **Auth Service** — full implementation (services/auth/)
  - Routes: POST /register, /login, /logout, /refresh + GET/PATCH /users/me
  - bcrypt password hashing (cost factor 12)
  - JWT access tokens (RS256 with HS256 dev fallback, 15-min expiry)
  - Opaque refresh tokens (UUID, SHA-256 hashed, 7-day expiry, single-use rotation)
  - Rate limiter: 5 failed logins per 15-min window per IP+email, lockout after 10
  - Zod validation schemas for all endpoints (email normalization, password strength)
  - Generic error responses to prevent user enumeration
  - HttpOnly + Secure + SameSite=Strict auth cookies

- **Deal Scoring Algorithm** (services/price-engine/)
  - `scoreListings()`: composite score = 45% price + 25% distance + 10% freshness + 10% rating + 10% coupon
  - `calculateEffectivePrice()`: applies max(absolute, percentage) coupon discount
  - Configurable weights, normalized 0-1 scores, sorted results

- **Haversine Distance** (services/geo/)
  - `haversineDistance()`: straight-line distance in miles between coordinates
  - `findStoresWithinRadius()`: filter + sort stores by distance from user
  - `encodeGeohash()`: variable-precision geohash for Redis cache bucketing

### Tests (81 new, all passing)
- Auth service: 38 tests (password hashing, JWT, refresh rotation, registration, login, rate limiting, schemas)
- Price engine: 12 scoring tests + 13 staleness tests
- Geo service: 12 distance tests + 6 privacy tests

## [0.3.0] - 2026-03-22 — Sprint 3 1.7: Risk Mitigations

### Added
- **@track-that/resilience** — new shared library
  - `CircuitBreaker` class (R4/R9): CLOSED→OPEN→HALF_OPEN state machine with configurable thresholds, fallback support, and onStateChange callbacks
  - `retryWithBackoff` (R3): exponential backoff with jitter for payment retries, retryable-error predicate
  - `withFallback` + `withTimeout` (R5/R9): primary/secondary pattern for ES→PG and Redis→DB degradation

- **CSRF middleware** (R7): double-submit cookie pattern with `crypto.timingSafeEqual`, SameSite=Strict cookies
- **Input sanitizer** (R7): strips HTML tags, `javascript:` URIs, `on*=` event handlers from request bodies
- **robots.txt checker** (R2): fetch + parse + 24h cache, `TrackThat-Bot` User-Agent, `Crawl-delay` support
- **Per-domain rate limiter** (R2): enforces 1 req/sec/domain (configurable via Crawl-delay)
- **Price staleness classifier** (R6): FRESH/AGING/STALE/EXPIRED thresholds (4/24/72h), freshness score for deal ranking
- **Geolocation privacy** (R11): coordinate redaction for logs (2 decimal precision), consent-based persistence, session-only default

### Changed
- All 10 Dockerfiles pinned to SHA256 digests (R10: supply chain integrity)
  - `node:20-alpine@sha256:ad55...`, `nginx:alpine@sha256:6564...`, `traefik:v3.0@sha256:9fac...`

### Tests (56 new, all passing)
- Circuit breaker: 11 tests (state transitions, fallback, window pruning)
- Retry: 8 tests (backoff, jitter, retryable predicate)
- Fallback: 7 tests (timeout, both-fail, callback)
- CSRF: 5 tests (cookie set, missing token 403, mismatch 403, valid pass-through)
- Sanitize: 6 tests (HTML strip, XSS patterns, nested objects)
- Staleness: 13 tests (classification boundaries, score, result exclusion)
- Privacy: 6 tests (coordinate redaction, consent, defaults)

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
