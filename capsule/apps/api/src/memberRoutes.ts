import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

// Role hierarchy: OWNER > ADMIN > MEMBER
function roleLevel(role: string): number {
  if (role === "OWNER") return 3;
  if (role === "ADMIN") return 2;
  return 1;
}

export async function memberRoutes(app: FastifyInstance) {


  // Kick member
  app.post("/api/servers/:serverId/members/:targetId/kick", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };
    if (userId === targetId) return reply.status(400).send({ error: "Cannot kick yourself" });

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    const target = await db.member.findUnique({ where: { userId_serverId: { userId: targetId, serverId } } });
    if (!actor || !target) return reply.status(404).send({ error: "Member not found" });
    if (roleLevel(actor.role) <= roleLevel(target.role)) {
      return reply.status(403).send({ error: "Cannot kick someone with equal or higher role" });
    }

    await db.member.delete({ where: { id: target.id } });
    return reply.send({ ok: true });
  });

  // Ban member
  app.post("/api/servers/:serverId/members/:targetId/ban", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };
    const { reason } = z.object({ reason: z.string().optional() }).parse(request.body || {});
    if (userId === targetId) return reply.status(400).send({ error: "Cannot ban yourself" });

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    const target = await db.member.findUnique({ where: { userId_serverId: { userId: targetId, serverId } } });
    if (!actor) return reply.status(404).send({ error: "Not a member" });
    if (target && roleLevel(actor.role) <= roleLevel(target.role)) {
      return reply.status(403).send({ error: "Cannot ban someone with equal or higher role" });
    }

    // Remove membership if exists
    if (target) await db.member.delete({ where: { id: target.id } });

    // Create ban
    await db.ban.upsert({
      where: { userId_serverId: { userId: targetId, serverId } },
      create: { userId: targetId, serverId, reason: reason || null, bannedBy: userId },
      update: { reason: reason || null, bannedBy: userId },
    });

    return reply.send({ ok: true });
  });

  // Unban
  app.post("/api/servers/:serverId/bans/:targetId/unban", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    if (!actor || actor.role === "MEMBER") return reply.status(403).send({ error: "Admins only" });

    await db.ban.delete({ where: { userId_serverId: { userId: targetId, serverId } } }).catch(() => {});
    return reply.send({ ok: true });
  });

  // List bans
  app.get("/api/servers/:serverId/bans", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId } = request.params as { serverId: string };

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    if (!actor || actor.role === "MEMBER") return reply.status(403).send({ error: "Admins only" });

    const bans = await db.ban.findMany({ where: { serverId } });
    return reply.send({ bans });
  });

  // Promote to admin
  app.post("/api/servers/:serverId/members/:targetId/promote", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    const target = await db.member.findUnique({ where: { userId_serverId: { userId: targetId, serverId } } });
    if (!actor || !target) return reply.status(404).send({ error: "Member not found" });
    if (actor.role !== "OWNER") return reply.status(403).send({ error: "Only owner can promote" });
    if (target.role !== "MEMBER") return reply.status(400).send({ error: "Already admin or owner" });

    await db.member.update({ where: { id: target.id }, data: { role: "ADMIN" } });
    return reply.send({ ok: true });
  });

  // Demote to member
  app.post("/api/servers/:serverId/members/:targetId/demote", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    const target = await db.member.findUnique({ where: { userId_serverId: { userId: targetId, serverId } } });
    if (!actor || !target) return reply.status(404).send({ error: "Member not found" });
    if (actor.role !== "OWNER") return reply.status(403).send({ error: "Only owner can demote" });
    if (target.role !== "ADMIN") return reply.status(400).send({ error: "Not an admin" });

    await db.member.update({ where: { id: target.id }, data: { role: "MEMBER" } });
    return reply.send({ ok: true });
  });

  // Transfer ownership
  app.post("/api/servers/:serverId/members/:targetId/transfer", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, targetId } = request.params as { serverId: string; targetId: string };

    const actor = await db.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
    const target = await db.member.findUnique({ where: { userId_serverId: { userId: targetId, serverId } } });
    if (!actor || !target) return reply.status(404).send({ error: "Member not found" });
    if (actor.role !== "OWNER") return reply.status(403).send({ error: "Only owner can transfer" });

    await db.$transaction([
      db.member.update({ where: { id: target.id }, data: { role: "OWNER" } }),
      db.member.update({ where: { id: actor.id }, data: { role: "ADMIN" } }),
      db.server.update({ where: { id: serverId }, data: { ownerId: targetId } }),
    ]);

    return reply.send({ ok: true });
  });
}
