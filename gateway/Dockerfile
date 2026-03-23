# security.release_runtime_non_root_identity: Traefik v3 runs as non-root by default (uid 65532)
FROM traefik:v3.0

# Copy static configuration
COPY traefik.yml /etc/traefik/traefik.yml

# Copy dynamic configuration directory
COPY dynamic/ /etc/traefik/dynamic/
