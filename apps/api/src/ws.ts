import { FastifyInstance } from "fastify";
import { WebSocket } from "@fastify/websocket";
import { db } from "./db.js";
import { verifyToken } from "./auth.js";
import { computeTopology } from "./topology.js";
import crypto from "crypto";

// FIX #2: Client keyed by connectionId (not userId) to support multi-tab
interface Client { ws: WebSocket; userId: string; connId: string; channels: Set<string>; }
const clients = new Map<string, Client>();
const typingTimers = new Map<string, NodeJS.Timeout>();
const voiceRooms = new Map<string, Set<string>>();
const latencyMatrix = new Map<string, number>();
const roomTopology = new Map<string, any>();

// Helper: get all connections for a userId
function getClientsByUser(uid: string): Client[] {
  const result: Client[] = [];
  for (const c of clients.values()) if (c.userId === uid) result.push(c);
  return result;
}

function recalcTopology(channelId: string) {
  const room = voiceRooms.get(channelId);
  if (!room || room.size < 2) { roomTopology.delete(channelId); return; }
  const userIds = Array.from(room);
  const entries: { from: string; to: string; rtt: number }[] = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const key = userIds[i] + ":" + userIds[j];
      const rtt = latencyMatrix.get(key) ?? latencyMatrix.get(userIds[j] + ":" + userIds[i]) ?? 100;
      entries.push({ from: userIds[i], to: userIds[j], rtt });
    }
  }
  const topo = computeTopology(userIds, entries);
  roomTopology.set(channelId, topo);
  for (const uid of userIds) {
    const node = topo.nodes.find((n: any) => n.userId === uid);
    sendToUser(uid, "voice:topology", { channelId, topology: topo, myNode: node });
  }
}

function getVoiceUsers(channelId: string): string[] {
  return Array.from(voiceRooms.get(channelId) || []);
}

function voiceBroadcast(channelId: string, ev: string, d: any, skipUserId?: string) {
  const room = voiceRooms.get(channelId);
  if (!room) return;
  const m = JSON.stringify({ event: ev, data: d });
  for (const uid of room) {
    if (uid !== skipUserId) {
      for (const c of getClientsByUser(uid)) {
        try { c.ws.send(m); } catch {}
      }
    }
  }
}

// FIX #3: broadcast now includes sender. No separate sendTo for sender needed.
function broadcast(ch: string, ev: string, d: any, skipUserId?: string) {
  const m = JSON.stringify({ event: ev, data: d });
  for (const c of clients.values())
    if (c.channels.has(ch) && c.userId !== skipUserId) try { c.ws.send(m); } catch {}
}

// Send to ALL connections of a user
function sendToUser(uid: string, ev: string, d: any) {
  const m = JSON.stringify({ event: ev, data: d });
  for (const c of getClientsByUser(uid)) {
    try { c.ws.send(m); } catch {}
  }
}

// Send to a specific connection
function sendToConn(connId: string, ev: string, d: any) {
  const c = clients.get(connId);
  if (c) try { c.ws.send(JSON.stringify({ event: ev, data: d })); } catch (e) { console.error("[ws]", e); }
}

function broadcastPresence(uid: string, st: string) {
  const m = JSON.stringify({ event: "presence", data: { userId: uid, status: st } });
  for (const c of clients.values())
    if (c.userId !== uid) try { c.ws.send(m); } catch {}
}

async function setStatus(uid: string, st: string) {
  await db.user.update({ where: { id: uid }, data: { status: st as any, lastSeenAt: new Date() } });
  broadcastPresence(uid, st);
}

function getOnlineUserIds(): string[] {
  const s = new Set<string>();
  for (const c of clients.values()) s.add(c.userId);
  return Array.from(s);
}

// Check if user still has any connections (for presence on disconnect)
function userHasConnections(uid: string): boolean {
  for (const c of clients.values()) if (c.userId === uid) return true;
  return false;
}

