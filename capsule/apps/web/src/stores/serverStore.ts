import { create } from "zustand";
import { api } from "../lib/api";

export const useServerStore = create((set, get) => ({
  servers: [],
  activeServerId: null,
  activeChannelId: null,
  serverDetail: null,
  loading: false,

  fetchServers: async () => {
    set({ loading: true });
    try {
      const { servers } = await api.listServers();
      set({ servers, loading: false });
    } catch (e) {
      set({ loading: false });
    }
  },

  selectServer: async (serverId) => {
    set({ activeServerId: serverId, activeChannelId: null, serverDetail: null });
    if (!serverId) return;
    try {
      const { server, myRole } = await api.getServer(serverId);
      set({
        serverDetail: { ...server, myRole },
        activeChannelId: server.channels?.[0]?.id || null,
      });
    } catch (e) {
      console.error("Failed to load server", e);
    }
  },

  selectChannel: (channelId) => set({ activeChannelId: channelId }),

  createServer: async (name) => {
    const { server } = await api.createServer(name);
    set((s) => ({ servers: [...s.servers, { ...server, myRole: "OWNER" }] }));
    return server;
  },

  joinServer: async (serverId) => {
    await api.joinServer(serverId);
    await get().fetchServers();
  },

  leaveServer: async (serverId) => {
    await api.leaveServer(serverId);
    set((s) => ({
      servers: s.servers.filter((sv) => sv.id !== serverId),
      activeServerId: s.activeServerId === serverId ? null : s.activeServerId,
      serverDetail: s.activeServerId === serverId ? null : s.serverDetail,
    }));
  },

  deleteServer: async (serverId) => {
    await api.deleteServer(serverId);
    set((s) => ({
      servers: s.servers.filter((sv) => sv.id !== serverId),
      activeServerId: null,
      serverDetail: null,
    }));
  },

  createChannel: async (name, type) => {
    const state = get();
    if (!state.activeServerId) return;
    const { channel } = await api.createChannel(state.activeServerId, { name, type: type || "TEXT" });
    if (state.serverDetail) {
      set({
        serverDetail: {
          ...state.serverDetail,
          channels: [...state.serverDetail.channels, channel],
        },
      });
    }
    return channel;
  },

  deleteChannel: async (channelId) => {
    const state = get();
    if (!state.activeServerId) return;
    await api.deleteChannel(state.activeServerId, channelId);
    if (state.serverDetail) {
      const channels = state.serverDetail.channels.filter((c) => c.id !== channelId);
      set({
        serverDetail: { ...state.serverDetail, channels },
        activeChannelId: state.activeChannelId === channelId ? channels[0]?.id || null : state.activeChannelId,
      });
    }
  },
}));
