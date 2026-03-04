import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth.js";
import { config } from "./config.js";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { email, username, displayName, password } = parsed.data;
    const existing = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return reply.status(409).send({ error: `${field} already taken` });
    }
    const user = await db.user.create({
      data: { email, username, displayName, passwordHash: await hashPassword(password) },
    });
    return reply.send({ token: signToken(user.id), user: sanitizeUser(user) });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return reply.status(401).send({ error: "Invalid credentials" });
    if (!(await verifyPassword(password, user.passwordHash))) return reply.status(401).send({ error: "Invalid credentials" });
    return reply.send({ token: signToken(user.id), user: sanitizeUser(user) });
  });

  app.get("/api/auth/google", async (_request, reply) => {
    if (!config.google.clientId) return reply.status(501).send({ error: "Google OAuth not configured" });
    const params = new URLSearchParams({
      client_id: config.google.clientId, redirect_uri: config.google.redirectUri,
      response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "consent",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/api/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ error: "Missing code" });
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: config.google.redirectUri, grant_type: "authorization_code" }),
      });
      const tokens = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const profile = (await userRes.json()) as { id: string; email: string; name: string; picture?: string };

      let account = await db.account.findUnique({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.id } },
        include: { user: true },
      });
      let user;
      if (account) { user = account.user; }
      else {
        user = await db.user.findUnique({ where: { email: profile.email } });
        if (!user) {
          const base = profile.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
          let username = base; let n = 0;
          while (await db.user.findUnique({ where: { username } })) { username = `${base}${++n}`; }
          user = await db.user.create({ data: { email: profile.email, username, displayName: profile.name, avatarUrl: profile.picture } });
        }
        await db.account.create({ data: { userId: user.id, provider: "google", providerAccountId: profile.id, accessToken: tokens.access_token } });
      }
      return reply.redirect(`${config.clientUrl}/auth/callback?token=${signToken(user.id)}`);
    } catch (err) { console.error("Google OAuth error:", err); return reply.status(500).send({ error: "OAuth failed" }); }
  });

  app.get("/api/auth/me", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: "User not found" });
    return reply.send({ user: sanitizeUser(user) });
  });
}

export function extractUserId(request: any): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try { return verifyToken(header.slice(7)).userId; } catch { return null; }
}

function sanitizeUser(user: any) {
  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status, createdAt: user.createdAt };
}
