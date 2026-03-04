import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import Logo from "./Logo";

interface Activity {
  latestDM: any;
  latestMsg: any;
}

export default function WelcomeScreen({ onGoToDM, onGoToServer }: {
  onGoToDM: (dmChannelId: string) => void;
  onGoToServer: (serverId: string, channelId: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [activity, setActivity] = useState<Activity | null>(null);

  const fetchActivity = async () => {
    try { const data = await api.getRecentActivity(); setActivity(data); } catch {}
  };

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const dm = activity?.latestDM;
  const msg = activity?.latestMsg;

  // Determine DM partner name
  const dmPartner = dm ? (dm.dmChannel?.userA?.id === user?.id ? dm.dmChannel?.userB : dm.dmChannel?.userA) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <Logo size={80} className="mb-6" />
      <h2 className="text-2xl font-bold gradient-text mb-2">
        Welcome{user?.displayName ? `, ${user.displayName}` : ""}
      </h2>
      <p className="text-sm mb-10 max-w-sm text-center" style={{ color: "var(--text-muted)" }}>
        Your capsules are ready. Jump into a conversation or explore.
      </p>

      {/* Activity bubbles */}
      <div className="flex gap-4 flex-wrap justify-center max-w-lg">
        {/* Latest Private message */}
        {dm && dmPartner && (
          <button onClick={() => onGoToDM(dm.dmChannelId)}
            className="flex items-start gap-3 p-4 rounded-2xl text-left transition-all hover-lift w-56"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="w-10 h-10 rounded-xl avatar-gradient-1 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {dmPartner?.displayName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>🔐 Private</span>
                <span className="text-[9px] ml-auto" style={{ color: "var(--text-muted)" }}>{timeAgo(dm.createdAt)}</span>
              </div>
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{dmPartner?.displayName}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{dm.content}</p>
            </div>
          </button>
        )}

        {/* Latest Capsule message */}
        {msg && (
          <button onClick={() => onGoToServer(msg.channel?.serverId, msg.channel?.id)}
            className="flex items-start gap-3 p-4 rounded-2xl text-left transition-all hover-lift w-56"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "var(--accent)" }}>
              {msg.channel?.server?.name?.charAt(0)?.toUpperCase() || "⟡"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>⟡ Capsule</span>
                <span className="text-[9px] ml-auto" style={{ color: "var(--text-muted)" }}>{timeAgo(msg.createdAt)}</span>
              </div>
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {msg.channel?.server?.name} · ⟡ {msg.channel?.name}
              </p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {msg.author?.displayName}: {msg.content}
              </p>
            </div>
          </button>
        )}

        {/* Fallback if no activity */}
        {!dm && !msg && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No recent activity — start a conversation!</p>
        )}
      </div>
    </div>
  );
}
