import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { db } from "./db.js";
import { authRoutes } from "./authRoutes.js";
import { serverRoutes } from "./serverRoutes.js";
import { channelRoutes } from "./channelRoutes.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.clientUrl,
    credentials: true,
  });

  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(channelRoutes);

  app.get("/api/health", async () => ({ status: "ok", time: new Date().toISOString() }));

  try {
    await db.$connect();
    console.log("Database connected");
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`API running on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
