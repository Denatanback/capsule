import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { extractUserId } from "./authRoutes.js";

const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens only"),
  type: z.enum(["TEXT", "VOICE"]).default("TEXT"),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  position: z.number().int().min(0).optional(),
});

export async function channelRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    (request as any).userId = userId;
  });

  // Create channel
  app.post("/api/servers/:serverId/channels", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;
    const parsed = createChannelSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || member.role === "MEMBER") {
      return reply.status(403).send({ error: "Only admins/owners can create channels" });
    }

    const maxPos = await db.channel.aggregate({
      where: { serverId },
      _max: { position: true },
    });

    const channel = await db.channel.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        serverId,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
    return reply.status(201).send({ channel });
  });

  // List channels in server
  app.get("/api/servers/:serverId/channels", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const userId = (request as any).userId;

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) return reply.status(403).send({ error: "Not a member" });

    const channels = await db.channel.findMany({
      where: { serverId },
      orderBy: { position: "asc" },
    });
    return reply.send({ channels });
  });

  // Update channel
  app.patch("/api/servers/:serverId/channels/:channelId", async (request, reply) => {
    const { serverId, channelId } = request.params as { serverId: string; channelId: string };
    const userId = (request as any).userId;
    const parsed = updateChannelSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || member.role === "MEMBER") {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const channel = await db.channel.update({
      where: { id: channelId },
      data: parsed.data,
    });
    return reply.send({ channel });
  });

  // Delete channel
  app.delete("/api/servers/:serverId/channels/:channelId", async (request, reply) => {
    const { serverId, channelId } = request.params as { serverId: string; channelId: string };
    const userId = (request as any).userId;

    const member = await db.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member || member.role === "MEMBER") {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const count = await db.channel.count({ where: { serverId } });
    if (count <= 1) return reply.status(400).send({ error: "Cannot delete last channel" });

    await db.channel.delete({ where: { id: channelId } });
    return reply.send({ ok: true });
  });
}
