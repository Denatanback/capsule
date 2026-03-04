import { useState, useEffect, useRef, useCallback } from "react";
import { useMessageStore } from "../stores/messageStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useServerStore } from "../stores/serverStore";
import { connectWs, on, send } from "../lib/ws";
import { useNotificationStore } from "../stores/notificationStore";
import FileUpload from "./FileUpload";
import FilePreview from "./FilePreview";
import Avatar from "./Avatar";

const EMPTY: any[] = [];

export default function ChatArea({ channelId }) {
  const user = useAuthStore((s) => s.user);
  const msgs = useMessageStore((s) => s.messages[channelId || ""] ?? EMPTY);
  const loading = useMessageStore((s) => s.loading);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const editMessage = useMessageStore((s) => s.editMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const onNew = useMessageStore((s) => s.onNew);
  const onEdited = useMessageStore((s) => s.onEdited);
  const onDeleted = useMessageStore((s) => s.onDeleted);
  const setOnlineUsers = usePresenceStore((s) => s.setOnlineUsers);
  const onPresence = usePresenceStore((s) => s.onPresence);
  const onTyping = usePresenceStore((s) => s.onTyping);
  const typingUsers = usePresenceStore((s) => s.typingUsers[channelId || ""] ?? EMPTY);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const markChannelRead = useNotificationStore((s) => s.markChannelRead);
  const onNewMessage = useNotificationStore((s) => s.onNewMessage);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const bottomRef = useRef(null);
  const typingRef = useRef(null);

  useEffect(() => {
    connectWs();
    const a = on("auth:ok", (d) => { if (d.onlineUsers) setOnlineUsers(d.onlineUsers); });
    const b = on("message:new", onNew);
    const c = on("message:edited", onEdited);
    const d = on("message:deleted", onDeleted);
    const e = on("presence", onPresence);
    const f = on("typing:update", onTyping);
    return () => { a(); b(); c(); d(); e(); f(); };
  }, []);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
      send("channel:join", { channelId });
      markChannelRead(channelId);
    }
  }, [channelId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

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
    setText("");
    setPendingFiles([]);
    send("typing:stop", { channelId });
    if (typingRef.current) clearTimeout(typingRef.current);
  };

  const onFileUploaded = (file) => {
    setPendingFiles((prev) => [...prev, file]);
  };

  const removePending = (uuid) => {
    setPendingFiles((prev) => prev.filter((f) => f.uuid !== uuid));
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.content); };
  const doEdit = () => { if (editText.trim()) { editMessage(editingId, editText.trim()); setEditingId(null); } };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const otherTyping = typingUsers.filter((id) => id !== user?.id);

  if (!channelId) return <div className="flex-1 flex items-center justify-center text-gray-400">Select a channel</div>;
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && msgs.length === 0 && <p className="text-gray-400 text-sm text-center">Loading...</p>}
        {msgs.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-3 py-1.5 px-3 msg-enter rounded-lg transition-colors"
            style={{ ["--tw-bg-opacity" as any]: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Avatar name={msg.author?.displayName} id={msg.author?.id} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{msg.author?.displayName}</span>
                <span className="text-xs text-gray-400">{fmtTime(msg.createdAt)}</span>
                {msg.editedAt && <span className="text-xs text-gray-400">(edited)</span>}
              </div>
              {editingId === msg.id ? (
                <div className="flex gap-2 mt-1">
                  <input value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") cancelEdit(); }}
                    className="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 outline-none" autoFocus />
                  <button onClick={doEdit} className="text-xs text-green-500">Save</button>
                  <button onClick={cancelEdit} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <>
                  {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                  {msg.attachments?.map((f) => <FilePreview key={f.id} file={f} />)}
                </>
              )}
            </div>
            {msg.author?.id === user?.id && editingId !== msg.id && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                <button onClick={() => startEdit(msg)} className="text-xs text-gray-400 hover:text-blue-500 px-1">edit</button>
                <button onClick={() => deleteMessage(msg.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">del</button>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {otherTyping.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-400 italic">
          {otherTyping.length === 1 ? "Someone is typing..." : otherTyping.length + " people typing..."}
        </div>
      )}
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-2">
          {pendingFiles.map((f) => (
            <div key={f.uuid} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
              <span className="truncate max-w-[120px]">{f.filename}</span>
              <button onClick={() => removePending(f.uuid)} className="text-red-400 hover:text-red-500">x</button>
            </div>
          ))}
        </div>
      )}
      <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2 items-center">
          <FileUpload serverId={serverDetail?.id} channelId={channelId} onUploaded={onFileUploaded} />
          <input value={text} onChange={(e) => { setText(e.target.value); emitTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            placeholder="Message..."
            className="flex-1 px-4 py-2.5 rounded-xl outline-none text-sm font-medium transition-all focus:ring-2 focus:ring-indigo-500/30"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={doSend} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover-lift"
            style={{ background: "var(--accent)" }}>Send</button>
        </div>
      </div>
    </div>
  );
}
