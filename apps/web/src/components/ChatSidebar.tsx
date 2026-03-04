import { useEffect } from "react";
import { useDMStore } from "../stores/dmStore";
import { useServerStore } from "../stores/serverStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useNotificationStore } from "../stores/notificationStore";

export default function ChatSidebar({ view, onSelectDM, onSelectServer, onSelectChannel }: {
  view: string;
  onSelectDM: (id: string) => void;
  onSelectServer: (id: string) => void;
  onSelectChannel: (id: string) => void;
}) {
  const me = useAuthStore((s) => s.user);
  const dmChannels = useDMStore((s) => s.channels);
  const activeDMId = useDMStore((s) => s.activeDMId);
  const fetchDM = useDMStore((s) => s.fetchChannels);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const online = usePresenceStore((s) => s.onlineUsers);
  const dmUnreads = useNotificationStore((s) => s.dmUnreads);
  const serverUnreads = useNotificationStore((s) => s.serverUnreads);
  const channelUnreads = useNotificationStore((s) => s.channelUnreads);
  const markDMRead = useNotificationStore((s) => s.markDMRead);

  useEffect(() => { fetchDM(); }, []);

  const showPrivate = view === "private" || view === "home";
  const showCapsules = view === "capsule" || view === "home";

  // For capsule view: show threads of active server
  const threads = (view === "capsule" && serverDetail?.channels?.filter((c: any) => c.type === "TEXT")) || [];

  return (
    <div className="w-64 flex flex-col border-r shrink-0 min-h-0 overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>

      {/* Private Capsules section */}
      {showPrivate && (
        <div className={"flex flex-col " + (showCapsules ? "max-h-[50%]" : "flex-1") + " min-h-0"}>
          <div className="px-3 py-2 border-b shrink-0 flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              🔐 Private Capsules
            </span>
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{dmChannels.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {dmChannels.map((ch: any) => {
              const other = ch.userA?.id === me?.id ? ch.userB : ch.userA;
              const isOnline = other && online.includes(other.id);
              const unread = dmUnreads[ch.id] || 0;
              const isActive = activeDMId === ch.id && view === "private";
              const grad = ["avatar-gradient-1","avatar-gradient-2","avatar-gradient-3","avatar-gradient-4"][(other?.id?.charCodeAt(0) || 0) % 4];
              return (
                <div key={ch.id} onClick={() => { onSelectDM(ch.id); markDMRead(ch.id); }}
                  className={"flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all " + (isActive ? "font-medium" : "")}
                  style={isActive ? { background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent)" } : {}}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  <div className="relative shrink-0">
                    <div className={"w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold " + grad}>
                      {other?.displayName?.charAt(0)?.toUpperCase()}
                    </div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2" style={{ borderColor: "var(--bg-secondary)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: isActive ? "var(--accent)" : "var(--text-primary)" }}>
                      {other?.displayName}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      {ch.messages?.[0]?.content
                        ? (ch.messages[0].content.length > 28 ? ch.messages[0].content.slice(0, 28) + "…" : ch.messages[0].content)
                        : (isOnline ? "Online" : "Offline")}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                      style={{ background: "var(--danger)" }}>{unread > 9 ? "9+" : unread}</span>
                  )}
                </div>
              );
            })}
            {dmChannels.length === 0 && (
              <p className="text-[10px] text-center py-4" style={{ color: "var(--text-muted)" }}>No private capsules yet</p>
            )}
          </div>
        </div>
      )}

      {/* Divider between sections */}
      {showPrivate && showCapsules && <div className="h-px shrink-0" style={{ background: "var(--border)" }} />}

      {/* Capsules (servers) section */}
      {showCapsules && (
        <div className={"flex flex-col " + (showPrivate ? "flex-1" : "flex-1") + " min-h-0"}>
          <div className="px-3 py-2 border-b shrink-0 flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              ⟡ Capsules
            </span>
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{servers.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {/* Server list or thread list depending on context */}
            {view === "capsule" && activeServerId && serverDetail ? (
              <>
                {/* Back to server list */}
                <button onClick={() => onSelectServer("")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold w-full transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  ← All Capsules
                </button>
                <div className="px-2.5 py-1 mb-1">
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{serverDetail.name}</span>
                </div>
                {/* Threads */}
                {threads.map((ch: any) => {
                  const isActive = activeChannelId === ch.id;
                  const unread = channelUnreads[ch.id] || 0;
                  return (
                    <div key={ch.id} onClick={() => onSelectChannel(ch.id)}
                      className={"flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all text-xs " +
                        (isActive ? "font-semibold" : "")}
                      style={isActive ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">⟡ {ch.name}</span>
                        {ch.messages?.[0] && (
                          <p className="text-[9px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {ch.messages[0].author?.displayName}: {ch.messages[0].content?.length > 25 ? ch.messages[0].content.slice(0, 25) + "…" : ch.messages[0].content}
                          </p>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                          style={{ background: "var(--danger)" }}>{unread}</span>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              /* Server list */
              servers.map((srv: any) => {
                const isActive = activeServerId === srv.id && view === "capsule";
                const unread = serverUnreads[srv.id] || 0;
                return (
                  <div key={srv.id} onClick={() => onSelectServer(srv.id)}
                    className={"flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all " + (isActive ? "font-medium" : "")}
                    style={isActive ? { background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent)" } : {}}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: "var(--accent)" }}>
                      {srv.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-xs truncate" style={{ color: isActive ? "var(--accent)" : "var(--text-primary)" }}>
                      {srv.name}
                    </span>
                    {unread > 0 && !isActive && (
                      <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ background: "var(--danger)" }}>{unread > 9 ? "9+" : unread}</span>
                    )}
                  </div>
                );
              })
            )}
            {servers.length === 0 && (
              <p className="text-[10px] text-center py-4" style={{ color: "var(--text-muted)" }}>No capsules — create or join one!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
