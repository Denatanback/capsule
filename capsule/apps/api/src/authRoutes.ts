import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { hashPassword, verifyPassword, signAccessToken, generateRefreshToken, verifyToken, validatePasswordStrength } from "./auth.js";
import { config } from "./config.js";

// === RATE LIMITING (in-memory, per IP) ===
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 5; // 5 attempts per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

// Cleanup stale entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 300_000);

// === LOCKOUT CONFIG ===
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {

  // === REGISTER ===
  app.post("/api/auth/register", async (request, reply) => {
    const ip = request.ip;
    if (!checkRateLimit("reg:" + ip)) {
      return reply.status(429).send({ error: "Too many attempts. Try again in a minute." });
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { email, username, displayName, password } = parsed.data;

    // Password strength check
    const pwErr = validatePasswordStrength(password);
    if (pwErr) return reply.status(400).send({ error: pwErr });

    const existing = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return reply.status(409).send({ error: field + " already taken" });
    }

    const user = await db.user.create({
      data: { email, username, displayName, passwordHash: await hashPassword(password) },
    });

    const { accessToken, refreshToken } = await issueTokens(user.id);
    return reply.send({ token: accessToken, refreshToken, user: sanitizeUser(user) });
  });

  // === LOGIN ===
  app.post("/api/auth/login", async (request, reply) => {
    const ip = request.ip;
    if (!checkRateLimit("login:" + ip)) {
      return reply.status(429).send({ error: "Too many attempts. Try again in a minute." });
    }

    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return reply.status(423).send({ error: "Account locked. Try again in " + mins + " minutes." });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const newFailed = user.failedLogins + 1;
      const lockout = newFailed >= MAX_FAILED_LOGINS
        ? { failedLogins: newFailed, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
        : { failedLogins: newFailed };
      await db.user.update({ where: { id: user.id }, data: lockout });

      if (newFailed >= MAX_FAILED_LOGINS) {
        return reply.status(423).send({ error: "Too many failed attempts. Account locked for 15 minutes." });
      }
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    // Reset failed logins on success
    if (user.failedLogins > 0) {
      await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id);
    return reply.send({ token: accessToken, refreshToken, user: sanitizeUser(user) });
  });

  // === REFRESH TOKEN ===
  app.post("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(request.body);

    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await db.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate: delete old, issue new
    await db.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await issueTokens(stored.userId);

    return reply.send({ token: tokens.accessToken, refreshToken: tokens.refreshToken, user: sanitizeUser(stored.user) });
  });

  // === LOGOUT (revoke refresh token) ===
  app.post("/api/auth/logout", async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(request.body || {});
    if (refreshToken) {
      await db.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  // === GOOGLE OAUTH ===
  app.get("/api/auth/google", async (_request, reply) => {
    if (!config.google.clientId) return reply.status(501).send({ error: "Google OAuth not configured" });
    const params = new URLSearchParams({
      client_id: config.google.clientId, redirect_uri: config.google.redirectUri,
      response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "consent",
    });
    return reply.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params);
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
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: "Bearer " + tokens.access_token } });
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
          while (await db.user.findUnique({ where: { username } })) { username = base + (++n); }
          user = await db.user.create({ data: { email: profile.email, username, displayName: profile.name, avatarUrl: profile.picture } });
        }
        await db.account.create({ data: { userId: user.id, provider: "google", providerAccountId: profile.id, accessToken: tokens.access_token } });
      }
      const t = await issueTokens(user.id);
      return reply.redirect(config.clientUrl + "/auth/callback?token=" + t.accessToken + "&refresh=" + t.refreshToken);
    } catch (err) { console.error("Google OAuth error:", err); return reply.status(500).send({ error: "OAuth failed" }); }
  });

  // === ME ===
  app.get("/api/auth/me", async (request, reply) => {
    const userId = extractUserId(request);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: "User not found" });
    return reply.send({ user: sanitizeUser(user) });
  });
}

// === HELPERS ===
async function issueTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  await db.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + config.jwt.refreshExpiresMs),
    },
  });
  return { accessToken, refreshToken };
}

export function extractUserId(request: any): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try { return verifyToken(header.slice(7)).userId; } catch { return null; }
}

function sanitizeUser(user: any) {
  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, aboutMe: user.aboutMe, status: user.status, createdAt: user.createdAt };
}
