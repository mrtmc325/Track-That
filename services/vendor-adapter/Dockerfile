FROM node:20-bookworm-slim

# Install Chromium and dependencies for Puppeteer
# per reliability.timeouts_retries_and_circuit_breakers — headless browser for JS-rendered sites
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer-core to use system Chromium (no download)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Non-root user per security.release_runtime_non_root_identity
RUN groupadd -r trackuser && useradd -r -g trackuser -m trackuser

WORKDIR /app
COPY --chown=trackuser:trackuser package*.json ./
RUN npm install
COPY --chown=trackuser:trackuser . .

USER trackuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3007}/healthz || exit 1

CMD ["npx", "tsx", "src/index.ts"]
