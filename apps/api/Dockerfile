FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package.json ./
COPY apps/api/package.json ./apps/api/
RUN cd apps/api && npm install --production=false

# Copy source
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build
RUN cd apps/api && npx tsc --noEmit || true

# Create uploads dir
RUN mkdir -p uploads/avatars uploads/voice

EXPOSE 3001

# Run with prisma migrate on start
CMD sh -c "cd apps/api && npx prisma db push --accept-data-loss && npx tsx src/index.ts"
