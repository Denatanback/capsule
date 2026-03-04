import { create } from "zustand";
import { api } from "../lib/api";

export const useFriendStore = create((set, get) => ({
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,

  fetchFriends: async () => {
    set({ loading: true });
    try {
      const data = await api.listFriends();
      set({ friends: data.friends, incoming: data.incoming, outgoing: data.outgoing, loading: false });
    } catch { set({ loading: false }); }
  },

  sendRequest: async (username) => {
    await api.sendFriendRequest(username);
    await get().fetchFriends();
  },

  accept: async (friendshipId) => {
    await api.acceptFriend(friendshipId);
    await get().fetchFriends();
  },

  decline: async (friendshipId) => {
    await api.declineFriend(friendshipId);
    await get().fetchFriends();
  },

  remove: async (friendshipId) => {
    await api.removeFriend(friendshipId);
    await get().fetchFriends();
  },
}));
