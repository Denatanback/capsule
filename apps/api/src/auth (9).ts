import { FastifyInstance } from "fastify";
import { WebSocket } from "@fastify/websocket";
import { db } from "./db.js";
import { verifyToken } from "./auth.js";

interface Client { ws: WebSocket; userId: string; channels: Set<string>; }
const clients = new Map<string, Client>();
const typingTimers = new Map<string, NodeJS.Timeout>();

function broadcast(ch: string, ev: string, d: any, skip?: string) {
  const m = JSON.stringify({ event: ev, data: d });
  for (const c of clients.values())
    if (c.channels.has(ch) && c.userId !== skip) try { c.ws.send(m); } catch {}
}
function sendTo(uid: string, ev: string, d: any) {
  const c = clients.get(uid);
  if (c) try { c.ws.send(JSON.stringify({ event: ev, data: d })); } catch {}
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
  return Array.from(clients.values()).map(c => c.userId);
}

export async function wsHandler(app: FastifyInstance) {
  app.get("/api/servers/:serverId/online", async (req, reply) => {
    return reply.send({ online: getOnlineUserIds() });
  });

  app.get("/ws", { websocket: true }, (socket, req) => {
    let userId: string | null = null;
    let clientId: string | null = null;
    socket.on("message", async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const { event, data } = msg;
      if (event==="auth") {
        try {
          const p=verifyToken(data.token); userId=p.userId; clientId=userId;
          const ms=await db.member.findMany({where:{userId},include:{server:{include:{channels:{select:{id:true}}}}}});
          const chs=new Set<string>();
          for(const m of ms) for(const c of m.server.channels) chs.add(c.id);
          clients.set(clientId,{ws:socket,userId,channels:chs});
          await setStatus(userId,"ONLINE");
          socket.send(JSON.stringify({event:"auth:ok",data:{channelCount:chs.size,onlineUsers:getOnlineUserIds()}}));
        } catch { socket.send(JSON.stringify({event:"auth:error",data:{error:"Invalid token"}})); }
        return;
      }
      if(!userId||!clientId) return;
      const client=clients.get(clientId); if(!client) return;
      if(event==="message:send"){
        const{channelId,content}=data; if(!channelId||!content?.trim())return;
        if(!client.channels.has(channelId))return;
        try{const m=await db.message.create({data:{channelId,authorId:userId,content:content.trim()},include:{author:{select:{id:true,username:true,displayName:true,avatarUrl:true}}}});
        broadcast(channelId,"message:new",m);sendTo(userId,"message:new",m);}catch{}
      }
      if(event==="message:edit"){
        const{messageId,content}=data; if(!messageId||!content?.trim())return;
        try{const ex=await db.message.findUnique({where:{id:messageId}});if(!ex||ex.authorId!==userId)return;
        const m=await db.message.update({where:{id:messageId},data:{content:content.trim(),editedAt:new Date()},include:{author:{select:{id:true,username:true,displayName:true,avatarUrl:true}}}});
        broadcast(ex.channelId,"message:edited",m);sendTo(userId,"message:edited",m);}catch{}
      }
      if(event==="message:delete"){
        const{messageId}=data; if(!messageId)return;
        try{
        const ex=await db.message.findUnique({where:{id:messageId},select:{id:true,authorId:true,channelId:true,channel:{select:{serverId:true}}}});
        if(!ex)return;
        const mem=await db.member.findUnique({where:{userId_serverId:{userId,serverId:ex.channel.serverId}}});
        if(ex.authorId!==userId&&(!mem||mem.role==="MEMBER"))return;
        await db.message.delete({where:{id:messageId}});
        const dd={id:messageId,channelId:ex.channelId};
        broadcast(ex.channelId,"message:deleted",dd);
        sendTo(userId,"message:deleted",dd);
        }catch{}
      }
      if(event==="typing:start"){
        const{channelId}=data;
        if(!channelId||!client.channels.has(channelId))return;
        const key=userId+":"+channelId;
        broadcast(channelId,"typing:update",{userId,channelId,typing:true},userId);
        const prev=typingTimers.get(key); if(prev)clearTimeout(prev);
        typingTimers.set(key,setTimeout(()=>{
          broadcast(channelId,"typing:update",{userId,channelId,typing:false},userId as string);
          typingTimers.delete(key);
        },3000));
      }
      if(event==="typing:stop"){
        const{channelId}=data; if(!channelId)return;
        const key=userId+":"+channelId;
        const prev=typingTimers.get(key); if(prev)clearTimeout(prev);
        typingTimers.delete(key);
        broadcast(channelId,"typing:update",{userId,channelId,typing:false},userId);
      }
      if(event==="channel:join"){
        const{channelId}=data; if(channelId)client.channels.add(channelId);
      }
      if(event==="status:set"){
        const{status}=data;
        if(["ONLINE","IDLE","DND","OFFLINE"].includes(status)) await setStatus(userId,status);
      }
    });
    socket.on("close", async () => {
      if (userId) {
        for (const [key, timer] of typingTimers.entries()) {
          if (key.startsWith(userId + ":")) {
            clearTimeout(timer); typingTimers.delete(key);
            const chId = key.split(":")[1];
            broadcast(chId,"typing:update",{userId,channelId:chId,typing:false});
          }
        }
        await setStatus(userId,"OFFLINE").catch(()=>{});
      }
      if (clientId) clients.delete(clientId);
    });
  });
}
