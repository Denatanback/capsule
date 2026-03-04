import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";

export async function profileRoutes(app: FastifyInstance) {


  // Update profile
  app.patch("/api/profile", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({
      displayName: z.string().min(1).max(64).optional(),
      aboutMe: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional().nullable(),
    }).parse(req.body);

    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.aboutMe !== undefined ? { aboutMe: body.aboutMe } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      },
    });

    return rep.send({ user: sanitize(user) });
  });

  // Get profile (own or others)
  app.get("/api/profile/:userId", { preHandler: requireAuth }, async (req, rep) => {
    const { userId } = req.params as { userId: string };
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return rep.status(404).send({ error: "User not found" });
    return rep.send({ user: sanitize(user) });
  });

  // Block a user
  app.post("/api/blocks/:targetId", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const { targetId } = req.params as { targetId: string };
    if (userId === targetId) return rep.status(400).send({ error: "Cannot block yourself" });

    await db.block.upsert({
      where: { userId_blockedId: { userId, blockedId: targetId } },
      create: { userId, blockedId: targetId },
      update: {},
    });
    return rep.send({ ok: true });
  });

  // Unblock
  app.delete("/api/blocks/:targetId", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const { targetId } = req.params as { targetId: string };

    await db.block.delete({
      where: { userId_blockedId: { userId, blockedId: targetId } },
    }).catch(() => {});
    return rep.send({ ok: true });
  });

  // List blocked users
  app.get("/api/blocks", { preHandler: requireAuth }, async (req, rep) => {
    const userId = (req as any).userId;
    const blocks = await db.block.findMany({ where: { userId } });
    const userIds = blocks.map((b) => b.blockedId);
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    return rep.send({ blocked: users });
  });
}

function sanitize(user: any) {
  return {
    id: user.id, email: user.email, username: user.username,
    displayName: user.displayName, avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe, status: user.status, createdAt: user.createdAt,
  };
}
