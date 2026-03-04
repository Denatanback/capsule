FROM node:20-bookworm-slim

WORKDIR /app

# Install deps (workspace-aware, uses lockfile)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --workspace @capsule/api --no-audit --no-fund

# Copy source
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Typecheck (non-fatal like before)
RUN cd apps/api && npx tsc --noEmit || true

# Create uploads dir
RUN mkdir -p uploads/avatars uploads/voice

EXPOSE 3001

# Run with prisma db push on start (kept as-is)
CMD sh -c "cd apps/api && npx prisma db push --accept-data-loss && npx tsx src/index.ts"
