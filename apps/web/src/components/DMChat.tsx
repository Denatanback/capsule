import { useState, useEffect, useRef } from "react";
import { useDMStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";
import { useP2PStore } from "../stores/p2pStore";
import { usePresenceStore } from "../stores/presenceStore";
import { send } from "../lib/ws";
import { api } from "../lib/api";
import VoiceRecorder from "./VoiceRecorder";
import VoicePlayer from "./VoicePlayer";

const EMPTY: any[] = [];

export default function DMChat() {
  const activeDMId = useDMStore((s) => s.activeDMId);
  const msgs = useDMStore((s) => s.messages[activeDMId || ""] ?? EMPTY);
  const loading = useDMStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const requestP2P = useP2PStore((s) => s.requestP2P);
  const p2pStatus = useP2PStore((s) => s.p2pStatus);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const channels = useDMStore((s) => s.channels);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [forwardedId, setForwardedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevDMRef = useRef<string | null>(null);

  // Fetch messages when DM changes
  useEffect(() => {
    if (activeDMId) useDMStore.getState().fetchMessages(activeDMId);
  }, [activeDMId]);

  // Scroll: instant on DM switch, smooth on new messages
  useEffect(() => {
    if (!bottomRef.current) return;
    const isDMSwitch = prevDMRef.current !== activeDMId;
    prevDMRef.current = activeDMId;
    bottomRef.current.scrollIntoView({ behavior: isDMSwitch ? "instant" : "smooth" });
  }, [activeDMId, msgs.length]);

  const doSend = async () => {
    // Send files first as messages with content
    if (pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const content = text.trim() || `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        send("dm:send", { dmChannelId: activeDMId, content });
      }
      setPendingFiles([]);
      setText("");
      return;
    }
    if (!text.trim() || !activeDMId) return;
    send("dm:send", { dmChannelId: activeDMId, content: text.trim() });
    setText("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
  };

  const startEdit = (m: any) => { setEditingId(m.id); setEditText(m.content); };
  const doEdit = () => {
    if (editText.trim()) { send("dm:edit", { messageId: editingId, content: editText.trim() }); setEditingId(null); }
  };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const doDelete = (id: string) => { send("dm:delete", { messageId: id }); };
  const fmtTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!activeDMId) return null;

  const ch = channels.find((c: any) => c.id === activeDMId);
  const otherUser = ch ? (ch.userA?.id === user?.id ? ch.userB : ch.userA) : null;
  const peerOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            {otherUser?.displayName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          {peerOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2" style={{ borderColor: "var(--bg-primary)" }} />}
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{otherUser?.displayName || "DM"}</p>
          <p className="text-[10px]" style={{ color: peerOnline ? "var(--success)" : "var(--text-muted)" }}>
            {peerOnline ? "Online" : "Offline"}
          </p>
        </div>
        {peerOnline && p2pStatus === "idle" && (
          <button onClick={() => otherUser && requestP2P(otherUser.id)}
            className="ml-auto px-3 py-1 text-xs font-bold text-white rounded-xl hover-lift"
            style={{ background: "var(--accent)" }}>
            🔒 Secure Link
          </button>
        )}
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-500/10 border-2 border-dashed border-indigo-500 rounded-lg">
          <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>Drop files here</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && msgs.length === 0 && <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading...</p>}
        {!loading && msgs.length === 0 && (
          <div className="text-center py-12">
            <span className="text-3xl mb-2 block">👋</span>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Start a conversation with {otherUser?.displayName || "this user"}
            </p>
          </div>
        )}
        {msgs.map((msg: any) => (
          <div key={msg.id} className="group flex items-start gap-3 py-1.5 px-3 rounded-lg transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
              {msg.author?.displayName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{msg.author?.displayName}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmtTime(msg.createdAt)}</span>
                {msg.editedAt && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>(edited)</span>}
              </div>
              {editingId === msg.id ? (
                <div className="flex gap-2 mt-1">
                  <input value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") cancelEdit(); }}
                    className="flex-1 px-2 py-1 text-sm border rounded outline-none"
                    style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    autoFocus />
                  <button onClick={doEdit} className="text-xs" style={{ color: "var(--success)" }}>Save</button>
                  <button onClick={cancelEdit} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              ) : (
                <>
                  {msg.voiceUrl && <VoicePlayer url={msg.voiceUrl} />}
                  {msg.content && <p className="text-sm break-words whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{msg.content}</p>}
                </>
              )}
            </div>
            {editingId !== msg.id && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                <button onClick={async () => {
                  try { await api.forwardToNotes(undefined, msg.id); setForwardedId(msg.id); setTimeout(() => setForwardedId(null), 1500); } catch {}
                }} className="text-xs px-1" style={{ color: forwardedId === msg.id ? "var(--success)" : "var(--text-muted)" }}>
                  {forwardedId === msg.id ? "✅" : "📌"}
                </button>
                {msg.author?.id === user?.id && (
                  <>
                    <button onClick={() => startEdit(msg)} className="text-xs px-1" style={{ color: "var(--text-muted)" }}>edit</button>
                    <button onClick={() => doDelete(msg.id)} className="text-xs px-1" style={{ color: "var(--danger)" }}>del</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-2" style={{ borderColor: "var(--border)" }}>
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
              📎 {f.name}
              <button onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                className="ml-1" style={{ color: "var(--danger)" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2 items-center">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl transition-colors"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
            title="Attach file">📎</button>
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) setPendingFiles((prev) => [...prev, file]);
                  return;
                }
              }
            }}
            placeholder={otherUser ? `Message ${otherUser.displayName}...` : "Message..."}
            className="flex-1 px-4 py-2.5 rounded-xl outline-none text-sm font-medium transition-all focus:ring-2 focus:ring-indigo-500/30"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <VoiceRecorder onRecorded={(voiceUrl) => {
            if (activeDMId) send("dm:send", { dmChannelId: activeDMId, content: "", voiceUrl });
          }} />
          <button onClick={doSend} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover-lift"
            style={{ background: "var(--accent)" }}>Send</button>
        </div>
      </div>
    </div>
  );
}
