import { useState, useEffect, useRef } from "react";
import { useP2PStore } from "../stores/p2pStore";
import { on } from "../lib/ws";

export default function P2PChat() {
  const status = useP2PStore((s) => s.p2pStatus);
  const messages = useP2PStore((s) => s.messages);
  const activeP2P = useP2PStore((s) => s.activeP2P);
  const sendP2P = useP2PStore((s) => s.sendP2P);
  const endP2P = useP2PStore((s) => s.endP2P);
  const incomingFrom = useP2PStore((s) => s.incomingFrom);
  const acceptP2P = useP2PStore((s) => s.acceptP2P);
  const declineP2P = useP2PStore((s) => s.declineP2P);
  const onRequest = useP2PStore((s) => s.onRequest);
  const onAccept = useP2PStore((s) => s.onAccept);
  const onDecline = useP2PStore((s) => s.onDecline);
  const onOffer = useP2PStore((s) => s.onOffer);
  const onAnswer = useP2PStore((s) => s.onAnswer);
  const onIce = useP2PStore((s) => s.onIce);
  const onEnd = useP2PStore((s) => s.onEnd);

  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const a = on("p2p:request", onRequest);
    const b = on("p2p:accept", onAccept);
    const c = on("p2p:decline", onDecline);
    const d = on("p2p:offer", onOffer);
    const e = on("p2p:answer", onAnswer);
    const f = on("p2p:ice", onIce);
    const g = on("p2p:end", onEnd);
    return () => { a(); b(); c(); d(); e(); f(); g(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const doSend = () => {
    if (!text.trim()) return;
    sendP2P(text.trim());
    setText("");
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Incoming request popup
  if (status === "incoming" && incomingFrom) {
    return (
      <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 z-50 w-72">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">P2P Chat Request</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-medium text-gray-700 dark:text-gray-300">{incomingFrom.slice(0, 8)}...</span> wants to start an encrypted P2P chat. Messages won't be saved.
        </p>
        <div className="flex gap-2">
          <button onClick={acceptP2P} className="flex-1 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600">Accept</button>
          <button onClick={declineP2P} className="flex-1 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300">Decline</button>
        </div>
      </div>
    );
  }

  // Not in P2P mode
  if (!activeP2P && status === "idle") return null;

  // Waiting states
  if (status === "requesting") {
    return (
      <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 z-50 w-72">
        <p className="text-sm text-gray-500">Waiting for peer to accept...</p>
        <button onClick={endP2P} className="mt-2 w-full py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 z-50 w-72">
        <p className="text-sm text-gray-500">Connecting peer-to-peer...</p>
      </div>
    );
  }

  // Connected: show chat
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 w-80 h-96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-bold text-green-600 dark:text-green-400">P2P Encrypted</span>
        </div>
        <button onClick={endP2P} className="text-xs text-red-500 hover:text-red-600 font-medium">End</button>
      </div>

      {/* Warning */}
      <div className="px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
        <p className="text-[10px] text-yellow-600 dark:text-yellow-400">Messages are direct peer-to-peer. Not saved anywhere. Lost when chat ends.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id} className={"flex " + (msg.from === "me" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[70%] px-3 py-1.5 rounded-xl text-sm " +
              (msg.from === "me"
                ? "bg-indigo-500 text-white rounded-br-sm"
                : "bg-gray-100 dark:bg-gray-700 rounded-bl-sm")}>
              <p className="break-words">{msg.content}</p>
              <p className={"text-[9px] mt-0.5 " + (msg.from === "me" ? "text-indigo-200" : "text-gray-400")}>
                {fmtTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-1.5">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
            placeholder="P2P message..."
            className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 outline-none focus:ring-1 focus:ring-green-500" />
          <button onClick={doSend} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
