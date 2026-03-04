import { create } from "zustand";
import { api } from "../lib/api";

// Notification sound — tiny inline beep
let audioCtx: AudioContext | null = null;
function playNotifSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {}
}

// Browser notification
function showBrowserNotif(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

export const useNotificationStore = create((set, get) => ({
  channelUnreads: {} as Record<string, number>,
  serverUnreads: {} as Record<string, number>,
  dmUnreads: {} as Record<string, number>,
  soundEnabled: true,
  browserNotifsEnabled: false,

  // Fetch all unread counts from server
  fetchUnreads: async () => {
    try {
      const data = await api.getUnread();
      set({
        channelUnreads: data.channelUnreads || {},
        serverUnreads: data.serverUnreads || {},
        dmUnreads: data.dmUnreads || {},
      });
    } catch {}
  },

  // Mark channel as read (call API + clear local count)
  markChannelRead: async (channelId: string) => {
    try {
      await api.markChannelRead(channelId);
      set((s: any) => {
        const cu = { ...s.channelUnreads };
        delete cu[channelId];
        return { channelUnreads: cu };
      });
    } catch {}
  },

  // Mark DM as read
  markDMRead: async (dmChannelId: string) => {
    try {
      await api.markDMRead(dmChannelId);
      set((s: any) => {
        const du = { ...s.dmUnreads };
        delete du[dmChannelId];
        return { dmUnreads: du };
      });
    } catch {}
  },

  // Called when a new message arrives (from WS)
  onNewMessage: (msg: any, activeChannelId: string | null) => {
    const s = get();
    const chId = msg.channelId;
    // If not currently viewing this channel, increment unread
    if (chId && chId !== activeChannelId) {
      set((prev: any) => ({
        channelUnreads: {
          ...prev.channelUnreads,
          [chId]: (prev.channelUnreads[chId] || 0) + 1,
        },
      }));
      if (s.soundEnabled) playNotifSound();
      if (s.browserNotifsEnabled) {
        showBrowserNotif(
          msg.author?.displayName || "New message",
          msg.content?.slice(0, 100) || "Sent a file"
        );
      }
    }
  },

  // Called when a new DM arrives
  onNewDM: (msg: any, activeDMId: string | null) => {
    const s = get();
    const dmId = msg.dmChannelId;
    if (dmId && dmId !== activeDMId) {
      set((prev: any) => ({
        dmUnreads: {
          ...prev.dmUnreads,
          [dmId]: (prev.dmUnreads[dmId] || 0) + 1,
        },
      }));
      if (s.soundEnabled) playNotifSound();
      if (s.browserNotifsEnabled) {
        showBrowserNotif(
          msg.author?.displayName || "New DM",
          msg.content?.slice(0, 100) || "Sent a file"
        );
      }
    }
  },

  // Request browser notification permission
  requestBrowserPermission: async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      set({ browserNotifsEnabled: perm === "granted" });
    }
  },

  toggleSound: () => set((s: any) => ({ soundEnabled: !s.soundEnabled })),

  // Total unread for DM sidebar icon
  totalDMUnread: () => {
    const s = get();
    return Object.values(s.dmUnreads).reduce((a: number, b: number) => a + b, 0);
  },
}));