export async function wsHandler(app: FastifyInstance) {
  app.get("/api/servers/:serverId/online", async (req, reply) => {
    return reply.send({ online: getOnlineUserIds() });
  });
  app.get("/api/channels/:channelId/voice-users", async (req, reply) => {
    const { channelId } = req.params as { channelId: string };
    return reply.send({ users: getVoiceUsers(channelId) });
  });

  app.get("/ws", { websocket: true }, (socket, req) => {
    let userId: string | null = null;
    const connId = crypto.randomUUID();
    console.log(`[WS] New connection: ${connId}`);

    socket.on("message", async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const { event, data } = msg;
      if (event !== "typing:start" && event !== "typing:stop") {
        console.log(`[WS] ${connId.slice(0,8)} <- ${event}`, event === "auth" ? "(auth)" : "");
      }

      if (event === "auth") {
        try {
          const p = verifyToken(data.token);
          userId = p.userId;
          const ms = await db.member.findMany({
            where: { userId },
            include: { server: { include: { channels: { select: { id: true } } } } },
          });
          const chs = new Set<string>();
          for (const m of ms) for (const c of m.server.channels) chs.add(c.id);
          clients.set(connId, { ws: socket, userId, connId, channels: chs });
          // Only set ONLINE if this is their first connection
          if (getClientsByUser(userId).length === 1) {
            await setStatus(userId, "ONLINE");
          }
          socket.send(JSON.stringify({
            event: "auth:ok",
            data: { channelCount: chs.size, onlineUsers: getOnlineUserIds() },
          }));
        } catch {
          socket.send(JSON.stringify({ event: "auth:error", data: { error: "Invalid token" } }));
        }
        return;
      }

      if (!userId) return;
      const client = clients.get(connId);
      if (!client) return;

      // === MESSAGES (FIX #3: broadcast includes sender, no duplicate sendTo) ===
      if (event === "message:send") {
        const { channelId, content, fileIds, voiceUrl } = data;
        if (!channelId || (!content?.trim() && (!fileIds || fileIds.length === 0) && !voiceUrl)) return;
        if (!client.channels.has(channelId)) return;
        try {
          const m = await db.message.create({
            data: { channelId, authorId: userId, content: (content || "").trim(), ...(voiceUrl ? { voiceUrl } : {}) },
            include: {
              author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              attachments: true,
            },
          });
          // Link uploaded files to this message
          if (fileIds && fileIds.length > 0) {
            await db.fileUpload.updateMany({
              where: { uuid: { in: fileIds }, uploaderId: userId },
              data: { messageId: m.id, channelId, serverId: (await db.channel.findUnique({ where: { id: channelId }, select: { serverId: true } }))?.serverId },
            });
            // Re-fetch with attachments
            const full = await db.message.findUnique({
              where: { id: m.id },
              include: {
                author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                attachments: true,
              },
            });
            broadcast(channelId, "message:new", full);
          } else {
            broadcast(channelId, "message:new", m);
          }
        } catch (e) { console.error("[ws]", e); }
      }

      if (event === "message:edit") {
        const { messageId, content } = data;
        if (!messageId || !content?.trim()) return;
        try {
          const ex = await db.message.findUnique({ where: { id: messageId } });
          if (!ex || ex.authorId !== userId) return;
          const m = await db.message.update({
            where: { id: messageId },
            data: { content: content.trim(), editedAt: new Date() },
            include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          });
          broadcast(ex.channelId, "message:edited", m);
        } catch (e) { console.error("[ws]", e); }
      }

      if (event === "message:delete") {
        const { messageId } = data;
        if (!messageId) return;
        try {
          const ex = await db.message.findUnique({
            where: { id: messageId },
            select: { id: true, authorId: true, channelId: true, channel: { select: { serverId: true } } },
          });
          if (!ex) return;
          const mem = await db.member.findUnique({
            where: { userId_serverId: { userId, serverId: ex.channel.serverId } },
          });
          if (ex.authorId !== userId && (!mem || mem.role === "MEMBER")) return;
          await db.message.delete({ where: { id: messageId } });
          broadcast(ex.channelId, "message:deleted", { id: messageId, channelId: ex.channelId });
        } catch (e) { console.error("[ws]", e); }
      }

      // === TYPING ===
      if (event === "typing:start") {
        const { channelId } = data;
        if (!channelId || !client.channels.has(channelId)) return;
        const key = userId + ":" + channelId;
        broadcast(channelId, "typing:update", { userId, channelId, typing: true }, userId);
        const prev = typingTimers.get(key);
        if (prev) clearTimeout(prev);
        typingTimers.set(key, setTimeout(() => {
          broadcast(channelId, "typing:update", { userId, channelId, typing: false }, userId as string);
          typingTimers.delete(key);
        }, 3000));
      }

      if (event === "typing:stop") {
        const { channelId } = data;
        if (!channelId) return;
        const key = userId + ":" + channelId;
        const prev = typingTimers.get(key);
        if (prev) clearTimeout(prev);
        typingTimers.delete(key);
        broadcast(channelId, "typing:update", { userId, channelId, typing: false }, userId);
      }

      // FIX #1: channel:join validates membership
      if (event === "channel:join") {
        const { channelId } = data;
        if (!channelId) return;
        // Verify user is a member of the channel's server
        const channel = await db.channel.findUnique({
          where: { id: channelId },
          select: { serverId: true },
        });
        if (!channel) return;
        const member = await db.member.findUnique({
          where: { userId_serverId: { userId, serverId: channel.serverId } },
        });
        if (!member) return; // Not a member, reject silently
        client.channels.add(channelId);
      }

      // === VOICE ===
      if (event === "voice:join") {
        const { channelId } = data;
        if (!channelId) return;
        for (const [chId, room] of voiceRooms.entries()) {
          if (room.has(userId)) {
            room.delete(userId);
            voiceBroadcast(chId, "voice:user-left", { userId, channelId: chId });
            broadcast(chId, "voice:users", { channelId: chId, users: getVoiceUsers(chId) });
            if (room.size === 0) voiceRooms.delete(chId);
            else if (room.size >= 3) recalcTopology(chId);
          }
        }
        if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Set());
        voiceRooms.get(channelId)!.add(userId);
        const users = getVoiceUsers(channelId);
        sendToUser(userId, "voice:joined", { channelId, users: users.filter(u => u !== userId) });
        voiceBroadcast(channelId, "voice:user-joined", { userId, channelId }, userId);
        broadcast(channelId, "voice:users", { channelId, users });
        if (users.length >= 3) {
          for (const uid of users) {
            sendToUser(uid, "voice:measure-latency", { channelId, peers: users.filter(u => u !== uid) });
          }
        }
      }

      if (event === "voice:leave") {
        const { channelId } = data;
        if (!channelId) return;
        const room = voiceRooms.get(channelId);
        if (room) {
          room.delete(userId);
          voiceBroadcast(channelId, "voice:user-left", { userId, channelId });
          broadcast(channelId, "voice:users", { channelId, users: getVoiceUsers(channelId) });
          if (room.size === 0) voiceRooms.delete(channelId);
          else if (room.size >= 3) recalcTopology(channelId);
        }
        sendToUser(userId, "voice:left", { channelId });
      }

      if (event === "voice:offer") {
        const { targetUserId, channelId, offer } = data;
        if (targetUserId && offer) sendToUser(targetUserId, "voice:offer", { userId, channelId, offer });
      }
      if (event === "voice:answer") {
        const { targetUserId, channelId, answer } = data;
        if (targetUserId && answer) sendToUser(targetUserId, "voice:answer", { userId, channelId, answer });
      }
      if (event === "voice:ice-candidate") {
        const { targetUserId, channelId, candidate } = data;
        if (targetUserId && candidate) sendToUser(targetUserId, "voice:ice-candidate", { userId, channelId, candidate });
      }

      if (event === "voice:invite") {
        const { targetUserId, channelId } = data;
        if (!targetUserId || !channelId) return;
        // Get channel name for the invite
        const channel = await db.channel.findUnique({ where: { id: channelId }, select: { name: true } });
        const inviter = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
        sendToUser(targetUserId, "voice:invite", {
          fromUserId: userId,
          fromName: inviter?.displayName || "Someone",
          channelId,
          channelName: channel?.name || "Voice",
        });
      }

      if (event === "voice:latency") {
        const { targetUserId, channelId, rtt } = data;
        if (targetUserId && rtt != null) {
          latencyMatrix.set(userId + ":" + targetUserId, rtt);
          const room = voiceRooms.get(channelId);
          if (room && room.size >= 3) {
            const users = Array.from(room);
            let have = 0;
            const need = users.length * (users.length - 1) / 2;
            for (let i = 0; i < users.length; i++)
              for (let j = i + 1; j < users.length; j++)
                if (latencyMatrix.has(users[i] + ":" + users[j]) || latencyMatrix.has(users[j] + ":" + users[i])) have++;
            if (have >= need) recalcTopology(channelId);
          }
        }
      }

      // === DM (DM uses sendToUser so both tabs get it, no duplicates) ===
      if (event === "dm:send") {
        const { dmChannelId, content, voiceUrl } = data;
        if (!dmChannelId || (!content?.trim() && !voiceUrl)) return;
        try {
          const ch = await db.dMChannel.findUnique({ where: { id: dmChannelId } });
          if (!ch || (ch.userAId !== userId && ch.userBId !== userId)) return;
          const m = await db.dMMessage.create({
            data: { dmChannelId, authorId: userId, content: (content || "").trim(), ...(voiceUrl ? { voiceUrl } : {}) },
            include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          });
          const otherId = ch.userAId === userId ? ch.userBId : ch.userAId;
          sendToUser(userId, "dm:new", { ...m, dmChannelId });
          sendToUser(otherId, "dm:new", { ...m, dmChannelId });
        } catch (e) { console.error("[dm:send] Error:", e); }
      }

      if (event === "dm:edit") {
        const { messageId, content } = data;
        if (!messageId || !content?.trim()) return;
        try {
          const ex = await db.dMMessage.findUnique({ where: { id: messageId }, include: { dmChannel: true } });
          if (!ex || ex.authorId !== userId) return;
          const m = await db.dMMessage.update({
            where: { id: messageId },
            data: { content: content.trim(), editedAt: new Date() },
            include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          });
          const ch = ex.dmChannel;
          const otherId = ch.userAId === userId ? ch.userBId : ch.userAId;
          sendToUser(userId, "dm:edited", { ...m, dmChannelId: ch.id });
          sendToUser(otherId, "dm:edited", { ...m, dmChannelId: ch.id });
        } catch (e) { console.error("[ws]", e); }
      }

      if (event === "dm:delete") {
        const { messageId } = data;
        if (!messageId) return;
        try {
          const ex = await db.dMMessage.findUnique({ where: { id: messageId }, include: { dmChannel: true } });
          if (!ex || ex.authorId !== userId) return;
          await db.dMMessage.delete({ where: { id: messageId } });
          const ch = ex.dmChannel;
          const otherId = ch.userAId === userId ? ch.userBId : ch.userAId;
          const dd = { id: messageId, dmChannelId: ch.id };
          sendToUser(userId, "dm:deleted", dd);
          sendToUser(otherId, "dm:deleted", dd);
        } catch (e) { console.error("[ws]", e); }
      }

      // === P2P DM SIGNALING (ephemeral chat) ===
      if (event === "p2p:request") {
        const { targetUserId } = data;
        if (!targetUserId) return;
        sendToUser(targetUserId, "p2p:request", { fromUserId: userId });
      }
      if (event === "p2p:accept") {
        const { targetUserId } = data;
        if (!targetUserId) return;
        sendToUser(targetUserId, "p2p:accept", { fromUserId: userId });
      }
      if (event === "p2p:decline") {
        const { targetUserId } = data;
        if (!targetUserId) return;
        sendToUser(targetUserId, "p2p:decline", { fromUserId: userId });
      }
      if (event === "p2p:offer") {
        const { targetUserId, offer } = data;
        if (targetUserId && offer) sendToUser(targetUserId, "p2p:offer", { fromUserId: userId, offer });
      }
      if (event === "p2p:answer") {
        const { targetUserId, answer } = data;
        if (targetUserId && answer) sendToUser(targetUserId, "p2p:answer", { fromUserId: userId, answer });
      }
      if (event === "p2p:ice") {
        const { targetUserId, candidate } = data;
        if (targetUserId && candidate) sendToUser(targetUserId, "p2p:ice", { fromUserId: userId, candidate });
      }
      if (event === "p2p:end") {
        const { targetUserId } = data;
        if (targetUserId) sendToUser(targetUserId, "p2p:end", { fromUserId: userId });
      }

      if (event === "status:set") {
        const { status } = data;
        if (["ONLINE", "IDLE", "DND", "OFFLINE"].includes(status)) await setStatus(userId, status);
      }
    });

    socket.on("close", async () => {
      console.log(`[WS] Connection closed: ${connId.slice(0,8)} user=${userId}`);
      // Remove this specific connection
      clients.delete(connId);

      if (userId) {
        // Voice cleanup for this user (only if no other tabs in voice)
        if (!userHasConnections(userId)) {
          for (const [chId, room] of voiceRooms.entries()) {
            if (room.has(userId)) {
              room.delete(userId);
              voiceBroadcast(chId, "voice:user-left", { userId, channelId: chId });
              broadcast(chId, "voice:users", { channelId: chId, users: getVoiceUsers(chId) });
              if (room.size === 0) voiceRooms.delete(chId);
              else if (room.size >= 3) recalcTopology(chId);
            }
          }
          // Typing cleanup
          for (const [key, timer] of typingTimers.entries()) {
            if (key.startsWith(userId + ":")) {
              clearTimeout(timer);
              typingTimers.delete(key);
              const chId = key.split(":")[1];
              broadcast(chId, "typing:update", { userId, channelId: chId, typing: false });
            }
          }
          // Only set OFFLINE if no remaining connections
          await setStatus(userId, "OFFLINE").catch(() => {});
        }
      }
    });
  });
}
