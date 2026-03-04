import { create } from "zustand";

export const useThemeStore = create((set) => ({
  dark: typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  toggle: () => set((s) => {
    const next = !s.dark;
    document.documentElement.classList.toggle("dark", next);
    return { dark: next };
  }),
}));
