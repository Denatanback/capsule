import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
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
import { wsHandler } from "./ws.js";

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.clientUrl, credentials: true });
  await app.register(websocket);
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
  await app.register(wsHandler);
  app.get("/api/health", async () => ({ status: "ok" }));
  try {
    await db.$connect();
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) { app.log.error(err); process.exit(1); }
}
main();
