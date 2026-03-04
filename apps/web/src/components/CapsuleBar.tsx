import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { api } from "../lib/api";
import Logo from "./Logo";

export default function CapsuleBar({ view, setView, onToggleTheme, dark, onSettings, onLogout, user }: any) {
  const createServer = useServerStore((s) => s.createServer);
  const joinServer = useServerStore((s) => s.joinServer);
  const selectServer = useServerStore((s) => s.selectServer);
  const [modal, setModal] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const close = () => { setModal(null); setInput(""); };
  const handleCreate = async () => {
    if (!input.trim()) return;
    try { const s = await createServer(input.trim()); selectServer(s.id); setView("capsule"); close(); }
    catch (e: any) { alert(e.message); }
  };
  const handleJoin = async () => {
    const val = input.trim();
    if (!val) return;
    try {
      if (/^[a-f0-9]{8}$/i.test(val)) {
        const res = await api.joinInvite(val);
        if (res.serverId) { selectServer(res.serverId); setView("capsule"); close(); return; }
      }
      await joinServer(val); selectServer(val); setView("capsule"); close();
    } catch (e: any) { alert(e.message); }
  };

  const tabs = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "private", label: "Private Capsules", icon: "🔐" },
    { id: "capsule", label: "Capsules", icon: "⟡" },
    { id: "vault", label: "Vault", icon: "🔒" },
    { id: "town", label: "Capsule Town", icon: "🏙️" },
  ];

  return (
    <>
      <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}>
        <div className="flex items-center gap-2 mr-4 shrink-0 cursor-pointer" onClick={() => setView("home")}>
          <Logo size={32} className="rounded-lg" />
          <span className="text-sm font-bold text-white/90 hidden sm:block tracking-tight">Capsule</span>
        </div>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={"capsule-pill px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shrink-0 transition-all " +
                (view === t.id ? "text-white" : "text-white/40 hover:text-white/70")}
              style={view === t.id ? { background: "var(--accent)" } : {}}>
              <span>{t.icon}</span>
              <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setModal("create")} className="capsule-pill px-3 py-1.5 text-xs font-semibold text-white/40 hover:text-white">+ New</button>
          <button onClick={() => setModal("join")} className="capsule-pill px-3 py-1.5 text-xs font-semibold text-white/40 hover:text-white">→ Join</button>
          <div className="w-px h-6 mx-1.5" style={{ background: "rgba(255,255,255,0.1)" }} />
          <button onClick={onToggleTheme} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all text-base" title="Toggle theme">
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={onSettings} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all text-base" title="Settings">
            ⚙️
          </button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ml-1 cursor-pointer hover:ring-2 hover:ring-white/30 transition-all"
            onClick={onSettings}
            style={{ background: "var(--accent)" }}
            title="Profile settings">
            {user?.displayName?.charAt(0)?.toUpperCase()}
          </div>
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={close}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative p-6 rounded-2xl w-80 fade-in" onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
            <h3 className="text-lg font-bold mb-1 gradient-text">{modal === "create" ? "Create Capsule" : "Join Capsule"}</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{modal === "create" ? "Name your new capsule" : "Paste an access code"}</p>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") modal === "create" ? handleCreate() : handleJoin(); }}
              placeholder={modal === "create" ? "My Capsule" : "Access code..."} className="input-capsule w-full px-4 py-2.5 text-sm mb-4" autoFocus />
            <div className="flex gap-2">
              <button onClick={close} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={modal === "create" ? handleCreate : handleJoin} className="flex-1 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "var(--accent)" }}>{modal === "create" ? "Create" : "Join"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
