#!/usr/bin/env bash
set -euo pipefail
# One-command dev environment setup
echo "Setting up Track-That development environment..."
# Copy env template
if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from template"; fi
# Generate dev certs
./scripts/generate-certs.sh
# Build all images
docker compose build
# Start data stores first
docker compose up -d postgres elasticsearch redis
echo "Waiting for data stores to be healthy..."
sleep 10
# Run migrations
# cd database && npx prisma migrate dev && cd ..
echo "Setup complete! Run 'make up' to start all services."
