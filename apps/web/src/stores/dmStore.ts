import { create } from "zustand";
import { api } from "../lib/api";
import { send } from "../lib/ws";

export const useDMStore = create((set, get) => ({
  channels: [],
  activeDMId: null,
  messages: {},
  loading: false,

  fetchChannels: async () => {
    try {
      const data = await api.listDMs();
      set({ channels: data.channels });
    } catch {}
  },

  openDM: async (targetUserId) => {
    const data = await api.openDM(targetUserId);
    const ch = data.channel;
    set((s) => {
      const exists = s.channels.find((c) => c.id === ch.id);
      return {
        channels: exists ? s.channels : [ch, ...s.channels],
        activeDMId: ch.id,
      };
    });
    await get().fetchMessages(ch.id);
    return ch;
  },

  selectDM: (dmId) => {
    set({ activeDMId: dmId });
    if (dmId) get().fetchMessages(dmId);
  },

  fetchMessages: async (dmId) => {
    set({ loading: true });
    try {
      const data = await api.getDMMessages(dmId);
      set((s) => ({
        messages: { ...s.messages, [dmId]: data.messages },
        loading: false,
      }));
    } catch { set({ loading: false }); }
  },

  sendMessage: (dmChannelId, content) => {
    
    send("dm:send", { dmChannelId, content });
  },

  editMessage: (messageId, content) => {
    
    send("dm:edit", { messageId, content });
  },

  deleteMessage: (messageId) => {
    
    send("dm:delete", { messageId });
  },

  onNew: (msg) => {
    set((s) => {
      const dmId = msg.dmChannelId;
      const prev = s.messages[dmId] || [];
      if (prev.find((m) => m.id === msg.id)) return s;
      return { messages: { ...s.messages, [dmId]: [...prev, msg] } };
    });
  },

  onEdited: (msg) => {
    set((s) => {
      const dmId = msg.dmChannelId;
      const prev = s.messages[dmId] || [];
      return { messages: { ...s.messages, [dmId]: prev.map((m) => m.id === msg.id ? msg : m) } };
    });
  },

  onDeleted: (data) => {
    set((s) => {
      const prev = s.messages[data.dmChannelId] || [];
      return { messages: { ...s.messages, [data.dmChannelId]: prev.filter((m) => m.id !== data.id) } };
    });
  },
}));
