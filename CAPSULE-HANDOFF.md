# Capsule — Project Handoff Document

## What is Capsule?

A Discord/Slack-like messenger with planned city-builder game integration. Currently a fully functional MVP messenger with voice channels, DMs, and friend system.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State Management | Zustand (multiple stores) |
| Backend | Node.js + Fastify 5 |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma 6 |
| Auth | JWT (email/password + Google OAuth scaffolding) |
| Real-time | Native WebSocket (@fastify/websocket) |
| Voice | WebRTC with custom relay topology |

## Project Structure (50 files, ~2800 LoC)

```
capsule/
├── docker-compose.yml          # PostgreSQL 16
├── package.json                # Root monorepo config
├── apps/
│   ├── api/                    # Backend (Fastify)
│   │   ├── prisma/schema.prisma  # Full DB schema
│   │   └── src/
│   │       ├── index.ts        # App entrypoint, plugin registration
│   │       ├── config.ts       # Env config (PORT, JWT_SECRET, etc.)
│   │       ├── db.ts           # Prisma client singleton
│   │       ├── auth.ts         # hashPassword, verifyPassword, signToken, verifyToken
│   │       ├── authRoutes.ts   # POST /auth/register, /auth/login, GET /auth/me
│   │       ├── serverRoutes.ts # CRUD servers + join/leave
│   │       ├── channelRoutes.ts# CRUD channels (TEXT + VOICE types)
│   │       ├── messageRoutes.ts# GET channel messages (cursor pagination)
│   │       ├── friendRoutes.ts # Friend request/accept/decline/remove
│   │       ├── dmRoutes.ts     # DM channel open/list, DM messages
│   │       ├── ws.ts           # WebSocket handler (messages, typing, presence, voice signaling, DM)
│   │       └── topology.ts     # Voice relay topology engine (star/MST)
│   └── web/                    # Frontend (React + Vite)
│       └── src/
│           ├── App.tsx         # Router (Login, Register, Home, AuthCallback)
│           ├── main.tsx        # Entry point
│           ├── lib/
│           │   ├── api.ts      # REST client (all endpoints)
│           │   └── ws.ts       # WebSocket client singleton with reconnect
│           ├── stores/
│           │   ├── authStore.ts    # User auth state, JWT
│           │   ├── serverStore.ts  # Servers, channels, active selection
│           │   ├── messageStore.ts # Channel messages (per-channel cache)
│           │   ├── presenceStore.ts# Online users, typing indicators
│           │   ├── friendStore.ts  # Friends list, requests
│           │   ├── dmStore.ts      # DM channels, DM messages
│           │   ├── voiceStore.ts   # WebRTC peers, relay logic, latency
│           │   └── themeStore.ts   # Dark/light toggle
│           ├── components/
│           │   ├── ServerSidebar.tsx  # Left icon bar (servers + DM button)
│           │   ├── ChannelList.tsx    # Text + Voice channels, create/delete
│           │   ├── ChatArea.tsx       # Message list, send/edit/delete, typing
│           │   ├── MemberList.tsx     # Right sidebar, online/offline dots
│           │   ├── VoicePanel.tsx     # Voice controls (mute, disconnect, latency)
│           │   ├── FriendsView.tsx    # Friends tabs (All/Online/Pending/Add)
│           │   ├── DMList.tsx         # DM conversations sidebar
│           │   └── DMChat.tsx         # DM message area
│           └── pages/
│               ├── Home.tsx       # Main layout (server view / DM view)
│               ├── Login.tsx      # Login form
│               ├── Register.tsx   # Registration form
│               └── AuthCallback.tsx # OAuth callback handler
```

## Database Schema (Prisma)

### Models:
- **User** — email, username, displayName, passwordHash, avatarUrl, status (ONLINE/IDLE/DND/OFFLINE), lastSeenAt
- **Account** — OAuth provider accounts (Google, etc.)
- **Server** — name, iconUrl, ownerId
- **Channel** — name, type (TEXT/VOICE), serverId, position
- **Member** — role (OWNER/ADMIN/MEMBER), userId, serverId
- **Message** — content, channelId, authorId, editedAt
- **Friendship** — fromId, toId, status (PENDING/ACCEPTED/DECLINED)
- **DMChannel** — userAId, userBId (sorted pair for uniqueness)
- **DMMessage** — content, dmChannelId, authorId, editedAt

## Implemented Features (Parts 1-6)

### Part 1 — Auth System
- Email/password registration and login
- JWT tokens (stored in localStorage)
- Google OAuth scaffolding (AuthCallback page)
- Dark/light theme toggle persisted in localStorage
- Protected routes

### Part 2 — Servers & Channels
- Create/delete servers
- Join/leave servers by ID
- Create/delete text and voice channels (admin/owner only)
- Role-based permissions (OWNER > ADMIN > MEMBER)
- Three-column Discord-style layout

