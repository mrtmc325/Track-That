# Changelog

All notable changes to the Track-That project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.0.0] - 2026-03-23 — Sprint 18: Release, Rollout & Operations (Phase 15) — ALL 15 PHASES COMPLETE

### Added
- **Operational Runbooks** (docs/RUNBOOKS.md)
  - 6 runbooks: Service Recovery, Scrape Failure, Payment Outage, Delivery Dispatch Failure, Database Recovery, Cache Failure
  - Each with trigger, severity, numbered steps, escalation path, resolution verification
  - Incident severity classification (Sev 0-4) with response times
  - Canary deployment strategy (5% → 25% → 100%) with health monitoring
  - 5 auto-rollback triggers with decision flowchart
  - Environment strategy (Local, CI, Staging, Production)
  - Container runtime security checklist (10 items)

- **Feature Flags Service** (shared/middleware/src/feature-flags.ts)
  - 6 flags: enable_delivery_uber, enable_delivery_doordash, search_fuzzy_threshold, coupon_confidence_threshold, max_search_radius_miles, enable_payment
  - `isEnabled()`, `getNumber()`, `getString()` with type-safe defaults
  - `setFlag()` with audit logging (actor, old/new value, timestamp)
  - In-memory store (PostgreSQL + Redis cache in production)

- **Production Docker Compose** (docker-compose.prod.yml)
  - All 9 services with hardened security:
    - Non-root user (UID 1000)
    - Read-only root filesystem
    - no-new-privileges, cap_drop ALL
    - tmpfs /tmp with noexec,nosuid
    - CPU/memory limits per service
    - Health checks (wget --spider)
    - restart: unless-stopped

### Tests (13 new, all passing)
- 13 feature flags tests (isEnabled, getNumber, setFlag, getAllFlags, resetFlags, audit)

## [1.7.0] - 2026-03-23 — Sprint 17: CI/CD Pipeline (Phase 14)

### Added
- **Deploy Workflow** (.github/workflows/deploy.yml)
  - Triggered by CI success on main or manual dispatch
  - Matrix build: all 10 images built + pushed to GHCR in parallel
  - Staging canary deployment with smoke tests + health monitoring
  - Production promotion with rolling update strategy (maxUnavailable=0)
  - Manual rollback with version parameter
  - Environment gates: staging + production require approval
  - Audit logging of deployments (actor, version, timestamp)

- **CI Gate Job** — summary job requiring all 12 merge-blocking checks to pass
  - GitHub branch protection should require `ci-gate` status check
  - Reports individual job results and fails if any check is not success/skipped

### Enhanced
- **CI Workflow** (.github/workflows/ci.yml) — already had all 13 checks from Sprint 1
  - Added `ci-gate` aggregation job for clean merge blocking
  - Check mapping per Phase 14 spec:

### CI Check Matrix (13 checks, spec section 14.5)
| # | Check | Tool | Gate | Job Name |
|---|-------|------|------|----------|
| 1 | Lint | ESLint | Merge | `lint` |
| 2 | Format | Prettier | Merge | `format` |
| 3 | Type check | `tsc --noEmit` | Merge | `typecheck` |
| 4 | Unit tests | Vitest | Merge | `unit-tests` |
| 5 | Integration tests | Vitest + TestContainers | Merge | `integration-tests` |
| 6 | Dependency audit | `npm audit --audit-level=high` | Merge | `dependency-audit` |
| 7 | Container scan | Trivy (HIGH/CRITICAL) | Merge | `container-scan` |
| 8 | Secret scan | TruffleHog | Merge | `secret-scan` |
| 9 | License check | license-checker (reject copyleft) | Merge | `license-check` |
| 10 | Migration safety | Prisma validate | Merge | `migration-safety` |
| 11 | Non-root verify | verify-non-root.sh | Merge | `non-root-verify` |
| 12 | Commit message | commitlint | Merge | `commit-message` |
| 13 | E2E tests | Playwright | Release | `e2e-tests` |

## [1.6.0] - 2026-03-23 — Sprint 16: Frontend Web Application (Phase 13)

### Added
- **React SPA** (frontend/src/) — 28 files, fully typed TypeScript + Tailwind CSS
  - **Router**: Nested layout routes (AuthLayout + MainLayout), lazy-loaded pages with code splitting
  - **Zustand Stores**: authStore (user state), cartStore (items/total/count), geoStore (lat/lng/radius)
  - **Layouts**: AuthLayout (centered card), MainLayout (TopNav + Footer + Outlet)
  - **TopNav**: Search form, cart badge with live count, auth-aware user menu
  - **12 Pages**: Login, Register, Home (hero search + categories), Search, Product, Cart, Checkout, Orders, OrderDetail, Profile, Store, 404
  - **Shared Components**: ErrorBoundary (class component), LoadingSpinner (3 sizes), EmptyState, Badge (6 variants)
  - **API Client**: Axios with CSRF double-submit, X-Request-ID injection, 401 redirect, error normalization
  - **Accessibility**: Semantic HTML, ARIA labels on all interactive elements, sr-only labels, role attributes, keyboard navigation, focus-visible outlines
  - **Security (13.7)**: No dangerouslySetInnerHTML, no contenteditable, CSP-compatible, all data rendered as text

