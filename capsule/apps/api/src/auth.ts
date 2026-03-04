import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "./config.js";

export interface JwtPayload {
  userId: string;
  type?: "access" | "refresh";
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Short-lived access token (15 min)
export function signAccessToken(userId: string): string {
  return jwt.sign({ userId, type: "access" } satisfies JwtPayload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

// Generate random refresh token string (not JWT — opaque)
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

// Legacy compat: signToken still works for WS auth
export function signToken(userId: string): string {
  return signAccessToken(userId);
}

// Password strength validation
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(password)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
}
