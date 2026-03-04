// === CAPSULE CITY v2 — Full Economy + Progression ===

export interface BuildingDef {
  id: string;
  name: string;
  category: "infra" | "income" | "special";
  description: string;
  baseCost: number;
  buildTime: number;        // seconds
  incomePerMin: number;      // gross income
  upkeepPerMin: number;      // maintenance cost
  populationAdd: number;
  happinessAdd: number;
  maxLevel: number;
  upgradeCostMult: number;
  diminishingRate: number;   // 1.0 = no penalty, 0.5 = harsh diminishing
  requires?: string[];
  techBranch?: string;       // which tech tree branch unlocks this
  color: string;
  height: number;
  emoji: string;
  starter?: boolean;         // available in starter pick
}

export const BUILDINGS: BuildingDef[] = [
  // === INFRASTRUCTURE — no diminishing, low/no upkeep ===
  {
    id: "house", name: "Housing Block", category: "infra",
    description: "Basic residential. Foundation of your city.",
    baseCost: 80, buildTime: 20, incomePerMin: 0, upkeepPerMin: 0.5,
    populationAdd: 20, happinessAdd: 0,
    maxLevel: 10, upgradeCostMult: 1.4, diminishingRate: 1.0,
    color: "#5B8DEF", height: 2, emoji: "🏠", starter: true,
  },
  {
    id: "hospital", name: "Hospital", category: "infra",
    description: "Healthcare. Without it, random breakdowns happen.",
    baseCost: 250, buildTime: 45, incomePerMin: 0, upkeepPerMin: 2,
    populationAdd: 0, happinessAdd: 15,
    maxLevel: 5, upgradeCostMult: 1.7, diminishingRate: 0.85,
    color: "#F87171", height: 3, emoji: "🏥",
  },
  {
    id: "police", name: "Police Station", category: "infra",
    description: "Law & order. Required for income verticals.",
    baseCost: 200, buildTime: 35, incomePerMin: 0, upkeepPerMin: 1.5,
    populationAdd: 0, happinessAdd: 10,
    maxLevel: 5, upgradeCostMult: 1.6, diminishingRate: 0.9,
    color: "#3B82F6", height: 2, emoji: "🚔", starter: true,
  },
  {
    id: "park", name: "City Park", category: "infra",
    description: "Green space. Cheap happiness engine.",
    baseCost: 100, buildTime: 15, incomePerMin: 0, upkeepPerMin: 0.3,
    populationAdd: 5, happinessAdd: 20,
    maxLevel: 5, upgradeCostMult: 1.3, diminishingRate: 0.9,
    color: "#22C55E", height: 1, emoji: "🌳", starter: true,
  },

  // === INCOME TIER 1 ===
  {
    id: "shop", name: "Shopping Mall", category: "income",
    description: "Basic commerce. Reliable but modest returns.",
    baseCost: 350, buildTime: 50, incomePerMin: 5, upkeepPerMin: 1.5,
    populationAdd: 10, happinessAdd: 5,
    maxLevel: 8, upgradeCostMult: 1.5, diminishingRate: 0.7,
    requires: ["house"], color: "#F59E0B", height: 3, emoji: "🏬", starter: true,
  },
  {
    id: "office", name: "Office Tower", category: "income",
    description: "Corporate income. Gateway to verticals.",
    baseCost: 500, buildTime: 70, incomePerMin: 8, upkeepPerMin: 2.5,
    populationAdd: 15, happinessAdd: -5,
    maxLevel: 10, upgradeCostMult: 1.6, diminishingRate: 0.65,
    requires: ["house"], techBranch: "industry",
    color: "#6366F1", height: 4, emoji: "🏢",
  },

  // === INCOME TIER 2 — VERTICALS (heavy diminishing + upkeep) ===
  {
    id: "affiliate", name: "Affiliate Network HQ", category: "income",
    description: "CPA offers. High margins, heavy competition penalty.",
    baseCost: 1500, buildTime: 180, incomePerMin: 25, upkeepPerMin: 8,
    populationAdd: 20, happinessAdd: -10,
    maxLevel: 8, upgradeCostMult: 2.0, diminishingRate: 0.5,
    requires: ["office", "police"], techBranch: "media",
    color: "#8B5CF6", height: 5, emoji: "🔗",
  },
  {
    id: "casino", name: "Casino Resort", category: "income",
    description: "iGaming. Huge income, brutal upkeep and happiness hit.",
    baseCost: 2500, buildTime: 300, incomePerMin: 45, upkeepPerMin: 15,
    populationAdd: 30, happinessAdd: -25,
    maxLevel: 6, upgradeCostMult: 2.2, diminishingRate: 0.4,
    requires: ["office", "police", "hospital"], techBranch: "finance",
    color: "#EC4899", height: 5, emoji: "🎰",
  },
  {
    id: "crypto", name: "Crypto Exchange", category: "income",
    description: "Fintech. Good margins, moderate competition.",
    baseCost: 1800, buildTime: 200, incomePerMin: 30, upkeepPerMin: 10,
    populationAdd: 10, happinessAdd: -15,
    maxLevel: 7, upgradeCostMult: 2.0, diminishingRate: 0.5,
    requires: ["office", "police"], techBranch: "finance",
    color: "#F97316", height: 4, emoji: "₿",
  },
  {
    id: "adnetwork", name: "Ad Network Tower", category: "income",
    description: "Programmatic ads. Steady but diminishes fast.",
    baseCost: 1200, buildTime: 150, incomePerMin: 18, upkeepPerMin: 6,
    populationAdd: 15, happinessAdd: -5,
    maxLevel: 8, upgradeCostMult: 1.8, diminishingRate: 0.55,
    requires: ["office"], techBranch: "media",
    color: "#14B8A6", height: 4, emoji: "📡",
  },

  // === SPECIAL ===
  {
    id: "datacenter", name: "Data Center", category: "special",
    description: "Boosts ALL income +20%/level. Expensive to maintain.",
    baseCost: 5000, buildTime: 600, incomePerMin: 0, upkeepPerMin: 20,
    populationAdd: 5, happinessAdd: -10,
    maxLevel: 3, upgradeCostMult: 3.0, diminishingRate: 0.3,
    requires: ["office", "affiliate"], techBranch: "media",
    color: "#64748B", height: 3, emoji: "🖥️",
  },
  {
    id: "entertainment", name: "Entertainment Complex", category: "special",
    description: "Massive happiness. Offsets negative buildings.",
    baseCost: 2000, buildTime: 240, incomePerMin: 10, upkeepPerMin: 8,
    populationAdd: 40, happinessAdd: 40,
    maxLevel: 5, upgradeCostMult: 2.0, diminishingRate: 0.7,
    requires: ["house", "shop"], techBranch: "culture",
    color: "#A855F7", height: 4, emoji: "🎪",
  },
];

