import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useAuthStore } from "../stores/authStore";
import { useVoiceStore } from "../stores/voiceStore";
import { api } from "../lib/api";
import { send } from "../lib/ws";

export default function MemberList() {
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

  const kick = async (uid: string) => {
    if (!sd || !confirm("Kick this member?")) return;
    try { await api.kickMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); }
  };
  const ban = async (uid: string) => {
    if (!sd) return;
    const reason = prompt("Ban reason (optional):");
    if (reason === null) return;
    try { await api.banMember(sd.id, uid, reason || undefined); refresh(); } catch (e: any) { alert(e.message); }
  };
  const promote = async (uid: string) => {
    if (!sd || !confirm("Promote to Admin?")) return;
    try { await api.promoteMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); }
  };
  const demote = async (uid: string) => {
    if (!sd || !confirm("Demote to Member?")) return;
    try { await api.demoteMember(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); }
  };
  const transfer = async (uid: string) => {
    if (!sd || !confirm("Transfer ownership? You will become Admin.")) return;
    try { await api.transferOwnership(sd.id, uid); refresh(); } catch (e: any) { alert(e.message); }
  };

  const inviteToVoice = (uid: string) => {
    if (!voiceChId) return;
    send("voice:invite", { targetUserId: uid, channelId: voiceChId });
    setInvitedId(uid);
    setTimeout(() => setInvitedId(null), 2000);
  };

  const Row = ({ m, g }: { m: any; g: boolean }) => {
    const isMe = m.userId === me?.id;
    const canManage = isAdmin && !isMe && m.role !== "OWNER";
    const showMenu = menuFor === m.id;
    const canInviteVoice = voiceChId && g && !isMe;

    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 relative group"
        onClick={() => canManage && setMenuFor(showMenu ? null : m.id)}>
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold">
            {m.user?.displayName?.charAt(0)?.toUpperCase()}
          </div>
          <div className={"absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 " + (g ? "bg-green-500" : "bg-gray-400")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={"text-xs truncate " + (g ? "" : "text-gray-400")} style={g ? { color: "var(--text-primary)" } : {}}>
            {m.user?.displayName}
          </p>
          {m.role !== "MEMBER" && <p className={"text-[10px] " + (m.role === "OWNER" ? "text-yellow-500" : "text-indigo-400")}>{m.role.toLowerCase()}</p>}
        </div>
        {/* Voice invite button */}
        {canInviteVoice && (
          <button
            onClick={(e) => { e.stopPropagation(); inviteToVoice(m.userId); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded transition-all"
            style={{ color: invitedId === m.userId ? "var(--success)" : "var(--accent)", background: "var(--bg-tertiary)" }}
            title="Invite to voice channel">
            {invitedId === m.userId ? "✅" : "🎙️"}
          </button>
        )}
        {canManage && (
          <span className="text-gray-400 text-xs opacity-0 group-hover:opacity-100 cursor-pointer">...</span>
        )}
        {showMenu && canManage && (
          <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10 py-1 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}>
            {isOwner && m.role === "MEMBER" && (
              <button onClick={() => { promote(m.userId); setMenuFor(null); }}
                className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-500">Promote</button>
            )}
            {isOwner && m.role === "ADMIN" && (
              <button onClick={() => { demote(m.userId); setMenuFor(null); }}
                className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-yellow-500">Demote</button>
            )}
            {isOwner && (
              <button onClick={() => { transfer(m.userId); setMenuFor(null); }}
                className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-500">Transfer Owner</button>
            )}
            <button onClick={() => { kick(m.userId); setMenuFor(null); }}
              className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-orange-500">Kick</button>
            <button onClick={() => { ban(m.userId); setMenuFor(null); }}
              className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">Ban</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-52 border-l border-gray-200 dark:border-gray-800 overflow-y-auto p-2 shrink-0"
      style={{ background: "var(--bg-secondary)" }}>
      {onM.length > 0 && <>
        <p className="text-[10px] uppercase font-semibold px-2 mb-1" style={{ color: "var(--text-muted)" }}>Online — {onM.length}</p>
        {onM.map((m: any) => <Row key={m.id} m={m} g={true} />)}
      </>}
      {offM.length > 0 && <>
        <p className="text-[10px] uppercase font-semibold px-2 mb-1 mt-3" style={{ color: "var(--text-muted)" }}>Offline — {offM.length}</p>
        {offM.map((m: any) => <Row key={m.id} m={m} g={false} />)}
      </>}
    </div>
  );
}
