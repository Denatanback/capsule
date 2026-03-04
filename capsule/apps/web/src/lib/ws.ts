let socket = null;
let listeners = {};
let timer = null;

export function connectWs() {
  if (socket && socket.readyState < 2) return;
  const p = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(p + "//" + location.host + "/ws");
  socket.onopen = () => {
    const t = localStorage.getItem("capsule_token");
    if (t) send("auth", { token: t });
  };
  socket.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data);
      const cbs = listeners[event];
      if (cbs) cbs.forEach((cb) => cb(data));
    } catch {}
  };
  socket.onclose = () => { timer = setTimeout(connectWs, 2000); };
}

export function disconnectWs() {
  clearTimeout(timer);
  if (socket) { socket.close(); socket = null; }
}

export function send(event, data) {
  if (socket && socket.readyState === 1)
    socket.send(JSON.stringify({ event, data }));
}

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(cb);
  return () => { listeners[event]?.delete(cb); };
}
