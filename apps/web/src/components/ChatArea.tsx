import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMessageStore } from "../stores/messageStore";
import { useServerStore } from "../stores/serverStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { send } from "../lib/ws";
import { api } from "../lib/api";
import FileUpload from "./FileUpload";
import FilePreview from "./FilePreview";
import Avatar from "./Avatar";
import VoiceRecorder from "./VoiceRecorder";
import VoicePlayer from "./VoicePlayer";
import { useNotificationStore } from "../stores/notificationStore";

const BUBBLE_THRESHOLD = 120; // chars — shorter = bubble, longer = classic

export default function ChatArea({ channelId }: { channelId: string | null }) {
  const allMsgs = useMessageStore((s) => s.messages);
  const loading = useMessageStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const typingUsers = usePresenceStore((s) => s.typingUsers);
  const storeRefs = useRef({
    fetchMessages: useMessageStore.getState().fetchMessages,
    editMessage: useMessageStore.getState().editMessage,
    deleteMessage: useMessageStore.getState().deleteMessage,
    markChannelRead: useNotificationStore.getState().markChannelRead,
  });
  const msgs = useMemo(() => allMsgs[channelId || ""] || [], [allMsgs, channelId]);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [forwardedId, setForwardedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<any>(null);
  const prevChannelRef = useRef<string | null>(null);

  useEffect(() => {
    if (channelId) {
      storeRefs.current.fetchMessages(channelId);
      send("channel:join", { channelId });
      storeRefs.current.markChannelRead(channelId);
    }
  }, [channelId]);

  useEffect(() => {
    if (!bottomRef.current) return;
    const isSwitch = prevChannelRef.current !== channelId;
    prevChannelRef.current = channelId;
    bottomRef.current.scrollIntoView({ behavior: isSwitch ? "instant" : "smooth" });
  }, [channelId, msgs.length]);

  const emitTyping = useCallback(() => {
    if (!channelId) return;
    send("typing:start", { channelId });
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => send("typing:stop", { channelId }), 2000);
  }, [channelId]);

  const doSend = () => {
    if ((!text.trim() && pendingFiles.length === 0) || !channelId) return;
    const fileIds = pendingFiles.map((f) => f.uuid);
    send("message:send", { channelId, content: text.trim(), fileIds });
    setText(""); setPendingFiles([]);
    send("typing:stop", { channelId });
    if (typingRef.current) clearTimeout(typingRef.current);
  };

  const sendVoice = (voiceUrl: string) => {
    if (!channelId) return;
    send("message:send", { channelId, content: "", voiceUrl });
  };

  const onFileUploaded = (file: any) => setPendingFiles((prev) => [...prev, file]);
  const removePending = (uuid: string) => setPendingFiles((prev) => prev.filter((f) => f.uuid !== uuid));

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && serverDetail?.id && channelId) {
          try { const res = await api.uploadFile(file, serverDetail.id, channelId); setPendingFiles((prev) => [...prev, res.file]); } catch {}
        }
        return;
      }
    }
  };

  const startEdit = (m: any) => { setEditingId(m.id); setEditText(m.content); };
  const doEdit = () => { if (editText.trim()) { storeRefs.current.editMessage(editingId!, editText.trim()); setEditingId(null); } };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!channelId) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a thread</p>
    </div>
  );

  const typers = typingUsers[channelId]?.filter((u: any) => u !== user?.id) || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading && msgs.length === 0 && <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading...</p>}
        {msgs.map((msg: any) => {
          const isOwn = msg.author?.id === user?.id;
          const isShort = ((msg.content?.length || 0) <= BUBBLE_THRESHOLD && !msg.attachments?.length) || msg.voiceUrl;

          return isShort ? (
            /* BUBBLE style for short messages */
            <div key={msg.id} className="flex msg-enter group" style={{ justifyContent: isOwn ? "flex-end" : "flex-start" }}>
              {!isOwn && (
                <Avatar name={msg.author?.displayName} id={msg.author?.id} avatarUrl={msg.author?.avatarUrl} size="sm" className="mr-2 mt-1 shrink-0" />
              )}
              <div className="max-w-[65%]">
                {!isOwn && (
                  <span className="text-[10px] font-semibold ml-1 block mb-0.5" style={{ color: "var(--accent)" }}>
                    {msg.author?.displayName}
                  </span>
                )}
                {editingId === msg.id ? (
                  <div className="flex gap-1">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="input-capsule flex-1 px-3 py-1.5 text-sm" autoFocus />
                    <button onClick={doEdit} className="text-xs" style={{ color: "var(--success)" }}>✓</button>
                  </div>
                ) : (
                  <div className={"relative px-3.5 py-2 text-sm break-words " + (isOwn ? "msg-bubble-own" : "msg-bubble-other")}
                    style={!isOwn ? { color: "var(--text-primary)" } : {}}>
                    {msg.voiceUrl && <VoicePlayer url={msg.voiceUrl} />}
                    {msg.content && <span>{msg.content}</span>}
                    <span className={"text-[9px] ml-2 " + (isOwn ? "text-white/60" : "")}
                      style={!isOwn ? { color: "var(--text-muted)" } : {}}>{fmtTime(msg.createdAt)}</span>
                    {msg.editedAt && <span className="text-[9px] ml-1" style={{ color: isOwn ? "rgba(255,255,255,0.4)" : "var(--text-muted)" }}>edited</span>}
                  </div>
                )}
                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-0.5 px-1 transition-opacity" style={{ justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                  <button onClick={async () => {
                    try { await api.forwardToNotes(msg.id); setForwardedId(msg.id); setTimeout(() => setForwardedId(null), 1500); } catch {}
                  }} className="text-[10px] px-1" style={{ color: forwardedId === msg.id ? "var(--success)" : "var(--text-muted)" }}>
                    {forwardedId === msg.id ? "✓" : "📌"}
                  </button>
                  {isOwn && <>
                    <button onClick={() => startEdit(msg)} className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>edit</button>
                    <button onClick={() => storeRefs.current.deleteMessage(msg.id)} className="text-[10px] px-1" style={{ color: "var(--danger)" }}>del</button>
                  </>}
                </div>
              </div>
            </div>
          ) : (
            /* CLASSIC style for long messages / attachments */
            <div key={msg.id} className="group flex items-start gap-3 py-2 px-3 rounded-xl msg-enter transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Avatar name={msg.author?.displayName} id={msg.author?.id} avatarUrl={msg.author?.avatarUrl} size="sm" className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm" style={{ color: "var(--accent)" }}>{msg.author?.displayName}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmtTime(msg.createdAt)}</span>
                  {msg.editedAt && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>(edited)</span>}
                </div>
                {editingId === msg.id ? (
                  <div className="flex gap-2 mt-1">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="input-capsule flex-1 px-3 py-1.5 text-sm" autoFocus />
                    <button onClick={doEdit} className="text-xs" style={{ color: "var(--success)" }}>Save</button>
                    <button onClick={cancelEdit} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    {msg.voiceUrl && <VoicePlayer url={msg.voiceUrl} />}
                    {msg.content && <p className="text-sm break-words whitespace-pre-wrap mt-0.5" style={{ color: "var(--text-primary)" }}>{msg.content}</p>}
                    {msg.attachments?.map((f: any) => <FilePreview key={f.id} file={f} />)}
                  </>
                )}
              </div>
              {editingId !== msg.id && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0 transition-opacity">
                  <button onClick={async () => {
                    try { await api.forwardToNotes(msg.id); setForwardedId(msg.id); setTimeout(() => setForwardedId(null), 1500); } catch {}
                  }} className="text-[10px] px-1" style={{ color: forwardedId === msg.id ? "var(--success)" : "var(--text-muted)" }}>
                    {forwardedId === msg.id ? "✓" : "📌"}
                  </button>
                  {isOwn && <>
                    <button onClick={() => startEdit(msg)} className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>edit</button>
                    <button onClick={() => storeRefs.current.deleteMessage(msg.id)} className="text-[10px] px-1" style={{ color: "var(--danger)" }}>del</button>
                  </>}
                </div>
              )}
            </div>
          );
        })}
        {typers.length > 0 && (
          <p className="text-xs px-3 py-1" style={{ color: "var(--text-muted)" }}>
            {typers.length === 1 ? "Someone is typing..." : `${typers.length} typing...`}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-2" style={{ borderColor: "var(--border)" }}>
          {pendingFiles.map((f) => (
            <div key={f.uuid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
              <span className="truncate max-w-[120px]">{f.filename}</span>
              <button onClick={() => removePending(f.uuid)} style={{ color: "var(--danger)" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2 items-center">
          <FileUpload serverId={serverDetail?.id} channelId={channelId} onUploaded={onFileUploaded} />
          <input value={text} onChange={(e) => { setText(e.target.value); emitTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            onPaste={handlePaste}
            placeholder="Message this thread..."
            className="input-capsule flex-1 px-4 py-2.5 text-sm font-medium" />
          <VoiceRecorder onRecorded={sendVoice} />
          <button onClick={doSend} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover-lift"
            style={{ background: "var(--accent)" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// end of ChatArea
