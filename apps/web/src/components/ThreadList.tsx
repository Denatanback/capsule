import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useNotificationStore } from "../stores/notificationStore";
import { api } from "../lib/api";
import VoicePanel from "./VoicePanel";

export default function ThreadList({ onOpenSplit, splitChannelId }: { onOpenSplit?: (id: string) => void; splitChannelId?: string | null }) {
  const detail = useServerStore((s) => s.serverDetail);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const selectChannel = useServerStore((s) => s.selectChannel);
  const createChannel = useServerStore((s) => s.createChannel);
  const deleteChannel = useServerStore((s) => s.deleteChannel);
  const deleteServer = useServerStore((s) => s.deleteServer);
  const leaveServer = useServerStore((s) => s.leaveServer);
  const voiceChId = useVoiceStore((s) => s.activeChannelId);
  const voiceUsers = useVoiceStore((s) => s.users);
  const voiceJoin = useVoiceStore((s) => s.join);
  const channelUnreads = useNotificationStore((s) => s.channelUnreads);
  const [showAdd, setShowAdd] = useState(false);
  const [chName, setChName] = useState("");
  const [chType, setChType] = useState("TEXT");
  const [inviteCopied, setInviteCopied] = useState(false);

  if (!detail) return null;
  const isAdmin = detail.myRole === "OWNER" || detail.myRole === "ADMIN";
  const textChs = detail.channels?.filter((c: any) => c.type === "TEXT") || [];
  const voiceChs = detail.channels?.filter((c: any) => c.type === "VOICE") || [];

  const handleAdd = () => {
    if (chName.trim()) { createChannel(detail.id, chName.trim(), chType); setChName(""); setShowAdd(false); }
  };

  const handleInvite = async () => {
    try {
      const res = await api.createInvite(detail.id, null, null);
      await navigator.clipboard.writeText(res.code || res.invite?.code);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Capsule header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{detail.name}</h3>
        <button onClick={handleInvite}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
          style={{ background: inviteCopied ? "var(--success)" : "var(--accent-soft)", color: inviteCopied ? "white" : "var(--accent)" }}>
          {inviteCopied ? "Copied!" : "Invite"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* Threads header */}
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Threads</span>
          {isAdmin && (
            <button onClick={() => setShowAdd(!showAdd)} className="text-sm font-bold transition-colors"
              style={{ color: "var(--text-muted)" }}>+</button>
          )}
        </div>

        {/* Add thread form */}
        {showAdd && (
          <div className="px-2 py-2 rounded-xl mb-2 space-y-2" style={{ background: "var(--bg-tertiary)" }}>
            <input value={chName} onChange={(e) => setChName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Thread name..." className="input-capsule w-full px-3 py-1.5 text-xs" autoFocus />
            <div className="flex gap-1">
              <button onClick={() => setChType("TEXT")}
                className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (chType === "TEXT" ? "text-white" : "")}
                style={chType === "TEXT" ? { background: "var(--accent)" } : { color: "var(--text-muted)" }}>Text</button>
              <button onClick={() => setChType("VOICE")}
                className={"px-2 py-0.5 rounded-full text-[10px] font-semibold " + (chType === "VOICE" ? "text-white" : "")}
                style={chType === "VOICE" ? { background: "var(--accent)" } : { color: "var(--text-muted)" }}>Voice Pod</button>
              <button onClick={handleAdd} className="px-2 py-0.5 text-[10px] rounded-full text-white font-bold ml-auto"
                style={{ background: "var(--accent)" }}>Add</button>
            </div>
          </div>
        )}

        {/* Text threads */}
        {textChs.map((ch: any) => (
          <div key={ch.id}
            className={"flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm cursor-pointer group transition-all " +
              (activeChannelId === ch.id ? "font-medium" : "") +
              (splitChannelId === ch.id ? " ring-1" : "")}
            style={activeChannelId === ch.id
              ? { background: "var(--accent-soft)", color: "var(--accent)" }
              : splitChannelId === ch.id
              ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--accent)" }
              : { color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { if (activeChannelId !== ch.id) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { if (activeChannelId !== ch.id && splitChannelId !== ch.id) e.currentTarget.style.background = "transparent"; }}>
            <span onClick={() => selectChannel(ch.id)} className={"flex-1 truncate " + (channelUnreads[ch.id] ? "font-bold" : "")}>
              ⟡ {ch.name}
            </span>
            {channelUnreads[ch.id] > 0 && (
              <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                style={{ background: "var(--danger)" }}>
                {channelUnreads[ch.id]}
              </span>
            )}
            {onOpenSplit && activeChannelId !== ch.id && (
              <button onClick={(e) => { e.stopPropagation(); onOpenSplit(ch.id); }}
                className="opacity-0 group-hover:opacity-100 text-[10px] px-1 rounded transition-opacity"
                style={{ color: "var(--accent)" }}
                title="Open in dual view">◧</button>
            )}
            {isAdmin && detail.channels.length > 1 && (
              <button onClick={() => deleteChannel(ch.id)}
                className="opacity-0 group-hover:opacity-100 text-xs" style={{ color: "var(--danger)" }}>×</button>
            )}
          </div>
        ))}

        {/* Voice pods */}
        {voiceChs.length > 0 && (
          <div className="mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2" style={{ color: "var(--text-muted)" }}>Voice Pods</span>
            {voiceChs.map((ch: any) => {
              const inThis = voiceChId === ch.id;
              return (
                <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm group transition-colors mt-0.5"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span className="text-xs">🎙️</span>
                  <span className={"flex-1 truncate " + (inThis ? "font-medium text-green-500" : "")}
                    style={!inThis ? { color: "var(--text-secondary)" } : {}}>
                    {ch.name}
                  </span>
                  {inThis
                    ? <span className="text-[10px] font-medium text-green-500">Connected</span>
                    : <button onClick={() => voiceJoin(ch.id)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white transition-colors"
                        style={{ background: "var(--success)" }}>Join</button>
                  }
                  {isAdmin && (
                    <button onClick={() => deleteChannel(ch.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs" style={{ color: "var(--danger)" }}>×</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VoicePanel />

      {/* Capsule actions */}
      <div className="px-3 py-2 border-t text-center space-y-1" style={{ borderColor: "var(--border)" }}>
        {detail.myRole === "OWNER" ? (
          <button onClick={() => { if (confirm("Delete this capsule?")) deleteServer(detail.id); }}
            className="text-[10px] font-medium" style={{ color: "var(--danger)" }}>Delete Capsule</button>
        ) : (
          <button onClick={() => leaveServer(detail.id)}
            className="text-[10px] font-medium" style={{ color: "var(--danger)" }}>Leave Capsule</button>
        )}
      </div>
    </div>
  );
}
