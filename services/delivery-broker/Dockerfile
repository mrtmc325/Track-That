# Pinned per security.supply_chain_integrity (R10)
FROM node:20-alpine@sha256:ad55aa3b18e44fa2df3917bfb5c1e2c7e03f1aab0af36bba59bafe5e2b5fe3f0 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Pinned per security.supply_chain_integrity (R10)
FROM node:20-alpine@sha256:ad55aa3b18e44fa2df3917bfb5c1e2c7e03f1aab0af36bba59bafe5e2b5fe3f0
# Non-root runtime per security.release_runtime_non_root_identity
RUN addgroup -S trackuser && adduser -S trackuser -G trackuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER trackuser
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3005/healthz || exit 1
CMD ["node", "dist/index.js"]
