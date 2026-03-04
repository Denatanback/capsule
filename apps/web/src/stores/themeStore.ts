import { create } from "zustand";

const STORAGE_KEY = "capsule_dark";

function getInitialDark(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  // Default to dark theme
  return true;
}

// Apply on load
const initialDark = typeof window !== "undefined" ? getInitialDark() : true;
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", initialDark);
}

export const useThemeStore = create((set) => ({
  dark: initialDark,
  toggle: () => set((s: any) => {
    const next = !s.dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, String(next));
    return { dark: next };
  }),
}));
