import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";
import crypto from "crypto";

function genCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

export async function inviteRoutes(app: FastifyInstance) {


  // Create invite link
  app.post("/api/servers/:serverId/invites", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId } = request.params as { serverId: string };
    const body = z.object({
      maxUses: z.number().int().min(1).optional(),
      expiresInHours: z.number().min(1).optional(),
    }).parse(request.body || {});

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) return reply.status(403).send({ error: "Not a member" });

    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : null;

    const invite = await db.invite.create({
      data: {
        code: genCode(),
        serverId,
        creatorId: userId,
        maxUses: body.maxUses || null,
        expiresAt,
      },
    });

    return reply.status(201).send({ invite });
  });

  // List invites for a server
  app.get("/api/servers/:serverId/invites", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId } = request.params as { serverId: string };

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || member.role === "MEMBER") {
      return reply.status(403).send({ error: "Admins only" });
    }

    const invites = await db.invite.findMany({
      where: { serverId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ invites });
  });

  // Delete invite
  app.delete("/api/servers/:serverId/invites/:inviteId", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { serverId, inviteId } = request.params as { serverId: string; inviteId: string };

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || member.role === "MEMBER") {
      return reply.status(403).send({ error: "Admins only" });
    }

    await db.invite.delete({ where: { id: inviteId } }).catch(() => {});
    return reply.send({ ok: true });
  });

  // Use invite code to join server
  app.post("/api/invites/:code/join", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const { code } = request.params as { code: string };

    const invite = await db.invite.findUnique({ where: { code } });
    if (!invite) return reply.status(404).send({ error: "Invalid invite" });

    // Check expiry
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return reply.status(410).send({ error: "Invite expired" });
    }

    // Check max uses
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return reply.status(410).send({ error: "Invite max uses reached" });
    }

    // Check ban
    const ban = await db.ban.findUnique({
      where: { userId_serverId: { userId, serverId: invite.serverId } },
    });
    if (ban) return reply.status(403).send({ error: "You are banned from this server" });

    // Check already member
    const existing = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId: invite.serverId } },
    });
    if (existing) return reply.send({ ok: true, serverId: invite.serverId, alreadyMember: true });

    // Join + increment uses
    await db.member.create({ data: { userId, serverId: invite.serverId } });
    await db.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });

    return reply.send({ ok: true, serverId: invite.serverId });
  });

  // Lookup invite info (public, no auth needed technically but we keep auth)
  app.get("/api/invites/:code", { preHandler: requireAuth as any }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const invite = await db.invite.findUnique({
      where: { code },
      include: { server: { select: { id: true, name: true, iconUrl: true, _count: { select: { members: true } } } } },
    });
    if (!invite) return reply.status(404).send({ error: "Invalid invite" });
    const expired = (invite.expiresAt && invite.expiresAt < new Date()) || (invite.maxUses && invite.uses >= invite.maxUses);
    return reply.send({ invite: { code: invite.code, server: invite.server, expired } });
  });
}
