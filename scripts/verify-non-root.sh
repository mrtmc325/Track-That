#!/usr/bin/env bash
# CI: Verify all application containers run as non-root
# Per security.release_runtime_non_root_identity
set -euo pipefail
FAIL=0
for img in $(docker compose config --images 2>/dev/null); do
  case "$img" in
    postgres:*|elasticsearch:*|redis:*|traefik:*|nginx:*) continue ;; # infra images exempt
  esac
  USER=$(docker inspect --format='{{.Config.User}}' "$img" 2>/dev/null || echo "")
  if [ -z "$USER" ] || [ "$USER" = "root" ] || [ "$USER" = "0" ]; then
    echo "FAIL: $img runs as root or has no USER set"
    FAIL=1
  else
    echo "PASS: $img runs as $USER"
  fi
done
exit $FAIL
