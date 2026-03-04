// Maps game building defId → Kenney sprite filename
// Each building type gets a distinct visual + level variants

export const SPRITE_MAP: Record<string, string[]> = {
  // Infrastructure
  house: [
    "low-detail-building-a.png",    // lv0
    "low-detail-building-b.png",    // lv1
    "low-detail-building-c.png",    // lv2
    "building-a.png",               // lv3+
  ],
  hospital: [
    "low-detail-building-h.png",
    "building-d.png",
    "building-h.png",
  ],
  police: [
    "low-detail-building-d.png",
    "low-detail-building-e.png",
    "building-b.png",
  ],
  park: [
    "detail-parasol-a.png",
    "detail-parasol-b.png",
    "detail-awning.png",
  ],

  // Income tier 1
  shop: [
    "low-detail-building-f.png",
    "low-detail-building-g.png",
    "building-c.png",
    "building-e.png",
  ],
  office: [
    "low-detail-building-i.png",
    "building-f.png",
    "building-g.png",
    "building-skyscraper-e.png",
  ],

  // Income tier 2 — verticals (skyscrapers)
  affiliate: [
    "building-i.png",
    "building-j.png",
    "building-skyscraper-a.png",
  ],
  casino: [
    "building-k.png",
    "building-l.png",
    "building-skyscraper-b.png",
  ],
  crypto: [
    "building-m.png",
    "building-n.png",
    "building-skyscraper-c.png",
  ],
  adnetwork: [
    "building-i.png",
    "building-j.png",
    "building-skyscraper-d.png",
  ],

  // Special
  datacenter: [
    "low-detail-building-wide-a.png",
    "low-detail-building-wide-b.png",
    "building-j.png",
  ],
  entertainment: [
    "low-detail-building-j.png",
    "low-detail-building-k.png",
    "building-e.png",
  ],
};

// Get sprite path for a building at given level
export function getSpriteForBuilding(defId: string, level: number): string {
  const variants = SPRITE_MAP[defId];
  if (!variants || variants.length === 0) return "low-detail-building-a.png";
  const idx = Math.min(level, variants.length - 1);
  return "/sprites/" + variants[idx];
}

// Ground tile sprite (we'll draw programmatically — grass)
export const GROUND_COLOR_A = "#8BC34A";
export const GROUND_COLOR_B = "#7CB342";
export const GROUND_EMPTY = "#9CCC65";

// Preload all sprites
const spriteCache = new Map<string, HTMLImageElement>();
let preloaded = false;

export function preloadSprites(): Promise<void> {
  if (preloaded) return Promise.resolve();
  const allFiles = new Set<string>();
  for (const variants of Object.values(SPRITE_MAP)) {
    for (const file of variants) allFiles.add(file);
  }

  const promises = Array.from(allFiles).map((file) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { spriteCache.set(file, img); resolve(); };
      img.onerror = () => resolve(); // skip broken
      img.src = "/sprites/" + file;
    });
  });

  return Promise.all(promises).then(() => { preloaded = true; });
}

export function getSprite(filename: string): HTMLImageElement | null {
  return spriteCache.get(filename) || null;
}