### Part 3 — Real-time Messaging
- WebSocket connection with auto-reconnect
- Send/edit/delete messages in channels
- Cursor-based pagination for message history
- Auto-scroll to new messages
- Edited message indicators
- Broadcast to all channel subscribers

### Part 4 — Presence & Typing
- Online/offline status tracking via WebSocket
- Green/gray dots on member list
- Typing indicators ("Someone is typing...")
- Auto-clear typing after 3 seconds
- Status persisted to DB (lastSeenAt)
- Manual status set (ONLINE/IDLE/DND/OFFLINE)

### Part 5 — Voice Channels (WebRTC)
- Voice channels with join/leave
- Microphone access and mute/unmute
- WebRTC peer connections with STUN
- **Custom relay topology engine:**
  - 2 users → direct P2P
  - 3-6 users → Star topology (best-latency user = relay hub)
  - 7+ users → Minimum Spanning Tree (Kruskal's), multi-relay
  - DataChannel ping/pong for RTT measurement
  - Server collects latency matrix, recomputes topology
  - Automatic re-election when relay node disconnects
  - Relay nodes forward audio streams to other peers
- Latency display per peer (color-coded: green/yellow/red)

### Part 6 — DM & Friends
- Friend requests by username
- Accept/decline/remove friends
- Friends list with tabs: All, Online, Pending, Add Friend
- DM channels (created on first message, requires friendship)
- Real-time DM messaging via WebSocket (send/edit/delete)
- DM sidebar with conversation list and online indicators
- View switching: Server mode ↔ DM mode

## WebSocket Events Reference

### Channel Messages
- `message:send` → `message:new`
- `message:edit` → `message:edited`
- `message:delete` → `message:deleted`

### DM Messages
- `dm:send` → `dm:new`
- `dm:edit` → `dm:edited`
- `dm:delete` → `dm:deleted`

### Presence
- `auth` → `auth:ok` (includes onlineUsers array)
- `presence` (broadcast on status change)
- `status:set` (manual status)

### Typing
- `typing:start` / `typing:stop` → `typing:update`

### Voice
- `voice:join` → `voice:joined` (to joiner) + `voice:user-joined` (to others)
- `voice:leave` → `voice:left` + `voice:user-left`
- `voice:offer` / `voice:answer` / `voice:ice-candidate` (WebRTC signaling)
- `voice:latency` (RTT reports)
- `voice:topology` (server → clients, computed relay tree)
- `voice:measure-latency` (server requests measurement)
- `voice:users` (broadcast current voice room participants)

## How to Run

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend (Terminal 1)
cd apps/api
cp .env.example .env
npm install
npx prisma db push
npm run dev
# → http://localhost:3001

# 3. Frontend (Terminal 2)
cd apps/web
npm install
npm run dev
# → http://localhost:5173
```

### .env.example
```
DATABASE_URL=postgresql://capsule:capsule@localhost:5432/capsule
JWT_SECRET=capsule-dev-secret-change-in-prod
PORT=3001
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Planned Roadmap (Not Yet Implemented)

### Stage 3 — Game Slot Prep
- iframe/embed zone inside servers for mini-games
- Game state sync via WebSocket
- Server-level game settings

### Stage 4 — City Builder Game v0
- Grid-based map with buildings
- Resource management
- Multiplayer via server channels

### Stage 5 — Monetization
- Premium features
- Cosmetics/skins
- Server boosting

## Known Issues / Shortcuts

1. **No file uploads** — messages are text-only, no images/attachments
2. **No emoji picker** — plain text only, no markdown rendering
3. **No invite links** — joining servers requires knowing the server ID
4. **No notification system** — no push notifications, no unread counts
5. **Google OAuth not wired** — callback page exists but env vars need real credentials
6. **No rate limiting** — API endpoints have no throttling
7. **No input sanitization** — XSS protection not implemented (Zod validates shape only)
8. **Voice TURN server** — only STUN configured, NAT-heavy networks may fail
9. **TypeScript is loose** — many `any` types in Zustand stores and components
10. **No tests** — no unit or integration tests exist
11. **Monorepo not using Turborepo** — package.json references it but turbo.json is absent
12. **ESM mode** — `"type": "module"` in api/package.json, all imports use `.js` extensions

## Architecture Notes for Continuation

- **All state is in Zustand stores** — no React Context, no Redux
- **WebSocket is a singleton** in `lib/ws.ts` with event subscription pattern: `on(event, callback)` returns cleanup function
- **REST API client** is in `lib/api.ts` — simple fetch wrapper with JWT auto-injection
- **Vite proxies** `/api` → `localhost:3001` and `/ws` → `localhost:3001` (see vite.config.ts)
- **Voice topology** recomputes on every join/leave when 3+ users; clients receive their role and connection targets
- **DM channels** use sorted user ID pair for uniqueness constraint
- **Prisma** is the single source of truth for DB schema — run `npx prisma db push` after schema changes
