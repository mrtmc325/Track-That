FROM node:20-alpine
RUN addgroup -S trackuser && adduser -S trackuser -G trackuser
WORKDIR /app
COPY --chown=trackuser:trackuser package*.json ./
RUN npm install
COPY --chown=trackuser:trackuser . .
USER trackuser
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/healthz || exit 1
CMD ["npx", "tsx", "src/index.ts"]
