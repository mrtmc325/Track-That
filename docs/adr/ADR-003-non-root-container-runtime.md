# ADR-003: Non-Root Container Runtime Identity

## Status
Accepted (Mandatory per PRINCIPLES.md)

## Context
`security.release_runtime_non_root_identity` requires all release-phase processes to run as non-root.

## Decision
All application containers run as user `trackuser` (UID 1000). Dockerfiles create this user and set `USER trackuser` before the entrypoint. Root filesystem is read-only with explicit tmpfs mounts for `/tmp`.

## Implementation
```dockerfile
RUN addgroup --system trackuser && adduser --system --ingroup trackuser trackuser
USER trackuser
```

```yaml
# docker-compose.yml per service
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
```

## CI Enforcement
A CI step inspects all built images and fails if any container's configured user is root or unset.

## Consequences
- (+) Reduced attack surface if container is compromised
- (+) Principle compliance verified automatically
- (-) Some setup tasks (package install) must run as root in build stage only