// === STARTER BUILDINGS (pick 2) ===
export const STARTER_BUILDINGS = BUILDINGS.filter((b) => b.starter);

// === TECH TREE ===
export interface TechNode {
  id: string;
  name: string;
  description: string;
  branch: string;
  cost: number;         // tech points
  requires?: string[];  // other tech node IDs
  unlocks: string[];    // building IDs
  emoji: string;
}

export const TECH_TREE: TechNode[] = [
  // Root
  { id: "mayor1", name: "Mayor Office", description: "Start your journey", branch: "root",
    cost: 0, unlocks: [], emoji: "🏛️" },

  // Industry branch
  { id: "industry1", name: "Commerce License", description: "Unlock offices", branch: "industry",
    cost: 5, requires: ["mayor1"], unlocks: ["office"], emoji: "📋" },
  { id: "finance1", name: "Financial District", description: "Unlock crypto & casino", branch: "finance",
    cost: 15, requires: ["industry1"], unlocks: ["crypto", "casino"], emoji: "💰" },

  // Media branch
  { id: "media1", name: "Media Hub", description: "Unlock ad networks", branch: "media",
    cost: 10, requires: ["industry1"], unlocks: ["adnetwork"], emoji: "📺" },
  { id: "media2", name: "Affiliate License", description: "Unlock affiliate HQ + data center", branch: "media",
    cost: 20, requires: ["media1"], unlocks: ["affiliate", "datacenter"], emoji: "🔗" },

  // Culture branch
  { id: "culture1", name: "Arts Council", description: "Unlock entertainment", branch: "culture",
    cost: 10, requires: ["mayor1"], unlocks: ["entertainment"], emoji: "🎭" },

  // Grid unlocks
  { id: "expand6", name: "City Expansion I", description: "Unlock 6×6 grid", branch: "expansion",
    cost: 25, requires: ["industry1"], unlocks: [], emoji: "📐" },
  { id: "expand7", name: "City Expansion II", description: "Unlock 7×7 grid", branch: "expansion",
    cost: 50, requires: ["expand6"], unlocks: [], emoji: "🗺️" },
  { id: "expand8", name: "City Expansion III", description: "Unlock 8×8 grid", branch: "expansion",
    cost: 100, requires: ["expand7"], unlocks: [], emoji: "🌆" },
];

