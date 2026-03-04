import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import Avatar from "./Avatar";

export default function SearchModal({ onClose, onJumpToChannel }: {
  onClose: () => void;
  onJumpToChannel?: (channelId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState({ messages: [], dmMessages: [], files: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ messages: [], dmMessages: [], files: [] }); return; }
    setLoading(true);
    try {
      const data = await api.search(q, filter);
      setResults(data);
    } catch {}
    setLoading(false);
  }, [filter]);

  const onInput = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  useEffect(() => { if (query) doSearch(query); }, [filter]);

  const fmtTime = (d) => {
    const dt = new Date(d);
    const now = new Date();
    const diff = now.getTime() - dt.getTime();
    if (diff < 86400000) return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return dt.toLocaleDateString([], { weekday: "short" });
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    const parts = text.split(re);
    return parts.map((p, i) =>
      re.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{p}</mark> : p
    );
  };

  const sizeStr = (size) => size < 1024 ? size + " B" : size < 1048576 ? (size / 1024).toFixed(1) + " KB" : (size / 1048576).toFixed(1) + " MB";

  const totalResults = results.messages.length + results.dmMessages.length + results.files.length;

  const filters = [
    { id: "all", label: "All" },
    { id: "messages", label: "Messages" },
    { id: "files", label: "Files" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl fade-in"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color: "var(--text-muted)", shrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => onInput(e.target.value)}
            placeholder="Search messages, files..."
            className="flex-1 bg-transparent outline-none text-sm font-medium"
            style={{ color: "var(--text-primary)" }} />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>ESC</kbd>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === f.id ? "var(--accent-soft)" : "transparent",
                color: filter === f.id ? "var(--accent)" : "var(--text-muted)",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 120px)" }}>
          {loading && (
            <div className="px-5 py-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No results for "{query}"</p>
            </div>
          )}

          {!loading && !query && (
            <div className="px-5 py-12 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Type to search across messages and files</p>
            </div>
          )}

          {/* Channel messages */}
          {results.messages.length > 0 && (
            <div className="px-3 py-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Messages ({results.messages.length})
              </p>
              {results.messages.map((msg) => (
                <button key={msg.id}
                  onClick={() => { if (onJumpToChannel && msg.channelId) { onJumpToChannel(msg.channelId); onClose(); } }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <Avatar name={msg.author?.displayName} id={msg.author?.id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{msg.author?.displayName}</span>
                      {msg.channel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                          # {msg.channel.name}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmtTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      {highlight(msg.content, query)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* DM messages */}
          {results.dmMessages.length > 0 && (
            <div className="px-3 py-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Direct Messages ({results.dmMessages.length})
              </p>
              {results.dmMessages.map((msg) => (
                <div key={msg.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <Avatar name={msg.author?.displayName} id={msg.author?.id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{msg.author?.displayName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>DM</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmtTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      {highlight(msg.content, query)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Files */}
          {results.files.length > 0 && (
            <div className="px-3 py-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Files ({results.files.length})
              </p>
              {results.files.map((file) => (
                <a key={file.id} href={"/api/files/" + file.uuid} target="_blank" rel="noopener"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-soft)" }}>
                    {file.mime?.startsWith("image/") ? (
                      <span className="text-sm">🖼</span>
                    ) : file.mime === "application/pdf" ? (
                      <span className="text-sm">📄</span>
                    ) : file.mime?.startsWith("video/") ? (
                      <span className="text-sm">🎬</span>
                    ) : (
                      <span className="text-sm">📎</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--accent)" }}>
                      {highlight(file.filename, query)}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {sizeStr(file.size)} · {fmtTime(file.createdAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
