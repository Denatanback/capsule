import { create } from "zustand";
import { send, on } from "../lib/ws";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// Latency measurement: we create a DataChannel to each peer and ping/pong
function createPingChannel(pc, onRtt) {
  const dc = pc.createDataChannel("ping", { ordered: false, maxRetransmits: 0 });
  let pingTime = 0;
  let interval = null;
  dc.onopen = () => {
    interval = setInterval(() => {
      pingTime = performance.now();
      try { dc.send("ping"); } catch {}
    }, 2000);
  };
  dc.onmessage = (ev) => {
    if (ev.data === "pong") {
      const rtt = Math.round(performance.now() - pingTime);
      onRtt(rtt);
    }
  };
  dc.onclose = () => { if (interval) clearInterval(interval); };
  return dc;
}

function handlePingChannel(pc) {
  pc.ondatachannel = (ev) => {
    const dc = ev.channel;
    if (dc.label === "ping") {
      dc.onmessage = (msg) => {
        if (msg.data === "ping") {
          try { dc.send("pong"); } catch {}
        }
      };
    }
  };
}

export const useVoiceStore = create((set, get) => ({
  activeChannelId: null,
  users: [],
  peers: {},          // userId -> RTCPeerConnection
  localStream: null,
  muted: false,
  topology: null,     // current topology from server
  myNode: null,       // my node in topology
  remoteStreams: {},   // userId -> MediaStream (received from peers)
  latencies: {},      // userId -> rtt

  join: async (channelId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      set({ localStream: stream, activeChannelId: channelId, users: [], peers: {}, topology: null, myNode: null, remoteStreams: {}, latencies: {} });
      send("voice:join", { channelId });
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  },

  leave: () => {
    const s = get();
    if (s.localStream) s.localStream.getTracks().forEach((t) => t.stop());
    Object.values(s.peers).forEach((p) => p.close());
    if (s.activeChannelId) send("voice:leave", { channelId: s.activeChannelId });
    set({ activeChannelId: null, users: [], peers: {}, localStream: null, muted: false, topology: null, myNode: null, remoteStreams: {}, latencies: {} });
  },

  toggleMute: () => {
    const s = get();
    if (s.localStream) {
      const enabled = !s.muted;
      s.localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
      set({ muted: enabled });
    }
  },

  // Create peer connection to a remote user
  createPeer: (remoteUserId, initiator) => {
    const s = get();
    if (s.peers[remoteUserId]) return s.peers[remoteUserId];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks
    if (s.localStream) {
      s.localStream.getTracks().forEach((t) => pc.addTrack(t, s.localStream));
    }

    // If I'm a relay, also add streams I'm relaying
    const myNode = get().myNode;
    if (myNode && myNode.role === "relay") {
      const streams = get().remoteStreams;
      for (const [uid, stream] of Object.entries(streams)) {
        if (uid !== remoteUserId) {
          stream.getTracks().forEach((t) => {
            try { pc.addTrack(t, stream); } catch {}
          });
        }
      }
    }

    // Receive remote audio
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      set((prev) => ({ remoteStreams: { ...prev.remoteStreams, [remoteUserId]: stream } }));

      // Play audio
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play().catch(() => {});

      // If I'm relay, forward this stream to other peers
      const node = get().myNode;
      if (node && node.role === "relay") {
        const peers = get().peers;
        for (const [uid, peer] of Object.entries(peers)) {
          if (uid !== remoteUserId) {
            stream.getTracks().forEach((t) => {
              try { peer.addTrack(t, stream); } catch {}
            });
          }
        }
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        send("voice:ice-candidate", {
          targetUserId: remoteUserId,
          channelId: s.activeChannelId,
          candidate: ev.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        pc.close();
        set((prev) => {
          const np = { ...prev.peers };
          delete np[remoteUserId];
          const ns = { ...prev.remoteStreams };
          delete ns[remoteUserId];
          return { peers: np, remoteStreams: ns };
        });
      }
    };

    // Setup latency measurement
    if (initiator) {
      createPingChannel(pc, (rtt) => {
        set((prev) => ({ latencies: { ...prev.latencies, [remoteUserId]: rtt } }));
        send("voice:latency", { targetUserId: remoteUserId, channelId: get().activeChannelId, rtt });
      });
    }
    handlePingChannel(pc);

    set((prev) => ({ peers: { ...prev.peers, [remoteUserId]: pc } }));

    if (initiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        send("voice:offer", { targetUserId: remoteUserId, channelId: s.activeChannelId, offer });
      });
    }

    return pc;
  },

  handleOffer: async (data) => {
    const { userId: remoteUserId, offer, channelId } = data;
    const s = get();
    if (s.activeChannelId !== channelId) return;
    const pc = get().createPeer(remoteUserId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send("voice:answer", { targetUserId: remoteUserId, channelId, answer });
  },

  handleAnswer: async (data) => {
    const { userId: remoteUserId, answer } = data;
    const pc = get().peers[remoteUserId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  },

  handleIceCandidate: async (data) => {
    const { userId: remoteUserId, candidate } = data;
    const pc = get().peers[remoteUserId];
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  },

  handleUserJoined: (data) => {
    const { userId: remoteUserId } = data;
    // Only create direct peer if topology says so, or if no topology yet (< 3 users)
    const topo = get().topology;
    if (!topo) {
      get().createPeer(remoteUserId, true);
    }
    // If topology exists, wait for server to send updated topology
  },

  handleUserLeft: (data) => {
    const { userId: remoteUserId } = data;
    const pc = get().peers[remoteUserId];
    if (pc) pc.close();
    set((prev) => {
      const np = { ...prev.peers };
      delete np[remoteUserId];
      const ns = { ...prev.remoteStreams };
      delete ns[remoteUserId];
      return { peers: np, remoteStreams: ns };
    });
  },

  handleJoined: (data) => {
    const { users } = data;
    // Create peers to all existing users
    users.forEach((uid) => get().createPeer(uid, true));
  },

  handleVoiceUsers: (data) => {
    set({ users: data.users || [] });
  },

  // Handle topology update from server
  handleTopology: (data) => {
    const { topology, myNode, channelId } = data;
    const s = get();
    if (s.activeChannelId !== channelId) return;

    const prevNode = s.myNode;
    set({ topology, myNode });

    if (!myNode) return;

    // Close connections to peers we no longer need
    const needed = new Set(myNode.connectTo);
    for (const [uid, pc] of Object.entries(s.peers)) {
      if (!needed.has(uid)) {
        pc.close();
        set((prev) => {
          const np = { ...prev.peers };
          delete np[uid];
          return { peers: np };
        });
      }
    }

    // Create connections to peers we need
    for (const uid of myNode.connectTo) {
      if (!s.peers[uid]) {
        get().createPeer(uid, true);
      }
    }

    console.log("Topology updated. Role:", myNode.role, "Connections:", myNode.connectTo);
  },

  // Handle latency measurement request from server
  handleMeasureLatency: (data) => {
    // Already handled via DataChannel pings
    // This just signals us to start measuring (pings are automatic)
  },
}));
