import { FastifyInstance } from "fastify";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

export async function notificationRoutes(app: FastifyInstance) {


  // Mark channel as read
  app.post("/api/channels/:channelId/read", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { channelId } = req.params as { channelId: string };

    await db.lastRead.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return rep.send({ ok: true });
  });

  // Mark DM channel as read
  app.post("/api/dm/:dmChannelId/read", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { dmChannelId } = req.params as { dmChannelId: string };

    await db.lastRead.upsert({
      where: { userId_dmChannelId: { userId, dmChannelId } },
      create: { userId, dmChannelId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return rep.send({ ok: true });
  });

  // Get all unread counts for current user
  app.get("/api/notifications/unread", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;

    // Get all servers user is a member of, with channels
    const memberships = await db.member.findMany({
      where: { userId },
      include: { server: { include: { channels: { where: { type: "TEXT" }, select: { id: true } } } } },
    });

    const channelIds = memberships.flatMap((m) => m.server.channels.map((c) => c.id));

    // Get lastRead for all channels
    const lastReads = await db.lastRead.findMany({
      where: { userId, channelId: { in: channelIds } },
    });
    const readMap = new Map(lastReads.map((lr) => [lr.channelId, lr.lastReadAt]));

    // Count unread per channel
    const channelUnreads: Record<string, number> = {};
    const serverUnreads: Record<string, number> = {};

    for (const cid of channelIds) {
      const since = readMap.get(cid) || new Date(0);
      const count = await db.message.count({
        where: { channelId: cid, createdAt: { gt: since }, authorId: { not: userId } },
      });
      if (count > 0) channelUnreads[cid] = count;
    }

    // Aggregate per server
    for (const m of memberships) {
      let total = 0;
      for (const c of m.server.channels) {
        total += channelUnreads[c.id] || 0;
      }
      if (total > 0) serverUnreads[m.serverId] = total;
    }

    // DM unreads
    const dmChannels = await db.dMChannel.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { id: true },
    });
    const dmIds = dmChannels.map((d) => d.id);
    const dmLastReads = await db.lastRead.findMany({
      where: { userId, dmChannelId: { in: dmIds } },
    });
    const dmReadMap = new Map(dmLastReads.map((lr) => [lr.dmChannelId, lr.lastReadAt]));

    const dmUnreads: Record<string, number> = {};
    for (const did of dmIds) {
      const since = dmReadMap.get(did) || new Date(0);
      const count = await db.dMMessage.count({
        where: { dmChannelId: did, createdAt: { gt: since }, authorId: { not: userId } },
      });
      if (count > 0) dmUnreads[did] = count;
    }

    return rep.send({ channelUnreads, serverUnreads, dmUnreads });
  });
}
