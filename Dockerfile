FROM node:20-bookworm-slim

# Install system dependencies, Chromium, and fonts for Puppeteer PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Copy dependency specifications and Prisma schema first for layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Generate Prisma Client types
RUN npx prisma generate

# Copy source code
COPY . .

# Build Remix Vite SSR & Client bundles
RUN npm run build

EXPOSE 3000

# Concurrently run Remix Web Server + BullMQ Worker Daemon
CMD ["npm", "run", "start:all"]
