# Track-That Threat Model

**Stage:** `initial_planning` → `functioning_as_per_design`
**Principle:** `security.threat_model_before_build`
**Last Updated:** 2026-03-23

## Trust Boundaries

| Boundary | From | To | Protocol | Controls |
|----------|------|------|----------|----------|
| Internet → DMZ | User Browser | API Gateway (Traefik) | HTTPS :443 | TLS termination, WAF, rate limiting |
| DMZ → App Network | API Gateway | Microservices | Internal TLS | JWT validation, X-Request-ID |
| App Network → Data | Microservices | PostgreSQL/ES/Redis | Encrypted connection | Per-service DB roles (least privilege) |
| App Network → External | Microservices | Stripe/DoorDash/Uber/OSM | HTTPS | API keys, HMAC webhooks |
| External → App Network | Delivery Providers | Webhook endpoints | HTTPS | HMAC-SHA256, replay protection |

## STRIDE Threat Analysis

### T1: SQL Injection via Search Queries
- **STRIDE:** Tampering
- **Severity:** Critical
- **Attack:** Malicious SQL in search query parameters
- **Mitigations Implemented:**
  - All DB access via parameterized queries (Prisma ORM)
  - Zod schema validation on all API inputs (2-200 char, pattern rejection)
  - Query processor rejects known injection patterns (`UNION SELECT`, `DROP`, etc.)
  - WAF rules at gateway level (Traefik middleware)
- **Test Evidence:** `query-processor.test.ts` — SQL injection patterns rejected

### T2: XSS via Product Names/Descriptions
- **STRIDE:** Tampering
- **Severity:** High
- **Attack:** Injected scripts in scraped product data
- **Mitigations Implemented:**
  - HTML stripping on all scraped content (normalizer.ts)
  - CSP headers: `script-src 'self'` (no inline scripts)
  - React auto-escapes all rendered text
  - Vendor adapter sanitizes all extracted text before storage
- **Test Evidence:** `normalizer.test.ts` — HTML stripping tests

### T3: CSRF on Checkout/Payment
- **STRIDE:** Tampering
- **Severity:** Critical
- **Attack:** Cross-site request forgery on state-changing endpoints
- **Mitigations Implemented:**
  - Double-submit CSRF tokens (csrf.ts middleware)
  - SameSite=Strict cookies on all auth cookies
  - CSP `frame-ancestors 'none'` prevents framing
  - All POST/PATCH/DELETE require CSRF header match
- **Test Evidence:** `csrf.test.ts` — 11 tests covering token validation

### T4: Credential Stuffing on Login
- **STRIDE:** Spoofing
- **Severity:** High
- **Attack:** Automated login attempts with leaked credentials
- **Mitigations Implemented:**
  - Rate limiter: 5 failed attempts per 15-min window per IP+email
  - Account lockout after 10 consecutive failures (30-min cooldown)
  - bcrypt cost=12 (~250ms per hash, slows brute force)
  - Generic error responses (no user enumeration)
- **Test Evidence:** `rate-limit.test.ts` — 6 tests; `auth.service.test.ts` — login tests

### T5: API Scraping Abuse
- **STRIDE:** Denial of Service
- **Severity:** Medium
- **Attack:** Automated scraping of our search/price APIs
- **Mitigations Implemented:**
  - 5-tier rate limiting at gateway (30-300 req/min depending on tier)
  - JWT required for all data endpoints
  - Search endpoint: 60 req/min per user
- **Test Evidence:** Rate limiting configured in Traefik middlewares.yml

### T6: Payment Data Exfiltration
- **STRIDE:** Information Disclosure
- **Severity:** Critical
- **Attack:** Intercept or steal credit card data
- **Mitigations Implemented:**
  - No card data on our servers (SAQ-A compliant)
  - Stripe.js handles all PCI card input in iframe
  - PaymentIntent API: only client_secret passed to frontend
  - No card fields in any database table
- **Test Evidence:** Architecture review — no card_* fields in schema

### T7: Vendor Adapter SSRF
- **STRIDE:** Tampering
- **Severity:** High
- **Attack:** Scraper tricked into accessing internal services
- **Mitigations Implemented:**
  - Domain allowlist for all scrape targets (store-manager.ts)
  - No user-supplied URLs in scraper configuration
  - `isAllowedDomain()` validates URL before fetch
  - robots.txt compliance checker
- **Test Evidence:** `sanitize.ts` — SSRF domain validation tests

### T8: Delivery Webhook Spoofing
- **STRIDE:** Spoofing
- **Severity:** High
- **Attack:** Fake webhook to change delivery status
- **Mitigations Implemented:**
  - HMAC-SHA256 signature verification per provider
  - 5-minute timestamp replay window
  - Event ID deduplication
  - Constant-time signature comparison
- **Test Evidence:** `hmac.test.ts` — 9 tests

### T9: Privilege Escalation via JWT
- **STRIDE:** Elevation of Privilege
- **Severity:** Critical
- **Attack:** Forged or tampered JWT tokens
- **Mitigations Implemented:**
  - RS256 asymmetric signing (HS256 dev fallback only)
  - 15-minute access token lifetime
  - Server-side token validation in requireAuth middleware
  - Refresh token rotation (single-use)
- **Test Evidence:** `auth.service.test.ts` — JWT verification tests

### T10: Sensitive Data in Logs
- **STRIDE:** Information Disclosure
- **Severity:** Medium
- **Attack:** Credentials/PII exposed in log aggregator
- **Mitigations Implemented:**
  - Shared logger with automatic field redaction
  - Sensitive keys: password, token, secret, authorization, cookie, credit_card, cvv, ssn, email
  - Email replaced with SHA-256 hash for correlation
  - Nested object traversal for deep redaction
- **Test Evidence:** `redaction.test.ts` — redaction coverage tests
