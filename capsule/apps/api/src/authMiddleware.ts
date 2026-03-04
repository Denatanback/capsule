import { extractUserId } from "./authRoutes.js";

export async function requireAuth(req: any, rep: any) {
  const uid = extractUserId(req);
  if (!uid) { rep.status(401).send({ error: "Unauthorized" }); return; }
  (req as any).userId = uid;
}
