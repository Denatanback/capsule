import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

interface Note {
  id: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: string;
}

export default function NotesView() {
  const user = useAuthStore((s) => s.user);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadNotes(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [notes.length]);

  const loadNotes = async () => {
    try { const data = await api.getNotes(); setNotes((data.notes || []).reverse()); }
    catch {} finally { setLoading(false); }
  };

  const doSend = async () => {
    if (!text.trim()) return;
    try { const data = await api.createNote(text.trim()); setNotes((prev) => [...prev, data.note]); setText(""); } catch {}
  };

  const doEdit = async () => {
    if (!editText.trim() || !editingId) return;
    try { const data = await api.updateNote(editingId, editText.trim()); setNotes((prev) => prev.map((n) => n.id === editingId ? data.note : n)); setEditingId(null); } catch {}
  };

  const doDelete = async (noteId: string) => {
    try { await api.deleteNote(noteId); setNotes((prev) => prev.filter((n) => n.id !== noteId)); } catch {}
  };

  const fmtTime = (d: string) => {
    const date = new Date(d);
    const isToday = date.toDateString() === new Date().toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "var(--bg-chat)" }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
        <span className="text-lg">🔒</span>
        <div>
          <p className="font-bold text-sm gradient-text">Vault</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Your personal encrypted space</p>
        </div>
        <div className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{notes.length} items</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading...</p>}
        {!loading && notes.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">🔒</span>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Vault is empty</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Write something below, or pin messages from chats with 📌</p>
          </div>
        )}
        {notes.map((note) => (
          <div key={note.id} className="group flex items-start gap-3 py-2 px-3 rounded-xl transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {note.content.startsWith("[Forwarded") ? "↗" : "📝"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-xs" style={{ color: "var(--accent)" }}>
                  {note.content.startsWith("[Forwarded") ? "Pinned" : "Note"}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmtTime(note.createdAt)}</span>
              </div>
              {editingId === note.id ? (
                <div className="flex gap-2 mt-1">
                  <input value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doEdit(); if (e.key === "Escape") setEditingId(null); }}
                    className="input-capsule flex-1 px-3 py-1.5 text-sm" autoFocus />
                  <button onClick={doEdit} className="text-xs" style={{ color: "var(--success)" }}>Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              ) : (
                <p className="text-sm break-words whitespace-pre-wrap mt-0.5" style={{ color: "var(--text-primary)" }}>{note.content}</p>
              )}
              {note.fileUrl && (
                <a href={note.fileUrl} target="_blank" rel="noopener"
                  className="text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg"
                  style={{ background: "var(--bg-tertiary)", color: "var(--accent)" }}>
                  📎 {note.fileName || "File"}
                </a>
              )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
              <button onClick={() => { setEditingId(note.id); setEditText(note.content); }} className="text-xs px-1" style={{ color: "var(--text-muted)" }}>edit</button>
              <button onClick={() => doDelete(note.id)} className="text-xs px-1" style={{ color: "var(--danger)" }}>del</button>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2 items-center">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            placeholder="Write to your vault..."
            className="input-capsule flex-1 px-4 py-2.5 text-sm font-medium" />
          <button onClick={doSend} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover-lift"
            style={{ background: "var(--accent)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}
