import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useServerStore } from "../stores/serverStore";
import { useThemeStore } from "../stores/themeStore";
import { useDMStore } from "../stores/dmStore";
import { useNotificationStore } from "../stores/notificationStore";
import { on } from "../lib/ws";
import ServerSidebar from "../components/ServerSidebar";
import ChannelList from "../components/ChannelList";
import ChatArea from "../components/ChatArea";
import MemberList from "../components/MemberList";
import FileBrowser from "../components/FileBrowser";
import DMList from "../components/DMList";
import DMChat from "../components/DMChat";
import FriendsView from "../components/FriendsView";
import P2PChat from "../components/P2PChat";
import SearchModal from "../components/SearchModal";
import CityGame from "../components/game/CityGame";

export default function Home() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const dark = useThemeStore((s) => s.dark);
  const toggle = useThemeStore((s) => s.toggle);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const selectServer = useServerStore((s) => s.selectServer);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const activeDMId = useDMStore((s) => s.activeDMId);
  const selectDM = useDMStore((s) => s.selectDM);
  const fetchUnreads = useNotificationStore((s) => s.fetchUnreads);
  const onNewMessage = useNotificationStore((s) => s.onNewMessage);
  const onNewDM = useNotificationStore((s) => s.onNewDM);
  const requestBrowserPermission = useNotificationStore((s) => s.requestBrowserPermission);
  const toggleSound = useNotificationStore((s) => s.toggleSound);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const [view, setView] = useState("servers");
  const [showFiles, setShowFiles] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null); // null | "channels" | "members"
  const [showSearch, setShowSearch] = useState(false);

  // Ctrl+K to open search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    fetchServers();
    fetchUnreads();
    requestBrowserPermission();
  }, []);

  // WS listeners need latest channel/dm IDs via refs to avoid re-subscribing
  const activeChRef = useRef(activeChannelId);
  const activeDMRef = useRef(activeDMId);
  activeChRef.current = activeChannelId;
  activeDMRef.current = activeDMId;

  useEffect(() => {
    const a = on("message:new", (msg) => onNewMessage(msg, activeChRef.current));
    const b = on("dm:new", (msg) => onNewDM(msg, activeDMRef.current));
    return () => { a(); b(); };
  }, []);

  const ch = serverDetail?.channels?.find((c) => c.id === activeChannelId);

  const goToDM = () => { setView("dm"); selectServer(null); setMobilePanel(null); };
  const goToServer = (id) => { setView("servers"); selectServer(id); selectDM(null); setMobilePanel(null); };
  const goToGame = () => { setView("game"); selectServer(null); selectDM(null); setMobilePanel(null); };

  const UserBar = () => (
    <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
      <div className="avatar-gradient-1 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold">
        {user?.displayName?.charAt(0)?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user?.displayName}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>@{user?.username}</p>
      </div>
      <button onClick={toggleSound} className="p-1 rounded-md transition-colors hover:opacity-70" title={soundEnabled ? "Mute sounds" : "Unmute sounds"}>
        <span className="text-xs">{soundEnabled ? "🔔" : "🔕"}</span>
      </button>
      <button onClick={() => nav("/settings")} className="p-1 rounded-md transition-colors hover:opacity-70" title="Settings">
        <span className="text-xs">⚙️</span>
      </button>
      <button onClick={toggle} className="p-1 rounded-md transition-colors hover:opacity-70" title="Toggle theme">
        <span className="text-xs">{dark ? "☀️" : "🌙"}</span>
      </button>
      <button onClick={logout} className="p-1 rounded-md transition-colors text-xs font-medium hover:opacity-70"
        style={{ color: "var(--danger)" }} title="Logout">✕</button>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <P2PChat />
      {showFiles && <FileBrowser onClose={() => setShowFiles(false)} />}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onJumpToChannel={(chId) => {
            // Find server for this channel, navigate to it
            const srv = serverDetail?.channels?.find((c) => c.id === chId);
            if (srv) {
              // Already on this server, just switch channel
              useServerStore.getState().selectChannel(chId);
            } else {
              // Try all servers
              useServerStore.getState().selectChannel(chId);
            }
            setView("servers");
          }}
        />
      )}

      {/* Mobile overlay */}
      {mobilePanel && (
        <div className="mobile-overlay lg:hidden" onClick={() => setMobilePanel(null)} />
      )}

      {/* Server sidebar — always visible */}
      <ServerSidebar onDM={goToDM} dmActive={view === "dm"} onSelectServer={goToServer} onGame={goToGame} gameActive={view === "game"} />

      {view === "game" ? (
        <CityGame />
      ) : view === "dm" ? (
        <>
          {/* DM sidebar */}
          <div className={"flex flex-col border-r shrink-0 transition-all " +
            "w-60 max-lg:fixed max-lg:left-[72px] max-lg:top-0 max-lg:bottom-0 max-lg:z-50 " +
            (mobilePanel === "channels" ? "max-lg:translate-x-0" : "max-lg:-translate-x-full lg:translate-x-0")}
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <DMList onSelectFriends={() => selectDM(null)} onSelectDM={(id) => { selectDM(id); setMobilePanel(null); }} />
            <UserBar />
          </div>
          {/* DM content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile hamburger */}
            <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setMobilePanel("channels")} className="p-1.5 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
                <span className="text-sm">☰</span>
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {activeDMId ? "Direct Message" : "Friends"}
              </span>
            </div>
            {activeDMId ? <DMChat /> : <FriendsView />}
          </div>
        </>
      ) : (
        <>
          {/* Channel sidebar */}
          <div className={"flex flex-col border-r shrink-0 transition-all " +
            "w-60 max-lg:fixed max-lg:left-[72px] max-lg:top-0 max-lg:bottom-0 max-lg:z-50 " +
            (mobilePanel === "channels" ? "max-lg:translate-x-0" : "max-lg:-translate-x-full lg:translate-x-0")}
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <ChannelList />
            <UserBar />
          </div>
          {/* Main chat */}
          <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--bg-chat)" }}>
            {activeServerId ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
                  style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMobilePanel("channels")} className="lg:hidden p-1.5 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
                      <span className="text-sm">☰</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{ch ? "# " + ch.name : ""}</span>
                      <button onClick={() => setShowFiles(true)} className="text-xs font-medium px-2 py-0.5 rounded-md transition-colors"
                        style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>Files</button>
                      <button onClick={() => setShowSearch(true)} className="text-xs font-medium px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                        style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>
                        🔍 Search
                        <kbd className="text-[9px] font-mono ml-1 px-1 rounded opacity-60"
                          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>⌘K</kbd>
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setMobilePanel(mobilePanel === "members" ? null : "members")}
                    className="lg:hidden p-1.5 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
                    <span className="text-sm">👥</span>
                  </button>
                </div>
                <div className="flex flex-1 min-h-0">
                  <ChatArea channelId={activeChannelId} />
                  {/* Members — desktop always, mobile toggle */}
                  <div className={"border-l shrink-0 " +
                    "max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-50 max-lg:w-60 " +
                    (mobilePanel === "members" ? "max-lg:translate-x-0" : "max-lg:translate-x-full lg:translate-x-0")}
                    style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                    <MemberList />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>💬</div>
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Welcome to Capsule</h2>
                <p className="text-sm text-center max-w-sm" style={{ color: "var(--text-muted)" }}>
                  Select a server from the sidebar or create a new one to get started.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
