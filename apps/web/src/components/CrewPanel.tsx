import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useAuthStore } from "../stores/authStore";
import { useVoiceStore } from "../stores/voiceStore";
import { api } from "../lib/api";
import { send } from "../lib/ws";

export default function CrewPanel() {
  const sd = useServerStore((s) => s.serverDetail);
  const selectServer = useServerStore((s) => s.selectServer);
  const onl = usePresenceStore((s) => s.onlineUsers);
  const me = useAuthStore((s) => s.user);
  const voiceChId = useVoiceStore((s) => s.activeChannelId);
  const members = sd?.members || [];
  const myRole = sd?.myRole;
  const isOwner = myRole === "OWNER";
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const onM = members.filter((m: any) => onl.includes(m.userId));
  const offM = members.filter((m: any) => !onl.includes(m.userId));
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  const refresh = () => { if (sd?.id) selectServer(sd.id); };
  const kick = async (uid: string) => { if (!sd || !confirm("Kick?")) return; try { await api.kickMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); } };
  const ban = async (uid: string) => { if (!sd) return; const r = prompt("Ban reason:"); if (r === null) return; try { await api.banMember(sd.id, uid, r || undefined); refresh(); } catch (e: any) { alert(e.message); } };
  const promote = async (uid: string) => { if (!sd || !confirm("Promote?")) return; try { await api.promoteMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); } };
  const demote = async (uid: string) => { if (!sd || !confirm("Demote?")) return; try { await api.demoteMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); } };
  const transfer = async (uid: string) => { if (!sd || !confirm("Transfer ownership?")) return; try { await api.transferOwnership(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); } };

  const inviteToVoice = (uid: string) => {
    if (!voiceChId) return;
    send("voice:invite", { targetUserId: uid, channelId: voiceChId });
    setInvitedId(uid); setTimeout(() => setInvitedId(null), 2000);
  };

  const roleBadge = (role: string) => {
    if (role === "OWNER") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-amber-500" style={{ background: "rgba(245,158,11,0.1)" }}>captain</span>;
    if (role === "ADMIN") return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>officer</span>;
    return null;
  };

  const Row = ({ m, online }: { m: any; online: boolean }) => {
    const isMe = m.userId === me?.id;
    const canManage = isAdmin && !isMe && m.role !== "OWNER";
    const showMenu = menuFor === m.id;
    const canInviteVoice = voiceChId && online && !isMe;
    const grad = ["avatar-gradient-1","avatar-gradient-2","avatar-gradient-3","avatar-gradient-4"][m.userId.charCodeAt(0) % 4];

    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl group transition-colors cursor-default relative"
        onClick={() => canManage && setMenuFor(showMenu ? null : m.id)}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <div className="relative shrink-0">
          <div className={"w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold " + grad}>
            {m.user?.displayName?.charAt(0)?.toUpperCase()}
          </div>
          <div className={"absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 " + (online ? "bg-green-500" : "bg-gray-500")}
            style={{ borderColor: "var(--bg-secondary)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={"text-xs font-medium truncate " + (online ? "" : "opacity-50")} style={{ color: "var(--text-primary)" }}>
              {m.user?.displayName}
            </p>
            {roleBadge(m.role)}
          </div>
        </div>
        {canInviteVoice && (
          <button onClick={(e) => { e.stopPropagation(); inviteToVoice(m.userId); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded-full transition-all"
            style={{ color: invitedId === m.userId ? "var(--success)" : "var(--accent)", background: "var(--bg-tertiary)" }}>
            {invitedId === m.userId ? "✓" : "🎙️"}
          </button>
        )}
        {canManage && <span className="text-xs opacity-0 group-hover:opacity-100" style={{ color: "var(--text-muted)" }}>⋯</span>}
        {showMenu && canManage && (
          <div className="absolute right-0 top-8 rounded-xl py-1 min-w-[120px] z-10 fade-in"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}>
            {isOwner && m.role === "MEMBER" && <button onClick={() => { promote(m.userId); setMenuFor(null); }} className="w-full text-left px-3 py-1 text-xs" style={{ color: "var(--accent)" }}>Promote</button>}
            {isOwner && m.role === "ADMIN" && <button onClick={() => { demote(m.userId); setMenuFor(null); }} className="w-full text-left px-3 py-1 text-xs" style={{ color: "var(--warning)" }}>Demote</button>}
            {isOwner && <button onClick={() => { transfer(m.userId); setMenuFor(null); }} className="w-full text-left px-3 py-1 text-xs" style={{ color: "var(--accent)" }}>Transfer</button>}
            <button onClick={() => { kick(m.userId); setMenuFor(null); }} className="w-full text-left px-3 py-1 text-xs" style={{ color: "var(--warning)" }}>Kick</button>
            <button onClick={() => { ban(m.userId); setMenuFor(null); }} className="w-full text-left px-3 py-1 text-xs" style={{ color: "var(--danger)" }}>Ban</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-52 border-l overflow-y-auto p-2 shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
      {onM.length > 0 && <>
        <p className="text-[10px] uppercase font-bold tracking-wider px-2 mb-1" style={{ color: "var(--text-muted)" }}>
          Online — {onM.length}
        </p>
        {onM.map((m: any) => <Row key={m.id} m={m} online={true} />)}
      </>}
      {offM.length > 0 && <>
        <p className="text-[10px] uppercase font-bold tracking-wider px-2 mb-1 mt-3" style={{ color: "var(--text-muted)" }}>
          Offline — {offM.length}
        </p>
        {offM.map((m: any) => <Row key={m.id} m={m} online={false} />)}
      </>}
    </div>
  );
}
