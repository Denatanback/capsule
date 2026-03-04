import { useState, useEffect } from "react";
import { useVoiceStore } from "../stores/voiceStore";
import { useServerStore } from "../stores/serverStore";
import { useAuthStore } from "../stores/authStore";

export default function VoicePanel() {
  const voiceCh = useVoiceStore((s) => s.activeChannelId);
  const users = useVoiceStore((s) => s.users);
  const muted = useVoiceStore((s) => s.muted);
  const myNode = useVoiceStore((s) => s.myNode);
  const latencies = useVoiceStore((s) => s.latencies);
  const leave = useVoiceStore((s) => s.leave);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const audioDevices = useVoiceStore((s) => s.audioDevices);
  const audioInputId = useVoiceStore((s) => s.audioInputId);
  const audioOutputId = useVoiceStore((s) => s.audioOutputId);
  const setAudioInput = useVoiceStore((s) => s.setAudioInput);
  const setAudioOutput = useVoiceStore((s) => s.setAudioOutput);
  const refreshDevices = useVoiceStore((s) => s.refreshDevices);
  const speakingUsers = useVoiceStore((s) => s.speakingUsers);
  const serverDetail = useServerStore((s) => s.serverDetail);
  const me = useAuthStore((s) => s.user);
  const [showSettings, setShowSettings] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (voiceCh) refreshDevices();
  }, [voiceCh]);

  // Force re-render for speaking animation
  useEffect(() => {
    if (!voiceCh) return;
    const iv = setInterval(() => forceUpdate((n) => n + 1), 120);
    return () => clearInterval(iv);
  }, [voiceCh]);

  if (!voiceCh) return null;

  const channel = serverDetail?.channels?.find((c: any) => c.id === voiceCh);
  const members = serverDetail?.members || [];
  const isRelay = myNode?.role === "relay";
  const inputs = audioDevices.filter((d: any) => d.kind === "audioinput");
  const outputs = audioDevices.filter((d: any) => d.kind === "audiooutput");

  const getUserName = (uid: string) => {
    const m = members.find((m: any) => m.userId === uid);
    return m?.user?.displayName || uid.slice(0, 8);
  };
  const getUserLetter = (uid: string) => {
    const name = getUserName(uid);
    return name.charAt(0).toUpperCase();
  };

  const isSpeaking = (uid: string) => {
    if (uid === me?.id) return speakingUsers["local"] && !muted;
    return speakingUsers[uid];
  };

  return (
    <div className="border-t p-3" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Voice Connected</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{users.length} in {channel?.name || "voice"}</span>
          <button onClick={() => setShowSettings(!showSettings)}
            className="text-xs px-1.5 py-0.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>⚙️</button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 p-2.5 rounded-xl space-y-2" style={{ background: "var(--bg-secondary)" }}>
          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Microphone</label>
            <select value={audioInputId || ""} onChange={(e) => setAudioInput(e.target.value)}
              className="w-full text-[11px] px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="">Default</option>
              {inputs.map((d: any) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Mic " + d.deviceId.slice(0, 5)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Speaker</label>
            <select value={audioOutputId || ""} onChange={(e) => setAudioOutput(e.target.value)}
              className="w-full text-[11px] px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="">Default</option>
              {outputs.map((d: any) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker " + d.deviceId.slice(0, 5)}</option>)}
            </select>
          </div>
        </div>
      )}

      {isRelay && (
        <div className="mb-2 px-2 py-1 rounded-lg text-[10px] text-center" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          Relay node
        </div>
      )}

      {/* User list with speaking indicators */}
      <div className="flex flex-wrap gap-2 mb-3">
        {users.map((uid: string) => {
          const speaking = isSpeaking(uid);
          const grad = ["avatar-gradient-1", "avatar-gradient-2", "avatar-gradient-3", "avatar-gradient-4"][(uid.charCodeAt(0) || 0) % 4];
          return (
            <div key={uid} className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-all"
              style={{ background: "var(--bg-secondary)" }}>
              {/* Avatar with speaking ring */}
              <div className="relative">
                <div className={"w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold " + grad}
                  style={speaking ? {
                    boxShadow: `0 0 0 2.5px var(--success)`,
                    transition: "box-shadow 0.1s",
                  } : {
                    boxShadow: "none",
                    transition: "box-shadow 0.3s",
                  }}>
                  {getUserLetter(uid)}
                </div>
                {/* Muted icon for self */}
                {uid === me?.id && muted && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-[6px]"
                    style={{ background: "var(--danger)", color: "white" }}>✕</div>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-medium block truncate max-w-[80px]" style={{ color: speaking ? "var(--success)" : "var(--text-primary)" }}>
                  {getUserName(uid)}{uid === me?.id ? " (you)" : ""}
                </span>
                {latencies[uid] != null && (
                  <span className={"text-[9px] " + (latencies[uid] < 50 ? "text-green-500" : latencies[uid] < 150 ? "text-yellow-500" : "text-red-500")}>
                    {latencies[uid]}ms
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={toggleMute}
          className={"flex-1 py-2 rounded-xl text-xs font-semibold transition-all " + (muted ? "text-white" : "")}
          style={muted
            ? { background: "var(--danger)" }
            : { background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
          {muted ? "🔇 Unmute" : "🎙 Mute"}
        </button>
        <button onClick={leave}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all"
          style={{ background: "var(--danger)" }}>
          ✕ Leave
        </button>
      </div>
    </div>
  );
}
