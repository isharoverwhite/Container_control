# ==========================================
# Stage 1: Builder (Builds WebUI & installs all deps)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Install Dependencies (Root & WebUI)
COPY package*.json ./
COPY services/webui/package*.json ./services/webui/

# Install ALL dependencies (including devDependencies for build)
RUN npm install
# Install WebUI dependencies
WORKDIR /app/services/webui
RUN npm install

# 2. Copy Source & Build
WORKDIR /app
# Note: .dockerignore ensures node_modules, .env, etc. are not copied
COPY . .

WORKDIR /app/services/webui
# Build Next.js
RUN npm run build

# ==========================================
# Stage 2: Runner (Production Image)
# ==========================================
FROM node:20-alpine AS runner

# Install Runtime Requirements (Docker CLI, OpenSSL)
# openssl: Required for certificate generation
# docker-cli: Required for controlling host docker
RUN apk add --no-cache docker-cli docker-cli-compose openssl

WORKDIR /app

# 1. Install Production Dependencies Only
COPY package*.json ./
COPY services/webui/package*.json ./services/webui/

# Root Prod Deps
RUN npm install --omit=dev

# WebUI Prod Deps
WORKDIR /app/services/webui
RUN npm install --omit=dev

# Return to root
WORKDIR /app

# 2. Copy Source Code
COPY . .

# 3. Copy Built Artifacts from Builder
# Copy Next.js build output
COPY --from=builder /app/services/webui/.next ./services/webui/.next
# Copy static assets
COPY --from=builder /app/services/webui/public ./services/webui/public

# 4. Final Configuration
# 3000: Gateway API
# 8080: Web UI
EXPOSE 3000 8080

CMD ["npm", "start"]
