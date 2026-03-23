#!/usr/bin/env bash
set -euo pipefail
CERT_DIR="gateway/certs"
mkdir -p "$CERT_DIR"
if [ -f "$CERT_DIR/cert.pem" ]; then echo "Certs already exist"; exit 0; fi
openssl req -x509 -newkey rsa:4096 -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
  -days 365 -nodes -subj "/CN=localhost/O=TrackThat Dev"
echo "Generated self-signed dev certificates in $CERT_DIR"