// === MAYOR LEVELS ===
export const MAYOR_LEVELS = [
  { level: 1, xpRequired: 0, title: "Newcomer", techPoints: 0 },
  { level: 2, xpRequired: 100, title: "Settler", techPoints: 5 },
  { level: 3, xpRequired: 300, title: "Town Planner", techPoints: 5 },
  { level: 4, xpRequired: 600, title: "City Manager", techPoints: 10 },
  { level: 5, xpRequired: 1200, title: "Mayor", techPoints: 10 },
  { level: 6, xpRequired: 2000, title: "Governor", techPoints: 15 },
  { level: 7, xpRequired: 3500, title: "Senator", techPoints: 15 },
  { level: 8, xpRequired: 5500, title: "Tycoon", techPoints: 20 },
  { level: 9, xpRequired: 8000, title: "Mogul", techPoints: 20 },
  { level: 10, xpRequired: 12000, title: "Legend", techPoints: 25 },
];

// XP sources
export const XP_BUILD = 10;
export const XP_UPGRADE = 15;
export const XP_DAILY_LOGIN = 20;

// === ACHIEVEMENTS ===
export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (city: any) => boolean;
  reward: number; // bonus coins
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_building", name: "Foundation", description: "Build your first building", emoji: "🧱",
    check: (c) => (c.buildings || []).filter((b: any) => b.status === "built").length >= 1, reward: 50 },
  { id: "five_buildings", name: "Growing Town", description: "Have 5 buildings", emoji: "🏘️",
    check: (c) => (c.buildings || []).filter((b: any) => b.status === "built").length >= 5, reward: 200 },
  { id: "ten_buildings", name: "Urban Sprawl", description: "Have 10 buildings", emoji: "🌇",
    check: (c) => (c.buildings || []).filter((b: any) => b.status === "built").length >= 10, reward: 500 },
  { id: "pop100", name: "Centurion", description: "Reach 100 population", emoji: "👥",
    check: (c) => c.population >= 100, reward: 150 },
  { id: "pop500", name: "Metropolis", description: "Reach 500 population", emoji: "🏙️",
    check: (c) => c.population >= 500, reward: 1000 },
  { id: "happy80", name: "Paradise", description: "Reach 80% happiness", emoji: "😊",
    check: (c) => c.happiness >= 80, reward: 300 },
  { id: "coins10k", name: "First Fortune", description: "Accumulate 10,000 coins", emoji: "💰",
    check: (c) => c.coins >= 10000, reward: 500 },
  { id: "coins100k", name: "Millionaire Vibes", description: "Accumulate 100,000 coins", emoji: "💎",
    check: (c) => c.coins >= 100000, reward: 2000 },
  { id: "first_vertical", name: "Hustler", description: "Build your first income vertical", emoji: "🔥",
    check: (c) => (c.buildings || []).some((b: any) => ["affiliate", "casino", "crypto", "adnetwork"].includes(b.defId) && b.status === "built"), reward: 300 },
  { id: "all_verticals", name: "Empire Builder", description: "Build all 4 verticals", emoji: "👑",
    check: (c) => {
      const ids = new Set((c.buildings || []).filter((b: any) => b.status === "built").map((b: any) => b.defId));
      return ["affiliate", "casino", "crypto", "adnetwork"].every((v) => ids.has(v));
    }, reward: 5000 },
  { id: "datacenter", name: "Tech Lord", description: "Build a Data Center", emoji: "🖥️",
    check: (c) => (c.buildings || []).some((b: any) => b.defId === "datacenter" && b.status === "built"), reward: 1000 },
  { id: "streak7", name: "Dedicated Mayor", description: "7-day login streak", emoji: "🔥",
    check: (c) => (c.loginStreak || 0) >= 7, reward: 500 },
];

// === DAILY REWARDS ===
export const DAILY_REWARDS = [
  { day: 1, coins: 100, xp: 20 },
  { day: 2, coins: 150, xp: 25 },
  { day: 3, coins: 200, xp: 30 },
  { day: 4, coins: 300, xp: 35 },
  { day: 5, coins: 400, xp: 40 },
  { day: 6, coins: 500, xp: 50 },
  { day: 7, coins: 1000, xp: 100 },
];

