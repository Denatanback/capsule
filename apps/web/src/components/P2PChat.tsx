import { useState, useEffect, useRef } from "react";
import { useP2PStore } from "../stores/p2pStore";

export default function P2PChat() {
  const status = useP2PStore((s) => s.p2pStatus);
  const messages = useP2PStore((s) => s.messages);
  const activeP2P = useP2PStore((s) => s.activeP2P);
  const sendP2P = useP2PStore((s) => s.sendP2P);
  const endP2P = useP2PStore((s) => s.endP2P);
  const incomingFrom = useP2PStore((s) => s.incomingFrom);
  const acceptP2P = useP2PStore((s) => s.acceptP2P);
  const declineP2P = useP2PStore((s) => s.declineP2P);

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // WS events now handled globally in Home.tsx — no subscriptions here

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const doSend = () => {
    if (!text.trim()) return;
    sendP2P(text.trim());
    setText("");
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Incoming request popup
  if (status === "incoming" && incomingFrom) {
    return (
      <div className="fixed bottom-4 right-4 rounded-xl shadow-2xl p-4 z-50 w-72 animate-slide-in"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Secure Link Request</span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Someone wants to start an secure encrypted link. Messages won't be saved.
        </p>
        <div className="flex gap-2">
          <button onClick={acceptP2P} className="flex-1 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600">Accept</button>
          <button onClick={declineP2P} className="flex-1 py-1.5 text-xs font-medium rounded-lg"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>Decline</button>
        </div>
      </div>
    );
  }

  if (!activeP2P && status === "idle") return null;

  if (status === "requesting") {
    return (
      <div className="fixed bottom-4 right-4 rounded-xl shadow-2xl p-4 z-50 w-72"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Waiting for peer to accept...</p>
        <button onClick={endP2P} className="mt-2 w-full py-1.5 text-xs rounded-lg"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>Cancel</button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="fixed bottom-4 right-4 rounded-xl shadow-2xl p-4 z-50 w-72"
        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Connecting peer-to-peer...</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 rounded-2xl shadow-2xl z-50 w-80 h-96 flex flex-col"
      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-bold text-green-500">Secure Link</span>
        </div>
        <button onClick={endP2P} className="text-xs font-medium" style={{ color: "var(--danger)" }}>End</button>
      </div>
      <div className="px-3 py-1.5 border-b" style={{ borderColor: "var(--border)", background: "rgba(234,179,8,0.1)" }}>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>End-to-end encrypted. Not saved anywhere.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.map((msg: any) => (
          <div key={msg.id} className={"flex " + (msg.from === "me" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[70%] px-3 py-1.5 rounded-xl text-sm " +
              (msg.from === "me"
                ? "bg-indigo-500 text-white rounded-br-sm"
                : "rounded-bl-sm")
            } style={msg.from !== "me" ? { background: "var(--bg-tertiary)", color: "var(--text-primary)" } : {}}>
              <p className="break-words">{msg.content}</p>
              <p className={"text-[9px] mt-0.5 " + (msg.from === "me" ? "text-indigo-200" : "")}
                style={msg.from !== "me" ? { color: "var(--text-muted)" } : {}}>
                {fmtTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-1.5">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            placeholder="Encrypted message..."
            className="flex-1 px-3 py-1.5 text-sm rounded-lg outline-none focus:ring-1 focus:ring-green-500"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={doSend} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600">Send</button>
        </div>
      </div>
    </div>
  );
}
