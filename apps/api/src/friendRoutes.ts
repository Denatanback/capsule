import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

export async function friendRoutes(app: FastifyInstance) {


  // Send friend request (by username)
  app.post("/api/friends/request", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { username } = z.object({ username: z.string().min(1) }).parse(request.body);

    const target = await db.user.findUnique({ where: { username } });
    if (!target) return reply.status(404).send({ error: "User not found" });
    if (target.id === userId) return reply.status(400).send({ error: "Cannot friend yourself" });

    // Check existing friendship in either direction
    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { fromId: userId, toId: target.id },
          { fromId: target.id, toId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === "ACCEPTED") return reply.status(400).send({ error: "Already friends" });
      if (existing.status === "PENDING") return reply.status(400).send({ error: "Request already pending" });
      // If declined, allow re-request by updating
      await db.friendship.update({ where: { id: existing.id }, data: { status: "PENDING", fromId: userId, toId: target.id } });
      return reply.send({ ok: true, status: "re-requested" });
    }

    await db.friendship.create({ data: { fromId: userId, toId: target.id } });
    return reply.status(201).send({ ok: true });
  });

  // List friends + pending requests
  app.get("/api/friends", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;

    const all = await db.friendship.findMany({
      where: { OR: [{ fromId: userId }, { toId: userId }] },
      include: {
        from: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
        to: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const f of all) {
      const other = f.fromId === userId ? f.to : f.from;
      if (f.status === "ACCEPTED") friends.push({ id: f.id, user: other });
      else if (f.status === "PENDING" && f.toId === userId) incoming.push({ id: f.id, user: other });
      else if (f.status === "PENDING" && f.fromId === userId) outgoing.push({ id: f.id, user: other });
    }

    return reply.send({ friends, incoming, outgoing });
  });

  // Accept friend request
  app.post("/api/friends/:friendshipId/accept", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { friendshipId } = request.params as { friendshipId: string };

    const f = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!f || f.toId !== userId || f.status !== "PENDING") {
      return reply.status(404).send({ error: "Request not found" });
    }

    await db.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } });
    return reply.send({ ok: true });
  });

  // Decline friend request
  app.post("/api/friends/:friendshipId/decline", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { friendshipId } = request.params as { friendshipId: string };

    const f = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!f || f.toId !== userId || f.status !== "PENDING") {
      return reply.status(404).send({ error: "Request not found" });
    }

    await db.friendship.update({ where: { id: friendshipId }, data: { status: "DECLINED" } });
    return reply.send({ ok: true });
  });

  // Remove friend
  app.delete("/api/friends/:friendshipId", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { friendshipId } = request.params as { friendshipId: string };

    const f = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!f || (f.fromId !== userId && f.toId !== userId)) {
      return reply.status(404).send({ error: "Not found" });
    }

    await db.friendship.delete({ where: { id: friendshipId } });
    return reply.send({ ok: true });
  });
}
