# ───────────────────────────────────────────────
# Stage 1: Build
# ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy local package (dataconnect-admin-generated)
COPY src/dataconnect-admin-generated ./src/dataconnect-admin-generated

# Install ALL dependencies (cần devDeps để build TS)
RUN npm ci

# Copy source
COPY . .

# Build NestJS → /app/dist
RUN npm run build

# ───────────────────────────────────────────────
# Stage 2: Production
# ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy local package (dataconnect-admin-generated)
COPY src/dataconnect-admin-generated ./src/dataconnect-admin-generated

# Chỉ cài production deps
RUN npm ci --omit=dev

# Copy build output từ stage 1
COPY --from=builder /app/dist ./dist

# Cloud Run yêu cầu lắng nghe trên PORT env var (mặc định 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Chạy NestJS production build
CMD ["node", "dist/main"]
