import { create } from "zustand";

export const usePresenceStore = create((set, get) => ({
  onlineUsers: [] as string[],
  typingUsers: {} as Record<string, string[]>,

  setOnlineUsers: (ids: string[]) => set({ onlineUsers: ids }),

  onPresence: (data: { userId: string; status: string }) => {
    set((s: any) => {
      const prev = s.onlineUsers;
      // ONLINE, IDLE, DND are all "online" states; only OFFLINE removes
      if (data.status !== "OFFLINE") {
        return { onlineUsers: prev.includes(data.userId) ? prev : [...prev, data.userId] };
      } else {
        return { onlineUsers: prev.filter((id: string) => id !== data.userId) };
      }
    });
  },

  onTyping: (data: { userId: string; channelId: string; typing: boolean }) => {
    set((s: any) => {
      const prev = s.typingUsers[data.channelId] || [];
      let next;
      if (data.typing) {
        next = prev.includes(data.userId) ? prev : [...prev, data.userId];
      } else {
        next = prev.filter((id: string) => id !== data.userId);
      }
      return { typingUsers: { ...s.typingUsers, [data.channelId]: next } };
    });
  },
}));
