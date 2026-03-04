import { useState, useRef } from "react";

export default function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      const a = new Audio(url);
      audioRef.current = a;
      a.onloadedmetadata = () => setDuration(a.duration);
      a.ontimeupdate = () => setProgress(a.currentTime / (a.duration || 1));
      a.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const fmtDur = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl max-w-[240px]"
      style={{ background: "var(--bg-tertiary)" }}>
      <button onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ background: "var(--accent)" }}>
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: "var(--accent)" }} />
        </div>
        <span className="text-[9px] font-mono mt-0.5 block" style={{ color: "var(--text-muted)" }}>{fmtDur(duration)}</span>
      </div>
    </div>
  );
}
