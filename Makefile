.PHONY: up down build test lint migrate seed certs logs clean verify-non-root

# --- Development ---
up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild:
	docker compose build --no-cache

logs:
	docker compose logs -f

# --- Testing ---
test:
	docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner

lint:
	@for dir in services/*/; do \
		echo "Linting $$dir..."; \
		(cd "$$dir" && npm run lint 2>/dev/null || true); \
	done
	cd frontend && npm run lint 2>/dev/null || true

# --- Database ---
migrate:
	cd database && npx prisma migrate dev

seed:
	cd database && npx ts-node prisma/seed.ts

# --- Security ---
certs:
	./scripts/generate-certs.sh

verify-non-root:
	./scripts/verify-non-root.sh

# --- Cleanup ---
clean:
	docker compose down -v --remove-orphans
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name dist -type d -prune -exec rm -rf {} +

# --- Setup ---
setup:
	./scripts/dev-setup.sh
