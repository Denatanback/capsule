import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useNotificationStore } from "../stores/notificationStore";
import { api } from "../lib/api";
import VoicePanel from "./VoicePanel";

export default function ChannelList({ onOpenSplit, splitChannelId }: { onOpenSplit?: (id: string) => void; splitChannelId?: string | null }) {
  const detail = useServerStore((s) => s.serverDetail);
  const channelUnreads = useNotificationStore((s) => s.channelUnreads);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const selectChannel = useServerStore((s) => s.selectChannel);
  const createChannel = useServerStore((s) => s.createChannel);
  const deleteChannel = useServerStore((s) => s.deleteChannel);
  const leaveServer = useServerStore((s) => s.leaveServer);
  const deleteServer = useServerStore((s) => s.deleteServer);
  const voiceJoin = useVoiceStore((s) => s.join);
  const voiceChId = useVoiceStore((s) => s.activeChannelId);
  const voiceUsers = useVoiceStore((s) => s.users);
  const [showAdd, setShowAdd] = useState(false);
  const [chName, setChName] = useState("");
  const [chType, setChType] = useState("TEXT");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);

  if (!detail) return null;
  const isAdmin = detail.myRole === "OWNER" || detail.myRole === "ADMIN";
  const textChs = detail.channels?.filter((c) => c.type === "TEXT" || !c.type) || [];
  const voiceChs = detail.channels?.filter((c) => c.type === "VOICE") || [];

  const handleAdd = async () => {
    if (!chName.trim()) return;
    const slug = chName.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      await createChannel(slug, chType);
      setShowAdd(false);
      setChName("");
      setChType("TEXT");
    } catch (e) {}
  };

  return (
    <div className="w-60 bg-gray-100 dark:bg-gray-900 flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-800">
      <div className="h-12 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
        <span className="font-bold text-sm truncate">{detail.name}</span>
        <button onClick={async () => {
          const reveal = async (code: string) => {
            setInviteCode(code);
            try {
              if (window.isSecureContext && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(code);
              } else {
                window.prompt("Copy invite code", code);
              }
            } catch {
              window.prompt("Copy invite code", code);
            }
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
          };
          if (inviteCode) {
            await reveal(inviteCode);
            return;
          }
          try {
            const r = await api.createInvite(detail.id, {});
            const code = r?.invite?.code || r?.code;
            if (code) await reveal(code);
          } catch {}
        }} className="text-xs text-indigo-500 hover:text-indigo-600" title={inviteCode ? "Click to copy" : "Create invite"}>
          {inviteCopied ? "✅ Copied!" : inviteCode ? `📋 ${inviteCode}` : "Invite"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Text channels */}
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase">Text Channels</span>
          {isAdmin && (
            <button onClick={() => setShowAdd(!showAdd)} className="text-gray-400 hover:text-indigo-500 text-lg">+</button>
          )}
        </div>

        {showAdd && (
          <div className="px-2 mb-2 space-y-1">
            <input value={chName} onChange={(e) => setChName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="channel-name"
              className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 outline-none"
              autoFocus />
            <div className="flex gap-1">
              <button onClick={() => setChType("TEXT")}
                className={"px-2 py-0.5 text-xs rounded " + (chType === "TEXT" ? "bg-indigo-500 text-white" : "bg-gray-200 dark:bg-gray-700")}>Text</button>
              <button onClick={() => setChType("VOICE")}
                className={"px-2 py-0.5 text-xs rounded " + (chType === "VOICE" ? "bg-indigo-500 text-white" : "bg-gray-200 dark:bg-gray-700")}>Voice</button>
              <button onClick={handleAdd} className="px-2 py-0.5 text-xs rounded bg-green-500 text-white ml-auto">Add</button>
            </div>
          </div>
        )}

        {textChs.map((ch) => (
          <div key={ch.id}
            className={"flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer group " +
              (activeChannelId === ch.id
                ? "bg-gray-300 dark:bg-gray-700 font-medium"
                : splitChannelId === ch.id
                ? "bg-indigo-500/20 font-medium"
                : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400")}>
            <span onClick={() => selectChannel(ch.id)} className={"flex-1 truncate " + (channelUnreads[ch.id] ? "font-bold text-white" : "")}>
              # {ch.name}
            </span>
            {channelUnreads[ch.id] > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 shrink-0">
                {channelUnreads[ch.id]}
              </span>
            )}
            {onOpenSplit && activeChannelId !== ch.id && (
              <button onClick={(e) => { e.stopPropagation(); onOpenSplit(ch.id); }}
                className="opacity-0 group-hover:opacity-100 text-[10px] ml-1 px-1 rounded"
                style={{ color: "var(--accent)" }}
                title="Open in split view">◫</button>
            )}
            {isAdmin && detail.channels.length > 1 && (
              <button onClick={() => deleteChannel(ch.id)}
                className="text-red-400 opacity-0 group-hover:opacity-100 text-xs ml-1">x</button>
            )}
          </div>
        ))}

        {/* Voice channels */}
        {(voiceChs.length > 0 || isAdmin) && (
          <div className="mt-3">
            <div className="flex items-center px-2 mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">Voice Channels</span>
            </div>
            {voiceChs.map((ch) => {
              const inThis = voiceChId === ch.id;
              const count = inThis ? voiceUsers.length : 0;
              return (
                <div key={ch.id} className="flex items-center justify-between px-2 py-1.5 rounded text-sm group hover:bg-gray-200 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    <span className={"truncate " + (inThis ? "text-green-500 font-medium" : "text-gray-600 dark:text-gray-400")}>{ch.name}</span>
                    {count > 0 && <span className="text-xs text-green-500 ml-1">({count})</span>}
                  </div>
                  {!inThis && (
                    <button onClick={() => voiceJoin(ch.id)}
                      className="text-xs font-medium px-2 py-0.5 rounded-md transition-colors text-green-500 hover:bg-green-500 hover:text-white"
                      style={{ background: "var(--bg-tertiary)" }}>Join</button>
                  )}
                  {inThis && (
                    <span className="text-[10px] text-green-500 font-medium">Connected</span>
                  )}
                  {isAdmin && (
                    <button onClick={() => deleteChannel(ch.id)}
                      className="text-red-400 opacity-0 group-hover:opacity-100 text-xs ml-1">x</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VoicePanel />

      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        {detail.myRole === "OWNER" ? (
          <button onClick={() => { if (confirm("Delete server?")) deleteServer(detail.id); }}
            className="w-full text-xs text-red-500 hover:text-red-600 py-1">Delete Server</button>
        ) : (
          <button onClick={() => leaveServer(detail.id)}
            className="w-full text-xs text-gray-500 hover:text-red-500 py-1">Leave Server</button>
        )}
      </div>
    </div>
  );
}