### Build Performance (within spec 13.5 budgets)
- Main bundle: 65KB gzipped (budget: <200KB) ✅
- Per-route chunks: 0.3-2.0KB each (budget: <50KB) ✅
- Code splitting via React.lazy on all 12 pages

### Page Architecture
| Route | Page | Auth Required |
|-------|------|--------------|
| `/login` | LoginPage (AuthLayout) | No |
| `/register` | RegisterPage (AuthLayout) | No |
| `/` | HomePage (MainLayout) | No |
| `/search?q=` | SearchPage | No |
| `/products/:id` | ProductPage | No |
| `/cart` | CartPage | Yes |
| `/checkout` | CheckoutPage | Yes |
| `/orders` | OrdersPage | Yes |
| `/orders/:id` | OrderDetailPage | Yes |
| `/profile` | ProfilePage | Yes |
| `/stores/:slug` | StorePage | No |

## [1.5.0] - 2026-03-23 — Sprint 15: API Gateway & Service Mesh (Phase 12)

### Added
- **5-Tier Rate Limiting** (gateway/dynamic/middlewares.yml)
  - Tier 1 Anonymous: 30 req/min per IP (login, register)
  - Tier 2 Authenticated: 120 req/min per user (standard API)
  - Tier 3 Search: 60 req/min per user (prevent scraping)
  - Tier 4 Checkout: 10 req/min per user (payment protection)
  - Tier 5 Webhook: 300 req/min per provider IP (delivery webhooks)

- **Delivery Webhook Router** — separate route at priority 10 with webhook rate limit (no CORS)
- **Health Aggregation Route** — `GET /api/v1/health` at priority 20, no rate limit, no auth
- **Request ID Injection** — `request-id` middleware adds X-Request-ID to all routes

### Changed
- **CORS Origins** — added `https://trackhat.local` and `https://localhost:5173` per spec
- **CSP Header** — updated to match Phase 10 spec exactly (OSM tiles + Stripe API)
- **TLS Config** — added TLS 1.2/1.3 minimum, ECDHE cipher suites only, SNI strict mode
- **Dev Certs** — SAN now includes `trackhat.local`, `*.trackhat.local`, and `127.0.0.1`
- **All routes** now include `request-id` middleware for distributed tracing
- **Price/Delivery/Ads/Geo routers** now use `rate-limit-authenticated` (120/min) instead of no rate limit

### Route → Rate Limit Mapping (per spec 12.2)
| Route | Rate Limit Tier | Limit |
|-------|----------------|-------|
| `/api/v1/auth/*` | anonymous | 30/min |
| `/api/v1/search/*`, `/products/*`, `/categories` | search | 60/min |
| `/api/v1/prices/*` | authenticated | 120/min |
| `/api/v1/cart/*`, `/checkout/*`, `/orders/*` | checkout | 10/min |
| `/api/v1/delivery/webhook/*` | webhook | 300/min |
| `/api/v1/delivery/*` (non-webhook) | authenticated | 120/min |
| `/api/v1/coupons/*`, `/deals/*`, `/flyers/*` | authenticated | 120/min |
| `/api/v1/geo/*` | authenticated | 120/min |
| `/api/v1/health` | none | unlimited |
| `/*` (frontend) | none | unlimited |

## [1.4.0] - 2026-03-23 — Sprint 14: Data Layer & Storage Architecture (Phase 11)

### Added
- **Elasticsearch Index Config** (services/search/src/elasticsearch/indices.ts)
  - `PRODUCTS_INDEX_SETTINGS`: custom `product_analyzer` (stemmer + 13 synonym groups + asciifolding)
  - Full mappings: nested `store_listings` with `geo_point`, completion suggester on `canonical_name`
  - `buildSearchQuery()`: multi-match + geo filter + fuzzy + synonym boosts + pagination (max 50)
  - `buildSuggestQuery()`: completion suggest with fuzziness 1
  - 30-second refresh interval per performance spec

- **AES-256-GCM Encryption** (shared/middleware/src/encryption.ts)
  - `encrypt()` / `decrypt()`: application-level field encryption with random IV
  - `encryptJson()` / `decryptJson()`: JSON object encryption for adapter_config
  - Key from `FIELD_ENCRYPTION_KEY` env var (256-bit, hex-encoded)
  - GCM authenticated encryption (integrity + confidentiality)
  - Tamper detection via auth tag verification

