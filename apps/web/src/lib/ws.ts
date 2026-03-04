let socket: WebSocket | null = null;
let listeners: Record<string, Set<Function>> = {};
let timer: any = null;
let authRetryTimer: any = null;

export function connectWs() {
  if (socket && socket.readyState < 2) return;
  const p = location.protocol === "https:" ? "wss:" : "ws:";
  // In production (nginx proxies /ws), use same host:port
  // In dev (vite proxy on 5173), also use same host:port since vite proxies /ws
  const wsHost = location.host;
  socket = new WebSocket(p + "//" + wsHost + "/ws");
  socket.onopen = () => {
    doAuth();
  };
  socket.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data);
      const cbs = listeners[event];
      if (cbs) cbs.forEach((cb) => cb(data));
    } catch {}
  };
  socket.onclose = () => { timer = setTimeout(connectWs, 2000); };
  socket.onerror = () => {};
}

// Authenticate WS with current token
function doAuth() {
  const t = localStorage.getItem("capsule_token");
  if (t) {
    send("auth", { token: t });
  } else {
    // Token not ready yet — retry in 500ms
    clearTimeout(authRetryTimer);
    authRetryTimer = setTimeout(doAuth, 500);
  }
}

// Re-authenticate after token refresh (call this from api.ts after refresh)
export function reauthWs() {
  const t = localStorage.getItem("capsule_token");
  if (t && socket && socket.readyState === 1) {
    send("auth", { token: t });
  }
}

// Force reconnect (call after login/logout)
export function reconnectWs() {
  if (socket) {
    socket.onclose = null; // prevent auto-reconnect loop
    socket.close();
    socket = null;
  }
  clearTimeout(timer);
  connectWs();
}

export function disconnectWs() {
  clearTimeout(timer);
  clearTimeout(authRetryTimer);
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
}

export function send(event: string, data: any) {
  if (socket && socket.readyState === 1)
    socket.send(JSON.stringify({ event, data }));
}

export function on(event: string, cb: Function) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(cb);
  return () => { listeners[event]?.delete(cb); };
}

export function isConnected() {
  return socket && socket.readyState === 1;
}
