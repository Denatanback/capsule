import { create } from "zustand";
import { send } from "../lib/ws";

export const useMessageStore = create((set) => ({
  messages: {},
  loading: false,

  fetchMessages: async (channelId) => {
    set({ loading: true });
    try {
      const token = localStorage.getItem("capsule_token");
      const res = await fetch("/api/channels/" + channelId + "/messages", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      set((s) => ({ messages: { ...s.messages, [channelId]: data.messages }, loading: false }));
    } catch { set({ loading: false }); }
  },

  sendMessage: (chId, content, fileIds) => send("message:send", { channelId: chId, content, fileIds }),
  editMessage: (msgId, content) => send("message:edit", { messageId: msgId, content }),
  deleteMessage: (msgId) => send("message:delete", { messageId: msgId }),

  onNew: (msg) => set((s) => {
    const prev = s.messages[msg.channelId] || [];
    if (prev.some((m) => m.id === msg.id)) return s;
    return { messages: { ...s.messages, [msg.channelId]: [...prev, msg] } };
  }),
  onEdited: (msg) => set((s) => {
    const prev = s.messages[msg.channelId] || [];
    return { messages: { ...s.messages, [msg.channelId]: prev.map((m) => m.id === msg.id ? msg : m) } };
  }),
  onDeleted: (d) => set((s) => {
    const prev = s.messages[d.channelId] || [];
    return { messages: { ...s.messages, [d.channelId]: prev.filter((m) => m.id !== d.id) } };
  }),
}));