- **ADR-006: Data Lifecycle & Backup** (docs/adr/ADR-006-data-lifecycle-and-backup.md)
  - Three-tier lifecycle: Hot (<30d) → Warm (30-180d) → Cold (>180d)
  - Partitioning strategy for orders, price history, coupons
  - Backup RPO/RTO: PostgreSQL (5m/30m), Elasticsearch (24h/2h), Redis (15m/5m)
  - Encryption at rest: LUKS volumes + AES-256-GCM application-level for sensitive fields

### Pre-existing (verified from Sprint 1)
- Prisma schema: 5 schemas, 12 models, all enums, cross-schema relations
- Per-service DB roles: auth_svc, catalog_svc, commerce_svc, promotions_svc, search_svc
- Seed data: 2 users, 5 stores, 10 products, 13 store_products, 3 coupons

### Tests (28 new, all passing)
- 16 ES index tests (settings, analyzer, mappings, buildSearchQuery, buildSuggestQuery)
- 12 encryption tests (round-trip, random IV, unicode, tamper detection, JSON, adapter_config)

## [1.3.0] - 2026-03-23 — Sprint 13: Observability, Security & Infrastructure (Phase 10)

### Added
- **Security Headers Middleware** (shared/middleware/src/security-headers.ts)
  - CSP: `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, OSM tiles, Stripe API
  - HSTS: 1-year max-age with includeSubDomains
  - X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection: 0
  - Permissions-Policy: geolocation=(self), camera=(), microphone=()
  - Cache-Control: no-store for sensitive responses

- **Threat Detection & Input Sanitization** (shared/middleware/src/sanitize.ts)
  - `detectThreats()`: SQL injection (6 patterns), XSS (7), command injection (3), path traversal (6)
  - `isAllowedDomain()`: SSRF prevention via HTTPS-only domain allowlist
  - `sanitizePath()`: path traversal blocking within allowed base directory
  - `sanitizeForLog()`: control char stripping + length limit for safe log output
  - `sanitizeBody()`: Express middleware for recursive HTML/XSS stripping (backward compat)
  - `stripHtml()`: simple HTML tag removal utility

- **Threat Model Document** (docs/THREAT_MODEL.md)
  - 5 trust boundaries documented (Internet→DMZ→App→Data→External)
  - 10 STRIDE threats (T1-T10) with severity, attack description, mitigations, and test evidence
  - Covers SQL injection, XSS, CSRF, credential stuffing, SSRF, webhook spoofing, JWT escalation, PII in logs

### Enhanced
- **Log Redaction** (shared/logger/src/__tests__/redaction.test.ts)
  - Added 2 new tests: nested object deep traversal + substring key matching
  - Total: 7 redaction tests covering all 10 sensitive field patterns

### Tests (35 new, all passing across shared libs)
- 11 security headers tests (CSP, HSTS, X-Frame, CORS sources, Permissions-Policy)
- 24 threat detection tests (SQL, XSS, cmd injection, path traversal, SSRF, safe inputs)
- 6 sanitizeBody tests (HTML strip, js: removal, nested objects, arrays) — existing
- 7 redaction tests — enhanced from 5

## [1.2.0] - 2026-03-23 — Sprint 12: Ad & Coupon Ingestion Pipeline (Phase 9)

### Added
- **Coupon Extraction** (services/ads-ingestion/src/services/extraction.service.ts)
  - Regex-based extraction: percent, dollar, BOGO, free-item patterns
  - Coupon code detection (CODE_PATTERN), minimum purchase, expiration dates
  - Confidence scoring (0.0-1.0): +0.3 discount, +0.2 code, +0.2 dates, +0.2 description, +0.1 min purchase
  - Multi-block extraction for flyer pages (splits on newlines, `<hr>`, `---`)
  - HTML tag stripping on all input

- **Coupon Validation** (services/ads-ingestion/src/services/validation.service.ts)
  - Expiry rejection (valid_until < now)
  - Deduplication by store_id + code + valid_period
  - Suspicious discount flagging (>80% percent, >$100 absolute)
  - Low confidence (<0.6) → manual review queue
  - Batch validation with status summary counts

- **Coupon Store** (services/ads-ingestion/src/services/coupon-store.service.ts)
  - Store/query active coupons with store/product/category filters
  - Auto-expire past-date coupons
  - Flyer record upsert (store_id + source_url dedup)
  - Today's best deals query

- **Parsers** (services/ads-ingestion/src/parsers/)
  - `json-api.parser.ts`: structured JSON input → CouponExtraction (0.9 confidence)
  - `rss-feed.parser.ts`: feed items → text extraction → coupons (uses pubDate)

- **Ads API Routes** (3 endpoints)
  - `GET /api/v1/coupons?store_id=&product_id=&active=true`
  - `GET /api/v1/deals/today?lat=&lng=&radius=&limit=`
  - `GET /api/v1/flyers/:store_id`

### Tests (37 new, all passing)
- 15 extraction tests (patterns, confidence, HTML strip, metadata, multi-block)
- 10 validation tests (expiry, dedup, suspicious, review queue, batch)
- 7 JSON parser tests (percent, absolute, BOGO, batch, filters)
- 5 RSS parser tests (feed items, pubDate, filtering)

## [1.1.0] - 2026-03-23 — Sprint 11: Delivery Brokering & Fulfillment (Phase 8)

### Added
- **Delivery Provider Adapters** (services/delivery-broker/src/providers/)
  - `DeliveryProvider` interface with `getQuote()` + `dispatch()` contract
  - `DoorDashProvider`: 30lb limit, mock pricing ($3.99 base + $0.50/mi + $0.10/lb)
  - `UberDirectProvider`: 25lb limit, mock pricing ($4.49 base + $0.45/mi + $0.12/lb)
  - `PickupProvider`: no weight limit, zero fee, user-defined timing

- **Broker Service** (services/delivery-broker/src/services/broker.service.ts)
  - Parallel quote fetching via `Promise.allSettled` (circuit-breaker safe)
  - Weight-based provider routing: <10lb all, <30lb DD/Uber, >30lb store/courier
  - `selectProvider()`: cheapest available meeting weight requirement
  - `dispatch()`: delegates to selected provider with error handling

- **Delivery Tracking** (services/delivery-broker/src/services/tracking.service.ts)
  - 7-state machine: pending → accepted → picking_up → in_transit → delivered/failed
  - cancelled → pending retry path
  - Idempotent event processing via event_id deduplication
  - Full status history with timestamps per delivery

- **Webhook Security** (services/delivery-broker/src/security/hmac.ts)
  - HMAC-SHA256 signature verification with constant-time comparison
  - 5-minute replay protection via timestamp freshness check
  - Event ID deduplication (in-memory, Redis in production)
  - Per-provider secret management (env vars, dev fallbacks)

- **Delivery API Routes** (4 endpoints)
  - `POST /api/v1/delivery/quote` — Get quotes from all eligible providers
  - `POST /api/v1/delivery/dispatch` — Dispatch to selected provider
  - `GET /api/v1/delivery/:id/status` — Track delivery status
  - `POST /api/v1/delivery/webhook/:provider` — HMAC-verified inbound webhooks

### Tests (30 new, all passing)
- 10 broker tests (quotes, weight filtering, provider selection, dispatch)
- 11 tracking tests (state machine, idempotency, history, transitions)
- 9 HMAC tests (signature verification, replay protection, timestamp, providers)

## [1.0.0] - 2026-03-23 — Sprint 10: Multi-Store Cart & Checkout (Phase 7)

### Added
- **Cart Service** (services/cart-checkout/src/services/cart.service.ts)
  - Split-cart model with per-store grouping (StoreGroup → CartItem[])
  - 7-state lifecycle machine: empty → active → checkout → payment_pending → processing → ordered/failed
  - Idempotent addItem (increments quantity for duplicate product+store)
  - 15-minute price lock window when entering checkout
  - Fulfillment selection per store group (pickup/delivery with fee)
  - Automatic total/subtotal recalculation with coupon discount support

- **Checkout Service** (services/cart-checkout/src/services/checkout.service.ts)
  - 4-step checkout: initiateCheckout → setFulfillment → processPayment → completeCheckout
  - Price lock validation (409 if expired, resets to active)
  - Mock Stripe PaymentIntent creation (client_secret + intent ID)
  - Order + OrderStoreGroup creation with delivery tracking IDs
  - Idempotent checkout initiation (refreshes price lock if already in checkout)
  - Order history: getUserOrders + getOrder

- **Cart/Checkout/Order API Routes** (10 endpoints)
  - `GET /api/v1/cart` — Get current cart
  - `POST /api/v1/cart/items` — Add item
  - `PATCH /api/v1/cart/items/:id` — Update quantity
  - `DELETE /api/v1/cart/items/:id` — Remove item
  - `POST /api/v1/checkout/initiate` — Start checkout
  - `POST /api/v1/checkout/fulfillment` — Set fulfillment per store group
  - `POST /api/v1/checkout/pay` — Process payment
  - `POST /api/v1/checkout/complete` — Finalize order
  - `GET /api/v1/orders` — Order history
  - `GET /api/v1/orders/:id` — Order detail (ownership verified)

- **Zod Schemas** for all cart/checkout endpoints

### Tests (39 new, all passing)
- 23 cart tests (CRUD, store grouping, state machine, price lock, fulfillment, totals)
- 16 checkout tests (initiation, payment, completion, order creation, idempotency, error paths)

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
