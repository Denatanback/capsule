import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export default function VoiceRecorder({ onRecorded }: { onRecorded: (voiceUrl: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const levelRef = useRef(0);

  const monitorLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    levelRef.current = Math.min(1, rms * 5);
    setLevel(levelRef.current);
    animRef.current = requestAnimationFrame(monitorLevel);
  }, []);

  const start = async () => {
    try {
      const savedInput = localStorage.getItem("capsule_audio_input");
      const constraints = savedInput
        ? { audio: { deviceId: { exact: savedInput } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";

      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRef.current = mr;
      chunksRef.current = [];
      setDuration(0);
      setLevel(0);

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try { ctx.close(); } catch {}
        cancelAnimationFrame(animRef.current);
        analyserRef.current = null;
        clearInterval(timerRef.current);
        setLevel(0);

        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        console.log("[Voice] Blob size:", blob.size, "type:", blob.type);

        if (blob.size < 300) {
          console.log("[Voice] Too short, ignoring");
          setRecording(false);
          return;
        }

        setUploading(true);
        try {
          const res = await api.uploadVoice(blob);
          console.log("[Voice] Upload result:", res);
          if (res.voiceUrl) {
            onRecorded(res.voiceUrl);
          }
        } catch (err) {
          console.error("[Voice] Upload failed:", err);
        } finally {
          setUploading(false);
          setRecording(false);
          setDuration(0);
        }
      };

      mr.start(250);
      setRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      monitorLevel();
    } catch (err) {
      console.error("[Voice] Mic access denied:", err);
    }
  };

  const stop = () => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  };

  const cancel = () => {
    cancelAnimationFrame(animRef.current);
    clearInterval(timerRef.current);
    if (mediaRef.current) {
      try { mediaRef.current.stream.getTracks().forEach((t) => t.stop()); } catch {}
      // Don't call stop — we don't want onstop to upload
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      if (mediaRef.current.state === "recording") {
        try { mediaRef.current.stop(); } catch {}
      }
    }
    try { ctxRef.current?.close(); } catch {}
    analyserRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
    setLevel(0);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (uploading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Sending...
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{
            border: `2px solid rgba(201, 97, 110, ${0.4 + level * 0.6})`,
            boxShadow: `0 0 0 ${level * 5}px rgba(201, 97, 110, ${level * 0.25})`,
            background: `rgba(201, 97, 110, ${0.05 + level * 0.15})`,
          }}>
          <div className="flex items-center gap-[2px] h-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[2.5px] rounded-full"
                style={{
                  height: `${3 + level * 14 * Math.abs(Math.sin(Date.now() / 120 + i * 1.3))}px`,
                  background: "var(--danger)",
                  opacity: 0.5 + level * 0.5,
                  transition: "height 0.08s",
                }} />
            ))}
          </div>
        </div>
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--danger)" }}>{fmtDur(duration)}</span>
        <button onClick={stop} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white hover-lift"
          style={{ background: "var(--accent)" }}>✓ Send</button>
        <button onClick={cancel} className="px-2 py-1.5 rounded-xl text-xs font-medium"
          style={{ color: "var(--text-muted)" }}>✕</button>
      </div>
    );
  }

  return (
    <button onClick={start} className="p-2.5 rounded-xl transition-colors shrink-0"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      title="Record voice message">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
