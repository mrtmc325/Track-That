# Changelog

All notable changes to the Track-That project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
