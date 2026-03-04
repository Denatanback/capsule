import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function serverRoutes(app: FastifyInstance) {
  // Auth guard


  // Create server
  app.post("/api/servers", { preHandler: requireAuth as any }, async (request, reply) => {
    const parsed = createServerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const userId = (request as any).userId;

    const server = await db.server.create({
      data: {
        name: parsed.data.name,
        ownerId: userId,
        channels: { create: { name: "general", position: 0 } },
        members: { create: { userId, role: "OWNER" } },
      },
      include: { channels: true, members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } } } },
    });
    return reply.status(201).send({ server });
  });

  // List my servers
  app.get("/api/servers", { preHandler: requireAuth as any }, async (request, reply) => {
    const userId = (request as any).userId;
    const members = await db.member.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            channels: { orderBy: { position: "asc" } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    const servers = members.map((m) => ({
      ...m.server,
      myRole: m.role,
    }));
    return reply.send({ servers });
  });

  // Get single server
  app.get("/api/servers/:serverId", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) return reply.status(403).send({ error: "Not a member" });

    const server = await db.server.findUnique({
      where: { id: serverId },
      include: {
        channels: { orderBy: { position: "asc" } },
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!server) return reply.status(404).send({ error: "Server not found" });
    return reply.send({ server, myRole: member.role });
  });

  // Update server (owner/admin only)
  app.patch("/api/servers/:serverId", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;
    const parsed = updateServerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const server = await db.server.update({
      where: { id: serverId },
      data: parsed.data,
    });
    return reply.send({ server });
  });

  // Delete server (owner only)
  app.delete("/api/servers/:serverId", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const server = await db.server.findUnique({ where: { id: serverId } });
    if (!server) return reply.status(404).send({ error: "Server not found" });
    if (server.ownerId !== userId) return reply.status(403).send({ error: "Only owner can delete" });

    await db.server.delete({ where: { id: serverId } });
    return reply.send({ ok: true });
  });

  // Join server by invite code (using server ID for now)
  app.post("/api/servers/:serverId/join", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const server = await db.server.findUnique({ where: { id: serverId } });
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const existing = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (existing) return reply.status(409).send({ error: "Already a member" });

    await db.member.create({ data: { userId, serverId, role: "MEMBER" } });
    return reply.send({ ok: true });
  });

  // Leave server
  app.post("/api/servers/:serverId/leave", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const server = await db.server.findUnique({ where: { id: serverId } });
    if (!server) return reply.status(404).send({ error: "Server not found" });
    if (server.ownerId === userId) return reply.status(400).send({ error: "Owner cannot leave. Transfer or delete." });

    await db.member.deleteMany({ where: { userId, serverId } });
    return reply.send({ ok: true });
  });

  // Get server members
  app.get("/api/servers/:serverId/members", { preHandler: requireAuth as any }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) return reply.status(403).send({ error: "Not a member" });

    const members = await db.member.findMany({
      where: { serverId },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } } },
      orderBy: { joinedAt: "asc" },
    });
    return reply.send({ members });
  });
}
