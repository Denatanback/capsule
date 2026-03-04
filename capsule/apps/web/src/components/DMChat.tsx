import { useState, useEffect, useRef } from "react";
import { useDMStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";
import { useP2PStore } from "../stores/p2pStore";
import { usePresenceStore } from "../stores/presenceStore";
import { send, on } from "../lib/ws";

const EMPTY: any[] = [];

export default function DMChat() {
  const activeDMId = useDMStore((s) => s.activeDMId);
  const msgs = useDMStore((s) => s.messages[activeDMId || ""] ?? EMPTY);
  const loading = useDMStore((s) => s.loading);
  const onNew = useDMStore((s) => s.onNew);
  const onEdited = useDMStore((s) => s.onEdited);
  const onDeleted = useDMStore((s) => s.onDeleted);
  const user = useAuthStore((s) => s.user);
  const requestP2P = useP2PStore((s) => s.requestP2P);
  const p2pStatus = useP2PStore((s) => s.p2pStatus);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const channels = useDMStore((s) => s.channels);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const a = on("dm:new", onNew);
    const b = on("dm:edited", onEdited);
    const c = on("dm:deleted", onDeleted);
    return () => { a(); b(); c(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const doSend = () => {
    if (!text.trim() || !activeDMId) return;
    send("dm:send", { dmChannelId: activeDMId, content: text.trim() });
    setText("");
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.content); };
  const doEdit = () => {
    if (editText.trim()) { send("dm:edit", { messageId: editingId, content: editText.trim() }); setEditingId(null); }
  };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const doDelete = (id) => { send("dm:delete", { messageId: id }); };
  const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!activeDMId) return null;

  // Find the other user in this DM
  const ch = channels.find((c) => c.id === activeDMId);
  const otherUser = ch ? (ch.userA?.id === user?.id ? ch.userB : ch.userA) : null;
  const peerOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  return (
    <div className="flex-1 flex flex-col">
      {/* P2P bar */}
      {peerOnline && p2pStatus === "idle" && (
        <div className="px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
          <span className="text-xs text-green-600 dark:text-green-400">Peer is online — start an ephemeral P2P chat?</span>
          <button onClick={() => otherUser && requestP2P(otherUser.id)}
            className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600">Start P2P</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && msgs.length === 0 && <p className="text-gray-400 text-sm text-center">Loading...</p>}
        {msgs.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-3 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
              {msg.author?.displayName?.charAt(0)?.toUpperCase()}
            </div>
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
                <p className="text-sm break-words">{msg.content}</p>
              )}
            </div>
            {msg.author?.id === user?.id && editingId !== msg.id && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                <button onClick={() => startEdit(msg)} className="text-xs text-gray-400 hover:text-blue-500 px-1">edit</button>
                <button onClick={() => doDelete(msg.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">del</button>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            placeholder="Message..."
            className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 border-gray-300 dark:border-gray-600" />
          <button onClick={doSend} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Send</button>
        </div>
      </div>
    </div>
  );
}
