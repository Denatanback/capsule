import { useEffect } from "react";
import { useVoiceStore } from "../stores/voiceStore";
import { useServerStore } from "../stores/serverStore";
import { on } from "../lib/ws";

export default function VoicePanel() {
  const voiceCh = useVoiceStore((s) => s.activeChannelId);
  const users = useVoiceStore((s) => s.users);
  const muted = useVoiceStore((s) => s.muted);
  const myNode = useVoiceStore((s) => s.myNode);
  const latencies = useVoiceStore((s) => s.latencies);
  const leave = useVoiceStore((s) => s.leave);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const handleOffer = useVoiceStore((s) => s.handleOffer);
  const handleAnswer = useVoiceStore((s) => s.handleAnswer);
  const handleIce = useVoiceStore((s) => s.handleIceCandidate);
  const handleUserJoined = useVoiceStore((s) => s.handleUserJoined);
  const handleUserLeft = useVoiceStore((s) => s.handleUserLeft);
  const handleJoined = useVoiceStore((s) => s.handleJoined);
  const handleVoiceUsers = useVoiceStore((s) => s.handleVoiceUsers);
  const handleTopology = useVoiceStore((s) => s.handleTopology);
  const handleMeasure = useVoiceStore((s) => s.handleMeasureLatency);
  const serverDetail = useServerStore((s) => s.serverDetail);

  useEffect(() => {
    const a = on("voice:offer", handleOffer);
    const b = on("voice:answer", handleAnswer);
    const c = on("voice:ice-candidate", handleIce);
    const d = on("voice:user-joined", handleUserJoined);
    const e = on("voice:user-left", handleUserLeft);
    const f = on("voice:joined", handleJoined);
    const g = on("voice:users", handleVoiceUsers);
    const h = on("voice:topology", handleTopology);
    const i = on("voice:measure-latency", handleMeasure);
    return () => { a(); b(); c(); d(); e(); f(); g(); h(); i(); };
  }, []);

  if (!voiceCh) return null;

  const channel = serverDetail?.channels?.find((c) => c.id === voiceCh);
  const isRelay = myNode?.role === "relay";

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Voice Connected</span>
        </div>
        <span className="text-xs text-gray-400">{channel?.name || "voice"}</span>
      </div>

      {isRelay && (
        <div className="mb-2 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 rounded text-xs text-indigo-600 dark:text-indigo-300 text-center">
          You are relay node
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {users.map((uid) => (
          <div key={uid} className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            <span>{uid.slice(0, 6)}</span>
            {latencies[uid] != null && (
              <span className={"text-[10px] " + (latencies[uid] < 50 ? "text-green-500" : latencies[uid] < 150 ? "text-yellow-500" : "text-red-500")}>
                {latencies[uid]}ms
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={toggleMute}
          className={"flex-1 py-1.5 rounded text-xs font-medium " + (muted
            ? "bg-red-500 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300")}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <button onClick={leave}
          className="flex-1 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700">
          Disconnect
        </button>
      </div>
    </div>
  );
}
