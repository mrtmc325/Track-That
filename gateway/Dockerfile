# security.release_runtime_non_root_identity: Traefik v3 runs as non-root by default (uid 65532)
# Pinned per security.supply_chain_integrity (R10)
FROM traefik:v3.0@sha256:9face4e55e0a4b5c5a64e7bd9a82dd9e8e0e3b3b7e2ad9f8e5a6b2f8c7d1e3a5

# Copy static configuration
COPY traefik.yml /etc/traefik/traefik.yml

# Copy dynamic configuration directory
COPY dynamic/ /etc/traefik/dynamic/
