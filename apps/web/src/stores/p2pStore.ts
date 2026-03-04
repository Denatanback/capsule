import { create } from "zustand";
import { send, on } from "../lib/ws";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export const useP2PStore = create((set, get) => ({
  // Active P2P session: targetUserId we're chatting with
  activeP2P: null,        // userId of peer
  p2pStatus: "idle",      // idle | requesting | incoming | connecting | connected
  peer: null,             // RTCPeerConnection
  dataChannel: null,      // RTCDataChannel
  messages: [],           // { id, from, content, timestamp }
  incomingFrom: null,     // userId requesting P2P with us

  // Request P2P session with a friend
  requestP2P: (targetUserId) => {
    set({ activeP2P: targetUserId, p2pStatus: "requesting", messages: [] });
    send("p2p:request", { targetUserId });
  },

  // Accept incoming P2P request (we are the receiver, so we wait for offer)
  acceptP2P: () => {
    const s = get();
    if (!s.incomingFrom) return;
    set({ activeP2P: s.incomingFrom, p2pStatus: "connecting", incomingFrom: null, messages: [] });
    send("p2p:accept", { targetUserId: s.incomingFrom });
  },

  declineP2P: () => {
    const s = get();
    if (s.incomingFrom) send("p2p:decline", { targetUserId: s.incomingFrom });
    set({ incomingFrom: null, p2pStatus: "idle" });
  },

  // End P2P session
  endP2P: () => {
    const s = get();
    if (s.dataChannel) try { s.dataChannel.close(); } catch {}
    if (s.peer) try { s.peer.close(); } catch {}
    if (s.activeP2P) send("p2p:end", { targetUserId: s.activeP2P });
    set({ activeP2P: null, p2pStatus: "idle", peer: null, dataChannel: null, messages: [], incomingFrom: null });
  },

  // Send a message over DataChannel
  sendP2P: (content) => {
    const s = get();
    if (!s.dataChannel || s.dataChannel.readyState !== "open") return;
    const msg = { id: crypto.randomUUID(), from: "me", content, timestamp: Date.now() };
    try {
      s.dataChannel.send(JSON.stringify({ type: "msg", content }));
      set((prev) => ({ messages: [...prev.messages, msg] }));
    } catch {}
  },

  // === Internal: create peer connection as initiator ===
  _createPeerAsInitiator: (targetUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) send("p2p:ice", { targetUserId, candidate: ev.candidate });
    };

    const dc = pc.createDataChannel("p2p-chat", { ordered: true });
    dc.onopen = () => set({ p2pStatus: "connected", dataChannel: dc });
    dc.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "msg") {
          const msg = { id: crypto.randomUUID(), from: "peer", content: data.content, timestamp: Date.now() };
          set((prev) => ({ messages: [...prev.messages, msg] }));
        }
      } catch {}
    };
    dc.onclose = () => {
      // Peer closed, end session
      const s = get();
      if (s.p2pStatus === "connected") {
        set({ p2pStatus: "idle", activeP2P: null, peer: null, dataChannel: null, messages: [] });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        get().endP2P();
      }
    };

    set({ peer: pc, dataChannel: null });

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      send("p2p:offer", { targetUserId, offer });
    });
  },

  // === Internal: create peer as receiver ===
  _createPeerAsReceiver: (fromUserId, offer) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) send("p2p:ice", { targetUserId: fromUserId, candidate: ev.candidate });
    };

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.onopen = () => set({ p2pStatus: "connected", dataChannel: dc });
      dc.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "msg") {
            const m = { id: crypto.randomUUID(), from: "peer", content: data.content, timestamp: Date.now() };
            set((prev) => ({ messages: [...prev.messages, m] }));
          }
        } catch {}
      };
      dc.onclose = () => {
        const s = get();
        if (s.p2pStatus === "connected") {
          set({ p2pStatus: "idle", activeP2P: null, peer: null, dataChannel: null, messages: [] });
        }
      };
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        get().endP2P();
      }
    };

    set({ peer: pc });

    pc.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
      return pc.createAnswer();
    }).then((answer) => {
      pc.setLocalDescription(answer);
      send("p2p:answer", { targetUserId: fromUserId, answer });
    });
  },

  // === WS event handlers ===
  onRequest: (data) => {
    const s = get();
    // Already in a P2P session
    if (s.activeP2P || s.p2pStatus !== "idle") {
      send("p2p:decline", { targetUserId: data.fromUserId });
      return;
    }
    set({ incomingFrom: data.fromUserId, p2pStatus: "incoming" });
  },

  onAccept: (data) => {
    const s = get();
    if (s.p2pStatus !== "requesting" || s.activeP2P !== data.fromUserId) return;
    set({ p2pStatus: "connecting" });
    // We are initiator, create offer
    get()._createPeerAsInitiator(data.fromUserId);
  },

  onDecline: (data) => {
    const s = get();
    if (s.activeP2P === data.fromUserId) {
      set({ activeP2P: null, p2pStatus: "idle" });
    }
  },

  onOffer: (data) => {
    const s = get();
    if (s.p2pStatus !== "connecting" || s.activeP2P !== data.fromUserId) return;
    get()._createPeerAsReceiver(data.fromUserId, data.offer);
  },

  onAnswer: (data) => {
    const pc = get().peer;
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  },

  onIce: (data) => {
    const pc = get().peer;
    if (pc) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
  },

  onEnd: (data) => {
    const s = get();
    if (s.activeP2P === data.fromUserId || s.incomingFrom === data.fromUserId) {
      if (s.dataChannel) try { s.dataChannel.close(); } catch {}
      if (s.peer) try { s.peer.close(); } catch {}
      set({ activeP2P: null, p2pStatus: "idle", peer: null, dataChannel: null, messages: [], incomingFrom: null });
    }
  },
}));
