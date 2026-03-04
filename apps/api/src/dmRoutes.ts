import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

// Always store with smaller ID as userAId for uniqueness
function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function dmRoutes(app: FastifyInstance) {


  // Get or create DM channel with a user
  app.post("/api/dm/open", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { targetUserId } = z.object({ targetUserId: z.string() }).parse(request.body);
    if (targetUserId === userId) return reply.status(400).send({ error: "Cannot DM yourself" });

    // Verify friendship
    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { fromId: userId, toId: targetUserId },
          { fromId: targetUserId, toId: userId },
        ],
      },
    });
    if (!friendship) return reply.status(403).send({ error: "Must be friends to DM" });

    const [userAId, userBId] = sortIds(userId, targetUserId);

    let channel = await db.dMChannel.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: {
        userA: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        userB: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
      },
    });

    if (!channel) {
      channel = await db.dMChannel.create({
        data: { userAId, userBId },
        include: {
          userA: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
          userB: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        },
      });
    }

    return reply.send({ channel });
  });

  // List my DM channels
  app.get("/api/dm", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;

    const channels = await db.dMChannel.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        userB: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ channels });
  });

  // Get DM messages (paginated)
  app.get("/api/dm/:dmChannelId/messages", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { dmChannelId } = request.params as { dmChannelId: string };
    const { cursor } = request.query as { cursor?: string };

    const channel = await db.dMChannel.findUnique({ where: { id: dmChannelId } });
    if (!channel || (channel.userAId !== userId && channel.userBId !== userId)) {
      return reply.status(403).send({ error: "Not your DM" });
    }

    const messages = await db.dMMessage.findMany({
      where: { dmChannelId },
      orderBy: { createdAt: "desc" },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return reply.send({
      messages: messages.reverse(),
      hasMore: messages.length === 50,
      nextCursor: messages.length === 50 ? messages[0].id : null,
    });
  });
}
