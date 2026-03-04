import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { requireAuth } from "./authMiddleware.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { authRoutes } from "./authRoutes.js";
import { serverRoutes } from "./serverRoutes.js";
import { channelRoutes } from "./channelRoutes.js";
import { messageRoutes } from "./messageRoutes.js";
import { friendRoutes } from "./friendRoutes.js";
import { dmRoutes } from "./dmRoutes.js";
import { inviteRoutes } from "./inviteRoutes.js";
import { memberRoutes } from "./memberRoutes.js";
import { fileRoutes } from "./fileRoutes.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { searchRoutes } from "./searchRoutes.js";
import { gameRoutes } from "./gameRoutes.js";
import { noteRoutes } from "./noteRoutes.js";
import { wsHandler } from "./ws.js";

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow configured client URL, localhost variants, and RadminVPN IPs
      const allowed = [
        config.clientUrl,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ];
      if (!origin || allowed.includes(origin) || /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01])|26\.)/.test(origin)) {
        cb(null, true);
      } else {
        cb(null, true); // Allow all in dev — tighten in production
      }
    },
    credentials: true,
  });
  await app.register(websocket);
  await app.register(import("@fastify/multipart"), { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(channelRoutes);
  await app.register(messageRoutes);
  await app.register(friendRoutes);
  await app.register(dmRoutes);
  await app.register(inviteRoutes);
  await app.register(memberRoutes);
  await app.register(fileRoutes);
  await app.register(notificationRoutes);
  await app.register(profileRoutes);
  await app.register(searchRoutes);
  await app.register(gameRoutes);
  await app.register(noteRoutes);
  await app.register(wsHandler);
  app.get("/api/health", async () => ({ status: "ok" }));

  // Activity: recent messages for welcome screen
  app.get("/api/activity/recent", { preHandler: requireAuth as any }, async (req, reply) => {
    const userId = (req as any).userId;
    try {
      const latestDM = await db.dMMessage.findFirst({
        where: { dmChannel: { OR: [{ userAId: userId }, { userBId: userId }] } },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, displayName: true } }, dmChannel: { include: { userA: { select: { id: true, displayName: true } }, userB: { select: { id: true, displayName: true } } } } },
      });
      const myServers = await db.member.findMany({ where: { userId }, select: { serverId: true } });
      const sids = myServers.map((m) => m.serverId);
      const latestMsg = sids.length > 0 ? await db.message.findFirst({
        where: { channel: { serverId: { in: sids }, type: "TEXT" } },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, displayName: true } }, channel: { select: { id: true, name: true, serverId: true, server: { select: { name: true } } } } },
      }) : null;
      reply.send({ latestDM, latestMsg });
    } catch (e: any) {
      reply.status(500).send({ error: e.message });
    }
  });

  // Debug: show active WS connections count
  app.get("/api/debug", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));
  try {
    await db.$connect();
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) { app.log.error(err); process.exit(1); }
}
main();
