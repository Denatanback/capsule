import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { useNotificationStore } from "../stores/notificationStore";
import { api } from "../lib/api";

export default function ServerSidebar({ onDM, dmActive, onSelectServer, onGame, gameActive }: any) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const selectServer = onSelectServer || useServerStore((s) => s.selectServer);
  const createServer = useServerStore((s) => s.createServer);
  const joinServer = useServerStore((s) => s.joinServer);
  const serverUnreads = useNotificationStore((s) => s.serverUnreads);
  const dmUnreads = useNotificationStore((s) => s.dmUnreads);
  const [modal, setModal] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const close = () => { setModal(null); setInput(""); setError(""); };

  const handleCreate = async () => {
    if (!input.trim()) return;
    try { const s = await createServer(input.trim()); selectServer(s.id); close(); }
    catch (e) { setError(e.message); }
  };

  const handleJoin = async () => {
    if (!input.trim()) return;
    const val = input.trim();
    try {
      // Try as invite code first (8 chars hex), then as server ID
      if (val.length <= 12 && /^[a-f0-9]+$/i.test(val)) {
        const res = await api.useInvite(val);
        if (res.serverId) { selectServer(res.serverId); close(); return; }
      }
      await joinServer(val); selectServer(val); close();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="w-[72px] bg-gray-200 dark:bg-gray-950 flex flex-col items-center py-3 gap-2 shrink-0 overflow-y-auto">
      <div className="relative">
        <button onClick={onDM} title="Direct Messages"
          className={"w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all hover:rounded-xl " +
            (dmActive ? "bg-indigo-600 rounded-xl text-white" : "bg-gray-300 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-500 hover:text-white")}>
          DM
        </button>
        {(() => { const total = Object.values(dmUnreads).reduce((a: number, b: number) => a + b, 0); return total > 0 ? (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {total > 99 ? "99+" : total}
          </span>
        ) : null; })()}
      </div>
      <div className="relative tooltip-container">
        <button onClick={onGame} title="City Game"
          className={"w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all hover:rounded-xl " +
            (gameActive ? "bg-green-500 rounded-xl text-white" : "bg-gray-300 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-500 hover:text-white")}>
          🏙️
        </button>
        <span className="tooltip">City Builder</span>
      </div>
      <div className="w-8 border-t border-gray-300 dark:border-gray-700 my-1" />
      {servers.map((srv) => (
        <div key={srv.id} className="relative tooltip-container">
          <button onClick={() => selectServer(srv.id)} title={srv.name}
            className={"w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm transition-all hover:rounded-xl " +
              (activeServerId === srv.id ? "ring-2 ring-indigo-400 rounded-xl " : "hover:ring-1 hover:ring-white/30 ") +
              (activeServerId === srv.id ? "avatar-gradient-1" : "bg-gray-400 dark:bg-gray-700 hover:bg-indigo-500")}>
            {srv.name?.charAt(0)?.toUpperCase()}
          </button>
          <span className="tooltip">{srv.name}</span>
          {serverUnreads[srv.id] > 0 && activeServerId !== srv.id && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 badge-pulse">
              {serverUnreads[srv.id] > 99 ? "99+" : serverUnreads[srv.id]}
            </span>
          )}
        </div>
      ))}
      <div className="w-8 border-t border-gray-300 dark:border-gray-700 my-1" />
      <button onClick={() => setModal("create")} title="Create server"
        className="w-12 h-12 rounded-2xl bg-gray-300 dark:bg-gray-800 text-green-500 flex items-center justify-center text-2xl hover:rounded-xl hover:bg-green-500 hover:text-white transition-all">+</button>
      <button onClick={() => setModal("join")} title="Join server"
        className="w-12 h-12 rounded-2xl bg-gray-300 dark:bg-gray-800 text-blue-500 flex items-center justify-center text-lg hover:rounded-xl hover:bg-blue-500 hover:text-white transition-all">&rarr;</button>
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={close}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{modal === "create" ? "Create a Server" : "Join a Server"}</h2>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (modal === "create" ? handleCreate() : handleJoin())}
              placeholder={modal === "create" ? "Server name" : "Invite code or Server ID"}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 outline-none mb-4" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={close} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={modal === "create" ? handleCreate : handleJoin}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                {modal === "create" ? "Create" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