// === ECONOMY HELPERS ===

export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function buildCost(def: BuildingDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.upgradeCostMult, level));
}

export function buildTimeForLevel(def: BuildingDef, level: number): number {
  return Math.floor(def.buildTime * Math.pow(1.2, level));
}

// Count how many of this type exist
function countOfType(buildings: any[], defId: string): number {
  return buildings.filter((b) => b.defId === defId && (b.status === "built" || b.status === "upgrading")).length;
}

// Diminishing return multiplier for Nth building of same type
export function diminishingMult(def: BuildingDef, existingCount: number): number {
  if (existingCount === 0) return 1.0;
  return Math.pow(def.diminishingRate, existingCount);
}

// Happiness multiplier on income
export function happinessMult(happiness: number): number {
  if (happiness >= 70) return 1.2;
  if (happiness >= 40) return 1.0;
  if (happiness >= 20) return 0.7;
  return 0.4;
}

// Grid size based on tech
export function gridSize(unlockedTech: string[]): number {
  if (unlockedTech.includes("expand8")) return 8;
  if (unlockedTech.includes("expand7")) return 7;
  if (unlockedTech.includes("expand6")) return 6;
  return 5;
}

// Calculate full economy for a city
export function calculateEconomy(buildings: any[], happiness: number, unlockedTech: string[]) {
  const hMult = happinessMult(happiness);
  const dc = buildings.find((b) => b.defId === "datacenter" && b.status === "built");
  const dcBonus = dc ? 1 + dc.level * 0.2 : 1;

  // Count per type for diminishing
  const typeCounts: Record<string, number> = {};
  const sorted = [...buildings].filter((b) => b.status === "built");

  let grossIncome = 0;
  let totalUpkeep = 0;

  for (const b of sorted) {
    const def = getBuildingDef(b.defId);
    if (!def) continue;

    // Upkeep scales with level
    const upkeep = def.upkeepPerMin * (1 + b.level * 0.3);
    totalUpkeep += upkeep;

    if (def.incomePerMin > 0) {
      const count = typeCounts[b.defId] || 0;
      typeCounts[b.defId] = count + 1;
      const dimMult = diminishingMult(def, count);
      const levelMult = 1 + b.level * 0.5;
      const dcMult = def.category === "income" ? dcBonus : 1;
      grossIncome += def.incomePerMin * levelMult * dimMult * dcMult * hMult;
    }
  }

  const netIncome = grossIncome - totalUpkeep;
  return {
    grossIncome: Math.round(grossIncome * 100) / 100,
    totalUpkeep: Math.round(totalUpkeep * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    happinessMult: hMult,
  };
}

// Offline earnings with full economy
export function calculateOfflineEarnings(buildings: any[], happiness: number, unlockedTech: string[], lastTickMs: number, nowMs: number) {
  const minutesPassed = Math.min((nowMs - lastTickMs) / 60000, 480);
  const econ = calculateEconomy(buildings, happiness, unlockedTech);
  // Net can be negative!
  const coins = econ.netIncome * minutesPassed;
  return { coins: Math.round(coins), minutesPassed: Math.floor(minutesPassed), ...econ };
}

// Population drain if happiness too low
export function populationDrain(happiness: number, population: number, minutesPassed: number): number {
  if (happiness < 30 && population > 10) {
    const drainRate = happiness < 15 ? 0.05 : 0.02; // 5% or 2% per minute
    return Math.floor(population * drainRate * Math.min(minutesPassed, 60));
  }
  return 0;
}

// Check building requirements including tech tree
export function canBuild(defId: string, existingBuildings: any[], unlockedTech: string[]): { ok: boolean; reason?: string } {
  const def = getBuildingDef(defId);
  if (!def) return { ok: false, reason: "Unknown building" };

  // Tech requirement
  if (def.techBranch) {
    const techNode = TECH_TREE.find((t) => t.unlocks.includes(defId));
    if (techNode && !unlockedTech.includes(techNode.id)) {
      return { ok: false, reason: "Requires tech: " + techNode.name };
    }
  }

  // Building requirements
  if (def.requires) {
    const builtIds = new Set(existingBuildings.filter((b) => b.status === "built").map((b) => b.defId));
    for (const req of def.requires) {
      if (!builtIds.has(req)) {
        const reqDef = getBuildingDef(req);
        return { ok: false, reason: "Requires: " + (reqDef?.name || req) };
      }
    }
  }

  return { ok: true };
}

export const MAX_GRID = 8;
