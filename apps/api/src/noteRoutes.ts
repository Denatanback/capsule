import { FastifyInstance } from "fastify";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

export async function noteRoutes(app: FastifyInstance) {
  // Get all notes
  app.get("/api/notes", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const notes = await db.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rep.send({ notes });
  });

  // Create note
  app.post("/api/notes", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { content, fileUrl, fileName } = req.body as any;
    if (!content?.trim() && !fileUrl) return rep.status(400).send({ error: "Content required" });
    const note = await db.note.create({
      data: {
        userId,
        content: (content || "").trim(),
        fileUrl: fileUrl || null,
        fileName: fileName || null,
      },
    });
    return rep.status(201).send({ note });
  });

  // Update note
  app.patch("/api/notes/:noteId", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { noteId } = req.params as any;
    const { content } = req.body as any;
    const existing = await db.note.findUnique({ where: { id: noteId } });
    if (!existing || existing.userId !== userId) return rep.status(404).send({ error: "Not found" });
    const note = await db.note.update({
      where: { id: noteId },
      data: { content: (content || "").trim() },
    });
    return rep.send({ note });
  });

  // Delete note
  app.delete("/api/notes/:noteId", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { noteId } = req.params as any;
    const existing = await db.note.findUnique({ where: { id: noteId } });
    if (!existing || existing.userId !== userId) return rep.status(404).send({ error: "Not found" });
    await db.note.delete({ where: { id: noteId } });
    return rep.send({ ok: true });
  });

  // Forward message to notes
  app.post("/api/notes/forward", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { messageId, dmMessageId } = req.body as any;

    let content = "";
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (messageId) {
      const msg = await db.message.findUnique({
        where: { id: messageId },
        include: { author: { select: { displayName: true } }, attachments: true },
      });
      if (!msg) return rep.status(404).send({ error: "Message not found" });
      content = `[Forwarded from ${msg.author.displayName}]\n${msg.content}`;
      if (msg.attachments?.length > 0) {
        fileUrl = msg.attachments[0].url;
        fileName = msg.attachments[0].filename;
      }
    } else if (dmMessageId) {
      const msg = await db.dMMessage.findUnique({
        where: { id: dmMessageId },
        include: { author: { select: { displayName: true } } },
      });
      if (!msg) return rep.status(404).send({ error: "DM not found" });
      content = `[Forwarded from ${msg.author.displayName}]\n${msg.content}`;
    }

    const note = await db.note.create({
      data: { userId, content, fileUrl, fileName },
    });
    return rep.status(201).send({ note });
  });
}
