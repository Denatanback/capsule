import { FastifyInstance } from "fastify";
import { db } from "./db.js";
import { extractUserId } from "./authRoutes.js";
import { validateUpload, getContentDisposition, MAX_FILE_SIZE } from "./fileSecurity.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.resolve("uploads");

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

export async function fileRoutes(app: FastifyInstance) {
  // Register multipart support
  await app.register(import("@fastify/multipart"), {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  // === UPLOAD ===
  app.post("/api/files/upload", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file provided" });

    const buffer = await data.toBuffer();
    const validation = validateUpload(buffer, data.mimetype, data.filename);

    if (!validation.ok) {
      return reply.status(400).send({ error: validation.error });
    }

    const uuid = crypto.randomUUID();
    const ext = path.extname(validation.filename);
    const storedName = uuid + ext;
    const filePath = path.join(UPLOAD_DIR, storedName);

    await fs.writeFile(filePath, buffer);

    // Parse optional metadata from fields
    const serverId = data.fields?.serverId?.value || null;
    const channelId = data.fields?.channelId?.value || null;
    const messageId = data.fields?.messageId?.value || null;

    const file = await db.fileUpload.create({
      data: {
        uuid,
        filename: validation.filename,
        mime: validation.mime,
        size: buffer.length,
        serverId,
        channelId,
        messageId,
        uploaderId: userId,
      },
    });

    return reply.status(201).send({ file });
  });

  // === DOWNLOAD / VIEW ===
  app.get("/api/files/:uuid", async (request, reply) => {
    const { uuid } = request.params as { uuid: string };

    const file = await db.fileUpload.findUnique({ where: { uuid } });
    if (!file) return reply.status(404).send({ error: "File not found" });

    // Access check: user must be member of server, or file is DM-related
    const userId = extractUserId(request);
    if (file.serverId && userId) {
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: file.serverId } },
      });
      if (!member) return reply.status(403).send({ error: "Access denied" });
    }

    const ext = path.extname(file.filename);
    const filePath = path.join(UPLOAD_DIR, file.uuid + ext);

    try {
      const buffer = await fs.readFile(filePath);
      return reply
        .header("Content-Type", file.mime)
        .header("Content-Disposition", getContentDisposition(file.mime, file.filename))
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "private, max-age=3600")
        .send(buffer);
    } catch {
      return reply.status(404).send({ error: "File not found on disk" });
    }
  });

  // === FILE INFO ===
  app.get("/api/files/:uuid/info", async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const file = await db.fileUpload.findUnique({ where: { uuid } });
    if (!file) return reply.status(404).send({ error: "File not found" });
    return reply.send({ file });
  });

  // === FILE BROWSER: list files for a server ===
  app.get("/api/servers/:serverId/files", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const { serverId } = request.params as { serverId: string };
    const { cursor, type } = request.query as { cursor?: string; type?: string };

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) return reply.status(403).send({ error: "Not a member" });

    const where: any = { serverId };
    if (type === "images") where.mime = { startsWith: "image/" };
    else if (type === "docs") where.mime = { notIn: ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/ogg"] };
    else if (type === "media") where.mime = { startsWith: "video/" };

    const files = await db.fileUpload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return reply.send({
      files,
      hasMore: files.length === 30,
      nextCursor: files.length === 30 ? files[files.length - 1].id : null,
    });
  });

  // === DELETE FILE ===
  app.delete("/api/files/:uuid", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const { uuid } = request.params as { uuid: string };

    const file = await db.fileUpload.findUnique({ where: { uuid } });
    if (!file) return reply.status(404).send({ error: "File not found" });

    // Only uploader or server admin can delete
    if (file.uploaderId !== userId && file.serverId) {
      const member = await db.member.findUnique({
        where: { userId_serverId: { userId, serverId: file.serverId } },
      });
      if (!member || member.role === "MEMBER") {
        return reply.status(403).send({ error: "Not allowed" });
      }
    } else if (file.uploaderId !== userId) {
      return reply.status(403).send({ error: "Not allowed" });
    }

    const ext = path.extname(file.filename);
    const filePath = path.join(UPLOAD_DIR, file.uuid + ext);
    await fs.unlink(filePath).catch(() => {});
    await db.fileUpload.delete({ where: { id: file.id } });

    return reply.send({ ok: true });
  });
}
