import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useServerStore } from "../stores/serverStore";
import { useThemeStore } from "../stores/themeStore";
import { useDMStore } from "../stores/dmStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useMessageStore } from "../stores/messageStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useP2PStore } from "../stores/p2pStore";
import { connectWs, on } from "../lib/ws";
import CapsuleBar from "../components/CapsuleBar";
import ChatSidebar from "../components/ChatSidebar";
import ChatArea from "../components/ChatArea";
import CrewPanel from "../components/CrewPanel";
import FileBrowser from "../components/FileBrowser";
import DMChat from "../components/DMChat";
import FriendsView from "../components/FriendsView";
import P2PChat from "../components/P2PChat";
import SearchModal from "../components/SearchModal";
import CityGame from "../components/game/CityGame";
import NotesView from "../components/NotesView";
import VoiceInviteToast from "../components/VoiceInviteToast";
import VoicePanel from "../components/VoicePanel";
import WelcomeScreen from "../components/WelcomeScreen";
import ThreadList from "../components/ThreadList";

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
  const selectChannel = useServerStore((s) => s.selectChannel);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const activeDMId = useDMStore((s) => s.activeDMId);
  const selectDM = useDMStore((s) => s.selectDM);
  const fetchUnreads = useNotificationStore((s) => s.fetchUnreads);

  // view: "home" | "private" | "capsule" | "vault" | "town"
  const [view, setView] = useState("home");
  const [showFiles, setShowFiles] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCrew, setShowCrew] = useState(false);

  useEffect(() => { fetchServers(); fetchUnreads(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Global WS
  const wsInitRef = useRef(false);
  const activeChRef = useRef(activeChannelId);
  const activeDMRef = useRef(activeDMId);
  activeChRef.current = activeChannelId;
  activeDMRef.current = activeDMId;

  useEffect(() => {
    if (wsInitRef.current) return;
    wsInitRef.current = true;
    connectWs();
    on("auth:ok", (d: any) => { if (d.onlineUsers) usePresenceStore.getState().setOnlineUsers(d.onlineUsers); });
    on("message:new", (m: any) => { useMessageStore.getState().onNew(m); useNotificationStore.getState().onNewMessage(m, activeChRef.current); });
    on("message:edited", (m: any) => useMessageStore.getState().onEdited(m));
    on("message:deleted", (d: any) => useMessageStore.getState().onDeleted(d));
    on("dm:new", (m: any) => { useDMStore.getState().onNew(m); useNotificationStore.getState().onNewDM(m, activeDMRef.current); });
    on("dm:edited", (m: any) => useDMStore.getState().onEdited(m));
    on("dm:deleted", (d: any) => useDMStore.getState().onDeleted(d));
    on("presence", (d: any) => usePresenceStore.getState().onPresence(d));
    on("typing:update", (d: any) => usePresenceStore.getState().onTyping(d));
    on("voice:joined", (d: any) => useVoiceStore.getState().handleJoined(d));
    on("voice:user-joined", (d: any) => useVoiceStore.getState().handleUserJoined(d));
    on("voice:user-left", (d: any) => useVoiceStore.getState().handleUserLeft(d));
    on("voice:offer", (d: any) => useVoiceStore.getState().handleOffer(d));
    on("voice:answer", (d: any) => useVoiceStore.getState().handleAnswer(d));
    on("voice:ice-candidate", (d: any) => useVoiceStore.getState().handleIceCandidate(d));
    on("voice:users", (d: any) => useVoiceStore.getState().handleVoiceUsers(d));
    on("voice:topology", (d: any) => useVoiceStore.getState().handleTopology(d));
    on("p2p:request", (d: any) => useP2PStore.getState().onRequest(d));
    on("p2p:accept", (d: any) => useP2PStore.getState().onAccept(d));
    on("p2p:decline", (d: any) => useP2PStore.getState().onDecline(d));
    on("p2p:offer", (d: any) => useP2PStore.getState().onOffer(d));
    on("p2p:answer", (d: any) => useP2PStore.getState().onAnswer(d));
    on("p2p:ice", (d: any) => useP2PStore.getState().onIce(d));
    on("p2p:end", (d: any) => useP2PStore.getState().onEnd(d));
    on("server:updated", () => { useServerStore.getState().fetchServers(); });
  }, []);

  // Navigation helpers
  const handleSelectDM = (id: string) => { selectDM(id); setView("private"); };
  const handleSelectServer = (id: string) => {
    if (!id) { selectServer(null as any); return; }
    selectServer(id); setView("capsule");
  };
  const handleSelectChannel = (id: string) => { selectChannel(id); };
  const goToDMFromWelcome = (dmId: string) => { selectDM(dmId); setView("private"); };
  const goToServerFromWelcome = (serverId: string, channelId: string) => {
    selectServer(serverId); selectChannel(channelId); setView("capsule");
  };

  const ch = serverDetail?.channels?.find((c: any) => c.id === activeChannelId);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <P2PChat />
      <VoiceInviteToast />
      {showFiles && <FileBrowser onClose={() => setShowFiles(false)} />}
      {showSearch && (
        <SearchModal onClose={() => setShowSearch(false)}
          onJumpToChannel={(chId: any) => { selectChannel(chId); setView("capsule"); }} />
      )}

      {/* TOP BAR */}
      <CapsuleBar view={view} setView={setView} onToggleTheme={toggle} dark={dark}
        onSettings={() => nav("/settings")} onLogout={logout} user={user} />

      {/* MAIN */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT SIDEBAR — always visible except town/vault */}
        {(view === "home" || view === "private" || view === "capsule") && (
          <ChatSidebar view={view} onSelectDM={handleSelectDM}
            onSelectServer={handleSelectServer} onSelectChannel={handleSelectChannel} />
        )}

        {/* CONTENT */}
        {view === "home" && (
          <WelcomeScreen onGoToDM={goToDMFromWelcome} onGoToServer={goToServerFromWelcome} />
        )}

        {view === "private" && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {activeDMId ? <DMChat /> : <FriendsView />}
          </div>
        )}

        {view === "capsule" && (
          <>
            {/* Thread sidebar for active server */}
            {activeServerId && serverDetail && (
              <div className="w-48 flex flex-col border-r shrink-0 min-h-0 overflow-hidden"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <ThreadList onOpenSplit={() => {}} splitChannelId={null} />
              </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden" style={{ background: "var(--bg-chat)" }}>
              {activeServerId && activeChannelId ? (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-2 border-b shrink-0"
                    style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>⟡ {ch?.name || ""}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowFiles(true)} className="text-[10px] font-medium px-2 py-1 rounded-lg"
                        style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>Files</button>
                      <button onClick={() => setShowSearch(true)} className="text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1"
                        style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>
                        Search <kbd className="text-[8px] font-mono px-0.5 rounded" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>⌘K</kbd>
                      </button>
                      <button onClick={() => setShowCrew(!showCrew)} className="text-[10px] font-medium px-2 py-1 rounded-lg"
                        style={{ color: showCrew ? "var(--accent)" : "var(--text-muted)", background: showCrew ? "var(--accent-soft)" : "var(--bg-tertiary)" }}>
                        Crew
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-1 min-h-0">
                    <ChatArea channelId={activeChannelId} />
                    {showCrew && <CrewPanel />}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <span className="text-3xl">⟡</span>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a capsule and thread</p>
                </div>
              )}
            </div>
          </>
        )}

        {view === "vault" && <NotesView />}
        {view === "town" && <CityGame />}
      </div>

      {/* Floating voice panel */}
      {useVoiceStore.getState().activeChannelId && view !== "capsule" && (
        <div className="fixed bottom-4 left-4 w-72 rounded-2xl z-40" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
          <VoicePanel />
        </div>
      )}
    </div>
  );
}
