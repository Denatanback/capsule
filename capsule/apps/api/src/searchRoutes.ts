import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

export async function searchRoutes(app: FastifyInstance) {


  // Global search across user's servers
  app.get("/api/search", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const query = z.object({
      q: z.string().min(1).max(200),
      type: z.enum(["all", "messages", "files"]).default("all"),
      serverId: z.string().optional(),
      channelId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);

    const { q, type, serverId, channelId, limit } = query;

    // Get user's server IDs for access control
    const memberships = await db.member.findMany({
      where: { userId },
      select: { serverId: true },
    });
    const serverIds = serverId
      ? (memberships.some((m) => m.serverId === serverId) ? [serverId] : [])
      : memberships.map((m) => m.serverId);

    if (serverIds.length === 0 && type !== "files") {
      return rep.send({ messages: [], files: [] });
    }

    // Get channel IDs user has access to
    const channels = await db.channel.findMany({
      where: {
        serverId: { in: serverIds },
        type: "TEXT",
        ...(channelId ? { id: channelId } : {}),
      },
      select: { id: true, name: true, serverId: true },
    });
    const channelIds = channels.map((c) => c.id);
    const channelMap = new Map(channels.map((c) => [c.id, c]));

    let messages: any[] = [];
    let files: any[] = [];

    // Search messages
    if (type === "all" || type === "messages") {
      messages = await db.message.findMany({
        where: {
          channelId: { in: channelIds },
          content: { contains: q, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      // Enrich with channel info
      messages = messages.map((m) => ({
        ...m,
        channel: channelMap.get(m.channelId) || null,
      }));
    }

    // Search files
    if (type === "all" || type === "files") {
      files = await db.fileUpload.findMany({
        where: {
          serverId: { in: serverIds },
          filename: { contains: q, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }

    // Search DM messages
    let dmMessages: any[] = [];
    if (type === "all" || type === "messages") {
      const dmChannels = await db.dMChannel.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { id: true, userAId: true, userBId: true },
      });
      const dmIds = dmChannels.map((d) => d.id);

      if (dmIds.length > 0) {
        dmMessages = await db.dMMessage.findMany({
          where: {
            dmChannelId: { in: dmIds },
            content: { contains: q, mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });
      }
    }

    return rep.send({ messages, dmMessages, files });
  });
}
