import { create } from "zustand";
import { api } from "../lib/api";

export const useGameStore = create((set, get) => ({
  city: null as any,
  economy: null as any,
  buildingDefs: [] as any[],
  techTree: [] as any[],
  mayorLevels: [] as any[],
  achievementDefs: [] as any[],
  starterBuildings: [] as any[],
  offlineEarnings: 0,
  dailyReward: null as any,
  newAchievements: [] as any[],
  leaderboard: [] as any[],
  loading: false,
  error: null as string | null,
  selectedSlot: null as { x: number; y: number } | null,
  selectedBuilding: null as any,
  viewMode: "city" as string,
  mapPlayers: [] as any[],
  viewingCity: null as any,
  viewingUser: null as any,

  fetchCity: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getCity();
      set({
        city: data.city, economy: data.economy,
        buildingDefs: data.buildingDefs, techTree: data.techTree,
        mayorLevels: data.mayorLevels, achievementDefs: data.achievements,
        starterBuildings: data.starterBuildings,
        offlineEarnings: data.offlineEarnings,
        dailyReward: data.dailyReward,
        newAchievements: data.newAchievements || [],
        loading: false,
      });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  pickStarter: async (picks: string[]) => {
    try { const data = await api.pickStarter(picks); set({ city: data.city }); }
    catch (e: any) { set({ error: e.message }); }
  },

  build: async (defId: string, gridX: number, gridY: number) => {
    try { const data = await api.buildBuilding(defId, gridX, gridY); set({ city: data.city, selectedSlot: null, error: null }); }
    catch (e: any) { set({ error: e.message }); }
  },

  upgrade: async (buildingId: string) => {
    try { const data = await api.upgradeBuilding(buildingId); set({ city: data.city, selectedBuilding: null, error: null }); }
    catch (e: any) { set({ error: e.message }); }
  },

  unlockTech: async (techId: string) => {
    try { const data = await api.unlockTech(techId); set({ city: data.city, error: null }); }
    catch (e: any) { set({ error: e.message }); }
  },

  collect: async () => {
    try { const data = await api.collectIncome(); set({ city: data.city, economy: data.economy }); } catch {}
  },

  fetchLeaderboard: async (type?: string, scope?: string) => {
    try { const data = await api.getLeaderboard(type, scope); set({ leaderboard: data.leaderboard }); } catch {}
  },

  toggleVisibility: async () => {
    const city = get().city;
    if (!city) return;
    try { const data = await api.setVisibility(!city.mapVisible); set({ city: data.city }); } catch {}
  },

  rename: async (name: string) => {
    try { const data = await api.renameCity(name); set({ city: data.city }); } catch {}
  },

  selectSlot: (x: number, y: number) => {
    const city = get().city;
    if (!city) return;
    const existing = (city.buildings || []).find((b: any) => b.gridX === x && b.gridY === y);
    if (existing) set({ selectedBuilding: existing, selectedSlot: null });
    else set({ selectedSlot: { x, y }, selectedBuilding: null });
  },

  clearSelection: () => set({ selectedSlot: null, selectedBuilding: null }),
  setViewMode: (mode: string) => set({ viewMode: mode }),
  clearError: () => set({ error: null }),
  clearNewAchievements: () => set({ newAchievements: [] }),

  explore: async () => {
    try { const data = await api.explorePlayers(); set({ mapPlayers: data.players }); } catch {}
  },
  searchMap: async (q: string) => {
    try { const data = await api.searchPlayers(q); set({ mapPlayers: data.players }); } catch {}
  },
  viewOtherCity: async (userId: string) => {
    try { const data = await api.viewCity(userId); set({ viewingCity: data.city, viewingUser: data.user }); } catch {}
  },
  clearViewing: () => set({ viewingCity: null, viewingUser: null }),
}));
