# ADR-001: Microservices Architecture with Docker

## Status
Accepted

## Context
Track-That needs to aggregate product data from many vendors, run search/pricing engines, manage multi-store carts, and broker deliveries. These are independent concerns with different scaling profiles and failure domains.

## Decision
Adopt a microservices architecture with 8 independently deployable services, all containerized with Docker.

## Alternatives Considered
1. **Monolith:** Simpler to start, but vendor scraping load would impact checkout availability. Rejected due to blast radius concerns.
2. **Modular monolith:** Good middle ground, but delivery brokering and scraping have fundamentally different runtime needs (long-running jobs vs. request/response). Rejected.

## Consequences
- (+) Independent scaling of search vs. checkout vs. scraping
- (+) Fault isolation: scraper failures don't impact checkout
- (+) Technology flexibility per service
- (-) Operational complexity (service discovery, distributed tracing)
- (-) Data consistency requires careful event/saga patterns
- Mitigated by: Docker Compose for dev simplicity; structured logging with request ID propagation

## Security Impact
Each service runs with least-privilege DB access. No service has access to another service's data tables directly.

## Rollback
If complexity proves too high during early development, services can be merged into a modular monolith while keeping the same API contracts.
