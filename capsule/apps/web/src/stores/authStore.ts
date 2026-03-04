import { create } from "zustand";
import { api } from "../lib/api";

const TOKEN_KEY = "capsule_token";
const REFRESH_KEY = "capsule_refresh";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  logout: async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (refresh) {
      try { await api.logout({ refreshToken: refresh }); } catch {}
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ user: null, loading: false });
  },

  fetchUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { set({ loading: false }); return; }
    try {
      const { user } = await api.me();
      set({ user, loading: false, error: null });
    } catch (e) {
      // Try refresh
      const refreshed = await get().tryRefresh();
      if (refreshed) {
        try {
          const { user } = await api.me();
          set({ user, loading: false, error: null });
          return;
        } catch {}
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    const { token, refreshToken, user } = await api.login({ email, password });
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ user, error: null });
  },

  register: async (data) => {
    set({ error: null });
    const { token, refreshToken, user } = await api.register(data);
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ user, error: null });
  },

  // Attempt to refresh the access token
  tryRefresh: async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const { token, refreshToken } = await api.refresh({ refreshToken: refresh });
      localStorage.setItem(TOKEN_KEY, token);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
      return true;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      return false;
    }
  },
}));
