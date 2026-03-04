import { useEffect } from "react";
import { useDMStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useNotificationStore } from "../stores/notificationStore";

export default function DMList({ onSelectFriends, onSelectDM }: any) {
  const channels = useDMStore((s) => s.channels);
  const activeDMId = useDMStore((s) => s.activeDMId);
  const selectDM = onSelectDM || useDMStore((s) => s.selectDM);
  const fetchChannels = useDMStore((s) => s.fetchChannels);
  const me = useAuthStore((s) => s.user);
  const online = usePresenceStore((s) => s.onlineUsers);
  const dmUnreads = useNotificationStore((s) => s.dmUnreads);
  const markDMRead = useNotificationStore((s) => s.markDMRead);

  useEffect(() => { fetchChannels(); }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <span className="font-bold text-sm gradient-text">Private Capsules</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <button onClick={onSelectFriends}
          className={"w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors " + (!activeDMId ? "font-bold" : "")}
          style={!activeDMId ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { if (activeDMId) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
          onMouseLeave={(e) => { if (activeDMId) e.currentTarget.style.background = "transparent"; }}>
          👥 Crew Finder
        </button>

        {channels.map((ch: any) => {
          const other = ch.userA?.id === me?.id ? ch.userB : ch.userA;
          const isOnline = other && online.includes(other.id);
          const unread = dmUnreads[ch.id] || 0;
          const grad = ["avatar-gradient-1","avatar-gradient-2","avatar-gradient-3","avatar-gradient-4"][(other?.id?.charCodeAt(0) || 0) % 4];
          return (
            <div key={ch.id} onClick={() => { selectDM(ch.id); markDMRead(ch.id); }}
              className={"flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors " + (activeDMId === ch.id ? "font-medium" : "")}
              style={activeDMId === ch.id ? { background: "var(--accent-soft)" } : {}}
              onMouseEnter={(e) => { if (activeDMId !== ch.id) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { if (activeDMId !== ch.id) e.currentTarget.style.background = "transparent"; }}>
              <div className="relative shrink-0">
                <div className={"w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold " + grad}>
                  {other?.displayName?.charAt(0)?.toUpperCase()}
                </div>
                <div className={"absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 " + (isOnline ? "bg-green-500" : "bg-gray-500")}
                  style={{ borderColor: "var(--bg-secondary)" }} />
              </div>
              <span className="flex-1 text-sm truncate" style={{ color: activeDMId === ch.id ? "var(--accent)" : "var(--text-primary)" }}>
                {other?.displayName}
              </span>
              {unread > 0 && (
                <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                  style={{ background: "var(--danger)" }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
