# Pinned per security.supply_chain_integrity (R10)
FROM node:20-alpine@sha256:ad55aa3b18e44fa2df3917bfb5c1e2c7e03f1aab0af36bba59bafe5e2b5fe3f0 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Pinned per security.supply_chain_integrity (R10)
FROM nginx:alpine@sha256:65645de16a55aeb399e8a498330b2db62b1007eb8dbfa52e75c8b9b22479e75c
# Non-root: nginx alpine runs master as root but worker as nginx user
# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
