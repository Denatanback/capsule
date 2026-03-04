import { useState, useEffect } from "react";
import { on } from "../lib/ws";
import { useVoiceStore } from "../stores/voiceStore";

interface VoiceInvite {
  fromUserId: string;
  fromName: string;
  channelId: string;
  channelName: string;
  timestamp: number;
}

export default function VoiceInviteToast() {
  const [invites, setInvites] = useState<VoiceInvite[]>([]);
  const join = useVoiceStore((s) => s.join);

  useEffect(() => {
    const unsub = on("voice:invite", (data: any) => {
      const invite: VoiceInvite = { ...data, timestamp: Date.now() };
      setInvites((prev) => [...prev, invite]);
      // Auto-dismiss after 15s
      setTimeout(() => {
        setInvites((prev) => prev.filter((i) => i.timestamp !== invite.timestamp));
      }, 15000);
    });
    return unsub;
  }, []);

  const accept = (invite: VoiceInvite) => {
    join(invite.channelId);
    setInvites((prev) => prev.filter((i) => i.timestamp !== invite.timestamp));
  };

  const dismiss = (invite: VoiceInvite) => {
    setInvites((prev) => prev.filter((i) => i.timestamp !== invite.timestamp));
  };

  if (invites.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {invites.map((inv) => (
        <div key={inv.timestamp}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", minWidth: 280 }}>
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-lg shrink-0">
            🎙️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Voice Invite</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <strong>{inv.fromName}</strong> invited you to <strong>#{inv.channelName}</strong>
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => accept(inv)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
              Join
            </button>
            <button onClick={() => dismiss(inv)}
              className="px-2 py-1.5 rounded-lg text-xs transition-colors"
              style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
