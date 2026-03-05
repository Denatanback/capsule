import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function profileRoutes(app: FastifyInstance) {

  // Update profile
  app.patch("/api/profile", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({
      displayName: z.string().min(1).max(64).optional(),
      aboutMe: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional().nullable(),
    }).parse(req.body);

    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.aboutMe !== undefined ? { aboutMe: body.aboutMe } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      },
    });

    return rep.send({ user: sanitize(user) });
  });

  // Get profile (own or others)
  app.get("/api/profile/:userId", { preHandler: requireAuth }, async (req, rep) => {
    const { userId } = req.params as { userId: string };
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return rep.status(404).send({ error: "User not found" });
    return rep.send({ user: sanitize(user) });
  });

  // Block a user
  app.post("/api/blocks/:targetId", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const { targetId } = req.params as { targetId: string };
    if (userId === targetId) return rep.status(400).send({ error: "Cannot block yourself" });

    await db.block.upsert({
      where: { userId_blockedId: { userId, blockedId: targetId } },
      create: { userId, blockedId: targetId },
      update: {},
    });
    return rep.send({ ok: true });
  });

  // Unblock
  app.delete("/api/blocks/:targetId", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const { targetId } = req.params as { targetId: string };

    await db.block.delete({
      where: { userId_blockedId: { userId, blockedId: targetId } },
    }).catch(() => {});
    return rep.send({ ok: true });
  });

  // List blocked users
  app.get("/api/blocks", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const blocks = await db.block.findMany({ where: { userId } });
    const userIds = blocks.map((b) => b.blockedId);
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    return rep.send({ blocked: users });
  });

  // === AVATAR UPLOAD ===
  app.post("/api/profile/avatar", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const data = await (request as any).file();
    if (!data) return reply.status(400).send({ error: "No file" });
    const buffer = await data.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) return reply.status(400).send({ error: "Max 5MB" });
    if (!data.mimetype?.startsWith("image/")) return reply.status(400).send({ error: "Images only" });
    const ext = data.filename?.match(/\.\w+$/)?.[0] || ".jpg";
    const dir = path.resolve("uploads/avatars");
    await fs.mkdir(dir, { recursive: true });

    const prev = await db.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (prev?.avatarUrl?.startsWith("/api/avatars/")) {
      const prevName = prev.avatarUrl.split("/api/avatars/")[1]?.split("?")[0];
      if (prevName) {
        await fs.unlink(path.join(dir, prevName)).catch(() => {});
      }
    }

    const filename = `avatar_${userId}_${Date.now()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);
    const avatarUrl = `/api/avatars/${filename}`;
    await db.user.update({ where: { id: userId }, data: { avatarUrl } });
    reply.send({ avatarUrl });
  });

  // === SERVE AVATARS ===
  app.get("/api/avatars/:filename", async (request, reply) => {
    const { filename } = request.params as any;
    const filePath = path.join(path.resolve("uploads/avatars"), filename);
    try {
      const buf = await fs.readFile(filePath);
      const ext = filename.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
      reply.header("Cache-Control", "no-store");
      reply.type(mime).send(buf);
    } catch { reply.status(404).send({ error: "Not found" }); }
  });

  // === VOICE MESSAGE UPLOAD ===
  app.post("/api/voice-upload", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const data = await (request as any).file();
    if (!data) return reply.status(400).send({ error: "No file" });
    const buffer = await data.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) return reply.status(400).send({ error: "Max 10MB" });
    const uuid = crypto.randomUUID();
    const dir = path.resolve("uploads/voice");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, uuid + ".webm"), buffer);
    reply.send({ voiceUrl: `/api/voice/${uuid}.webm` });
  });

  // === SERVE VOICE FILES ===
  app.get("/api/voice/:filename", async (request, reply) => {
    const { filename } = request.params as any;
    const filePath = path.join(path.resolve("uploads/voice"), filename);
    try {
      const buf = await fs.readFile(filePath);
      reply.type("audio/webm").send(buf);
    } catch { reply.status(404).send({ error: "Not found" }); }
  });
}

function sanitize(user: any) {
  return {
    id: user.id, email: user.email, username: user.username,
    displayName: user.displayName, avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe, status: user.status, createdAt: user.createdAt,
  };
}
