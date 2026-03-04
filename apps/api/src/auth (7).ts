import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { extractUserId } from "./authRoutes.js";

const qs = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, rep) => {
    const uid = extractUserId(req); if (!uid) return rep.status(401).send({ error: "Unauthorized" });
    (req as any).userId = uid;
  });

  app.get("/api/channels/:channelId/messages", async (req, rep) => {
    const { channelId } = req.params as { channelId: string };
    const userId = (req as any).userId;
    const p = qs.safeParse(req.query); if (!p.success) return rep.status(400).send({ error: p.error.flatten() });
    const { cursor, limit } = p.data;
    const ch = await db.channel.findUnique({ where: { id: channelId }, select: { serverId: true } });
    if (!ch) return rep.status(404).send({ error: "Channel not found" });
    const mem = await db.member.findUnique({ where: { userId_serverId: { userId, serverId: ch.serverId } } });
    if (!mem) return rep.status(403).send({ error: "Not a member" });
    const msgs = await db.message.findMany({
      where: { channelId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: "desc" }, take: limit,
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
    });
    return rep.send({ messages: msgs.reverse(), hasMore: msgs.length === limit, nextCursor: msgs.length > 0 ? msgs[0].createdAt.toISOString() : null });
  });
}
