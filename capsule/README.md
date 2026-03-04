# Capsule - Parts 1+2: Auth + Servers + Channels

## Quick Start
1. `docker compose up -d`
2. `cd apps/api && cp .env.example .env && npm i && npx prisma db push && npm run dev`
3. `cd apps/web && npm i && npm run dev`
4. Open http://localhost:5173

## Part 1 - Auth
- POST /api/auth/register, POST /api/auth/login
- GET /api/auth/google (OAuth), GET /api/auth/me

## Part 2 - Servers + Channels
- POST /api/servers (create), GET /api/servers (list mine)
- GET /api/servers/:id, PATCH, DELETE
- POST /api/servers/:id/join, POST /api/servers/:id/leave
- POST /api/servers/:sid/channels (create)
- GET /api/servers/:sid/channels (list)
- PATCH, DELETE /api/servers/:sid/channels/:cid

## Next: Part 3 - Text Messages (WebSocket)
