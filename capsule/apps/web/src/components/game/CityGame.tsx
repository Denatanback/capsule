import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import IsometricCity from "./IsometricCity";

export default function CityGame() {
  const g = useGameStore();
  const [showOffline, setShowOffline] = useState(false);
  const [starterPicks, setStarterPicks] = useState<string[]>([]);

  useEffect(() => { g.fetchCity(); }, []);
  useEffect(() => { if (g.offlineEarnings !== 0) setShowOffline(true); }, [g.offlineEarnings]);
  useEffect(() => { const iv = setInterval(() => g.collect(), 30000); return () => clearInterval(iv); }, []);

  if (g.loading && !g.city) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center"><p className="text-2xl mb-2">🏙️</p><p className="text-sm" style={{color:"var(--text-muted)"}}>Loading...</p></div>
    </div>
  );
  if (!g.city) return null;

  const city = g.city;
  const buildings = (city.buildings || []) as any[];
  const tech = (city.unlockedTech || []) as string[];
  const grid = tech.includes("expand8") ? 8 : tech.includes("expand7") ? 7 : tech.includes("expand6") ? 6 : 5;
  const defMap = new Map(g.buildingDefs.map((d: any) => [d.id, d]));
  const queueCount = (city.buildQueue || []).length;
  const mayorInfo = g.mayorLevels.find((m: any) => m.level === city.mayorLevel) || { title: "Mayor" };
  const nextLevel = g.mayorLevels.find((m: any) => m.level === city.mayorLevel + 1);
  const selectedDef = g.selectedBuilding ? defMap.get(g.selectedBuilding.defId) : null;

  // === STARTER PICKER ===
  if (!city.starterPicked) {
    const togglePick = (id: string) => {
      setStarterPicks((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 2 ? [...p, id] : p);
    };
    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{background:"var(--bg-chat)"}}>
        <div className="max-w-md w-full text-center fade-in">
          <p className="text-4xl mb-3">🏙️</p>
          <h2 className="text-xl font-bold mb-1" style={{color:"var(--text-primary)"}}>Welcome to Capsule City!</h2>
          <p className="text-sm mb-6" style={{color:"var(--text-muted)"}}>Choose 2 starter buildings to begin your empire</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {g.starterBuildings.map((def: any) => (
              <button key={def.id} onClick={() => togglePick(def.id)}
                className={"p-4 rounded-xl text-left transition-all hover-lift " + (starterPicks.includes(def.id) ? "ring-2" : "")}
                style={{background:"var(--bg-secondary)", border:"1px solid var(--border)",
                  ringColor: starterPicks.includes(def.id) ? "var(--accent)" : "transparent"}}>
                <span className="text-2xl">{def.emoji}</span>
                <p className="text-sm font-bold mt-1" style={{color:"var(--text-primary)"}}>{def.name}</p>
                <p className="text-[10px] mt-1" style={{color:"var(--text-muted)"}}>{def.description}</p>
              </button>
            ))}
          </div>
          <button onClick={() => starterPicks.length === 2 && g.pickStarter(starterPicks)}
            disabled={starterPicks.length !== 2}
            className="px-8 py-3 rounded-xl font-bold text-white disabled:opacity-40 hover-lift"
            style={{background:"var(--accent)"}}>
            Start Building ({starterPicks.length}/2)
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "city", label: "🏙️ City" },
    { id: "tech", label: "🔬 Tech" },
    { id: "leaderboard", label: "🏆 Rank" },
    { id: "achievements", label: "⭐ Medals" },
    { id: "map", label: "🌍 Map" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{background:"var(--bg-chat)"}}>
      {/* Offline + daily + achievements popup */}
      {showOffline && g.offlineEarnings !== 0 && (
        <div className="fade-in px-4 py-2 flex items-center justify-between" style={{background: g.offlineEarnings > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderBottom:"1px solid var(--border)"}}>
          <div className="flex items-center gap-2">
            <span>{g.offlineEarnings > 0 ? "💰" : "📉"}</span>
            <p className="text-xs" style={{color: g.offlineEarnings > 0 ? "var(--success)" : "var(--danger)"}}>
              {g.offlineEarnings > 0 ? `+${Math.floor(g.offlineEarnings)} coins while away` : `${Math.floor(g.offlineEarnings)} coins (upkeep exceeded income!)`}
            </p>
          </div>
          <button onClick={() => setShowOffline(false)} className="text-xs font-medium px-2 py-1 rounded-lg" style={{background:"var(--bg-tertiary)"}}>OK</button>
        </div>
      )}
      {g.dailyReward && (
        <div className="fade-in px-4 py-2 flex items-center justify-between" style={{background:"rgba(99,102,241,0.1)", borderBottom:"1px solid var(--border)"}}>
          <p className="text-xs" style={{color:"var(--accent)"}}>🔥 Day {city.loginStreak} streak! +{g.dailyReward.coins} coins, +{g.dailyReward.xp} XP</p>
        </div>
      )}
      {g.error && (
        <div className="fade-in px-4 py-2 flex items-center justify-between" style={{background:"rgba(239,68,68,0.1)", borderBottom:"1px solid var(--border)"}}>
          <p className="text-xs" style={{color:"var(--danger)"}}>{g.error}</p>
          <button onClick={g.clearError} className="text-xs" style={{color:"var(--danger)"}}>✕</button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b gap-2" style={{borderColor:"var(--border)"}}>
        <div className="flex items-center gap-3 overflow-x-auto text-xs shrink-0">
          <span className="font-bold" style={{color:"var(--text-primary)"}}>🏙️ {city.cityName}</span>
          <span style={{color:"var(--warning)"}}>💰{Math.floor(city.coins).toLocaleString()}</span>
          <span style={{color:"var(--accent)"}}>👥{city.population}</span>
          <span style={{color: city.happiness >= 50 ? "var(--success)" : "var(--danger)"}}>
            {city.happiness >= 70 ? "😊" : city.happiness >= 40 ? "😐" : "😞"}{city.happiness}%
          </span>
          {g.economy && <span style={{color: g.economy.netIncome >= 0 ? "var(--success)" : "var(--danger)"}}>
            {g.economy.netIncome >= 0 ? "📈" : "📉"}{g.economy.netIncome.toFixed(1)}/m
          </span>}
          <span style={{color:"var(--text-muted)"}}>🎓Lv{city.mayorLevel} {mayorInfo.title}</span>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { g.setViewMode(t.id); if (t.id === "leaderboard") g.fetchLeaderboard(); if (t.id === "map") g.explore(); }}
              className={"px-2 py-1 rounded-lg text-[10px] font-semibold transition-all " + (g.viewMode === t.id ? "" : "opacity-50")}
              style={{background: g.viewMode === t.id ? "var(--accent-soft)" : "transparent", color:"var(--accent)"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CITY VIEW */}
      {g.viewMode === "city" && (<>
        <div className="flex-1 min-h-0 overflow-hidden" style={{background:"linear-gradient(180deg,#87CEEB 0%,#E0F0E8 100%)"}}>
          <IsometricCity buildings={buildings} buildingDefs={g.buildingDefs} selectedSlot={g.selectedSlot}
            onClickTile={(gx, gy) => { if (gx < grid && gy < grid) g.selectSlot(gx, gy); }} gridSize={grid} />
        </div>
        <BottomPanel city={city} defMap={defMap} grid={grid} queueCount={queueCount}
          buildingDefs={g.buildingDefs} buildings={buildings} tech={tech}
          selectedSlot={g.selectedSlot} selectedBuilding={g.selectedBuilding} selectedDef={selectedDef}
          economy={g.economy}
          onBuild={g.build} onUpgrade={g.upgrade} onClear={g.clearSelection} />
      </>)}

      {/* TECH VIEW */}
      {g.viewMode === "tech" && <TechView techTree={g.techTree} unlockedTech={tech} techPoints={city.techPoints} onUnlock={g.unlockTech} />}

      {/* LEADERBOARD VIEW */}
      {g.viewMode === "leaderboard" && <LeaderboardView leaderboard={g.leaderboard} onFetch={g.fetchLeaderboard} />}

      {/* ACHIEVEMENTS VIEW */}
      {g.viewMode === "achievements" && <AchievementsView defs={g.achievementDefs} unlocked={city.achievements || []}
        mayorLevel={city.mayorLevel} mayorXp={city.mayorXp} mayorLevels={g.mayorLevels} streak={city.loginStreak} />}

      {/* MAP VIEW */}
      {g.viewMode === "map" && <MapView />}
    </div>
  );
}

// === BOTTOM PANEL ===
function BottomPanel({ city, defMap, grid, queueCount, buildingDefs, buildings, tech, selectedSlot, selectedBuilding, selectedDef, economy, onBuild, onUpgrade, onClear }: any) {
  const available = buildingDefs.filter((def: any) => {
    if (def.requires) {
      const builtIds = new Set(buildings.filter((b: any) => b.status === "built").map((b: any) => b.defId));
      if (!def.requires.every((r: string) => builtIds.has(r))) return false;
    }
    if (def.techBranch) {
      const node = useGameStore.getState().techTree.find((t: any) => t.unlocks.includes(def.id));
      if (node && !tech.includes(node.id)) return false;
    }
    return true;
  });

  return (
    <div className="border-t overflow-y-auto" style={{borderColor:"var(--border)", maxHeight:"180px"}}>
      {/* Economy summary */}
      {economy && !selectedSlot && !selectedBuilding && (
        <div className="px-3 py-2 flex gap-4 text-[10px] border-b" style={{borderColor:"var(--border)", color:"var(--text-muted)"}}>
          <span>Income: <b style={{color:"var(--success)"}}>{economy.grossIncome.toFixed(1)}/m</b></span>
          <span>Upkeep: <b style={{color:"var(--danger)"}}>{economy.totalUpkeep.toFixed(1)}/m</b></span>
          <span>Net: <b style={{color: economy.netIncome >= 0 ? "var(--success)" : "var(--danger)"}}>{economy.netIncome.toFixed(1)}/m</b></span>
          <span>Mood bonus: <b>{economy.happinessMult}x</b></span>
        </div>
      )}

      {selectedSlot && (
        <div className="p-3 fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{color:"var(--text-primary)"}}>Build at ({selectedSlot.x},{selectedSlot.y}) {queueCount >= 2 && <span style={{color:"var(--danger)"}}> Queue full!</span>}</p>
            <button onClick={onClear} className="text-xs" style={{color:"var(--text-muted)"}}>✕</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {available.map((def: any) => {
              const sameCount = buildings.filter((b: any) => b.defId === def.id).length;
              const cost = Math.floor(def.baseCost * (1 + sameCount * 0.3));
              const dimPenalty = sameCount > 0 ? Math.round(Math.pow(def.diminishingRate, sameCount) * 100) : 100;
              return (
                <button key={def.id} onClick={() => city.coins >= cost && queueCount < 2 && onBuild(def.id, selectedSlot.x, selectedSlot.y)}
                  disabled={city.coins < cost || queueCount >= 2}
                  className="shrink-0 w-32 p-2 rounded-xl text-left transition-all hover-lift disabled:opacity-40"
                  style={{background:"var(--bg-tertiary)", border:"1px solid var(--border)"}}>
                  <div className="flex items-center gap-1 mb-1">
                    <span>{def.emoji}</span>
                    <span className="text-[10px] font-bold truncate" style={{color:"var(--text-primary)"}}>{def.name}</span>
                  </div>
                  <p className="text-[9px]" style={{color: city.coins >= cost ? "var(--warning)" : "var(--danger)"}}>💰{cost}</p>
                  {def.incomePerMin > 0 && <p className="text-[9px]" style={{color:"var(--success)"}}>+{def.incomePerMin}/m {sameCount > 0 && `(${dimPenalty}% eff)`}</p>}
                  {def.upkeepPerMin > 0 && <p className="text-[9px]" style={{color:"var(--danger)"}}>-{def.upkeepPerMin}/m upkeep</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedBuilding && selectedDef && (
        <div className="p-3 fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedDef.emoji}</span>
              <div>
                <p className="text-sm font-bold" style={{color:"var(--text-primary)"}}>{selectedDef.name}</p>
                <p className="text-[10px]" style={{color:"var(--text-muted)"}}>Lv{selectedBuilding.level}/{selectedDef.maxLevel}
                  {selectedBuilding.status !== "built" && <span style={{color:"var(--warning)"}}> — {selectedBuilding.status}...</span>}
                </p>
              </div>
            </div>
            <button onClick={onClear} className="text-xs" style={{color:"var(--text-muted)"}}>✕</button>
          </div>
          <p className="text-xs mb-2" style={{color:"var(--text-secondary)"}}>{selectedDef.description}</p>
          <div className="flex gap-3 text-[10px] mb-2" style={{color:"var(--text-muted)"}}>
            {selectedDef.incomePerMin > 0 && <span>📈 {(selectedDef.incomePerMin * (1 + selectedBuilding.level * 0.5)).toFixed(1)}/m</span>}
            <span>🔧 -{(selectedDef.upkeepPerMin * (1 + selectedBuilding.level * 0.3)).toFixed(1)}/m</span>
          </div>
          {selectedBuilding.status === "built" && selectedBuilding.level < selectedDef.maxLevel && (
            <button onClick={() => onUpgrade(selectedBuilding.id)}
              disabled={queueCount >= 2} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white hover-lift disabled:opacity-40"
              style={{background:"var(--accent)"}}>
              Upgrade → Lv{selectedBuilding.level + 1} (💰{Math.floor(selectedDef.baseCost * Math.pow(selectedDef.upgradeCostMult, selectedBuilding.level + 1))})
            </button>
          )}
        </div>
      )}

      {!selectedSlot && !selectedBuilding && (
        <div className="p-3">
          <p className="text-xs" style={{color:"var(--text-muted)"}}>Tap a tile to build or manage. Grid: {Math.round(Math.sqrt(buildings.length + (25 - buildings.length)))> 0 ? `${grid}×${grid}` : "5×5"}</p>
          {(city.buildQueue || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(city.buildQueue as any[]).map((q: any) => {
                const b = buildings.find((b: any) => b.id === q.buildingId);
                const def = b ? defMap.get(b.defId) : null;
                const rem = Math.max(0, Math.ceil((q.finishAt - Date.now()) / 1000));
                return def ? <div key={q.buildingId} className="flex items-center gap-2 text-xs">
                  <span>{def.emoji}</span><span style={{color:"var(--text-primary)"}}>{def.name}</span><span style={{color:"var(--warning)"}}>⏱{rem}s</span>
                </div> : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === TECH VIEW ===
function TechView({ techTree, unlockedTech, techPoints, onUnlock }: any) {
  const branches = ["root", "industry", "finance", "media", "culture", "expansion"];
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{color:"var(--text-primary)"}}>🔬 Tech Tree</h3>
        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{background:"var(--accent-soft)", color:"var(--accent)"}}>🧪 {techPoints} tech points</span>
      </div>
      <div className="space-y-4">
        {branches.map((branch) => {
          const nodes = techTree.filter((t: any) => t.branch === branch);
          if (nodes.length === 0) return null;
          return (
            <div key={branch}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{color:"var(--text-muted)"}}>{branch}</p>
              <div className="flex gap-2 flex-wrap">
                {nodes.map((node: any) => {
                  const unlocked = unlockedTech.includes(node.id);
                  const canUnlock = !unlocked && (node.requires || []).every((r: string) => unlockedTech.includes(r)) && techPoints >= node.cost;
                  return (
                    <button key={node.id} onClick={() => canUnlock && onUnlock(node.id)}
                      disabled={!canUnlock && !unlocked}
                      className={"p-3 rounded-xl text-left transition-all w-40 " + (unlocked ? "ring-2" : canUnlock ? "hover-lift" : "opacity-50")}
                      style={{background:"var(--bg-secondary)", border:"1px solid var(--border)",
                        ringColor: unlocked ? "var(--success)" : "transparent"}}>
                      <span className="text-lg">{node.emoji}</span>
                      <p className="text-xs font-bold mt-1" style={{color:"var(--text-primary)"}}>{node.name}</p>
                      <p className="text-[9px] mt-0.5" style={{color:"var(--text-muted)"}}>{node.description}</p>
                      {!unlocked && <p className="text-[9px] mt-1" style={{color: canUnlock ? "var(--accent)" : "var(--text-muted)"}}>🧪 {node.cost} pts</p>}
                      {unlocked && <p className="text-[9px] mt-1" style={{color:"var(--success)"}}>✅ Unlocked</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === LEADERBOARD VIEW ===
function LeaderboardView({ leaderboard, onFetch }: any) {
  const [type, setType] = useState("population");
  const [scope, setScope] = useState("global");
  useEffect(() => { onFetch(type, scope); }, [type, scope]);
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex gap-2 mb-3">
        {["population", "coins", "mayorLevel"].map((t) => (
          <button key={t} onClick={() => setType(t)} className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{background: type === t ? "var(--accent-soft)" : "var(--bg-tertiary)", color: type === t ? "var(--accent)" : "var(--text-muted)"}}>
            {t === "population" ? "👥 Pop" : t === "coins" ? "💰 Coins" : "🎓 Level"}
          </button>
        ))}
        <div className="flex-1" />
        {["global", "friends"].map((s) => (
          <button key={s} onClick={() => setScope(s)} className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{background: scope === s ? "var(--accent-soft)" : "var(--bg-tertiary)", color: scope === s ? "var(--accent)" : "var(--text-muted)"}}>
            {s === "global" ? "🌍" : "👫"} {s}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {leaderboard.map((e: any) => (
          <div key={e.rank} className={"flex items-center gap-3 px-3 py-2 rounded-xl " + (e.isMe ? "ring-1" : "")}
            style={{background: e.isMe ? "var(--accent-soft)" : "var(--bg-secondary)", border:"1px solid var(--border)",
              ringColor: e.isMe ? "var(--accent)" : "transparent"}}>
            <span className="text-sm font-bold w-6 text-center" style={{color: e.rank <= 3 ? "var(--warning)" : "var(--text-muted)"}}>
              {e.rank <= 3 ? ["🥇","🥈","🥉"][e.rank - 1] : e.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{color:"var(--text-primary)"}}>{e.cityName} — {e.user?.displayName}</p>
              <p className="text-[10px]" style={{color:"var(--text-muted)"}}>👥{e.population} · 💰{e.coins.toLocaleString()} · Lv{e.mayorLevel} · 😊{e.happiness}%</p>
            </div>
          </div>
        ))}
        {leaderboard.length === 0 && <p className="text-center text-xs py-8" style={{color:"var(--text-muted)"}}>No data yet</p>}
      </div>
    </div>
  );
}

// === ACHIEVEMENTS VIEW ===
function AchievementsView({ defs, unlocked, mayorLevel, mayorXp, mayorLevels, streak }: any) {
  const unlockedSet = new Set(unlocked);
  const currentML = mayorLevels.find((m: any) => m.level === mayorLevel) || {};
  const nextML = mayorLevels.find((m: any) => m.level === mayorLevel + 1);
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="p-3 rounded-xl mb-4" style={{background:"var(--bg-secondary)", border:"1px solid var(--border)"}}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold" style={{color:"var(--text-primary)"}}>🎓 Mayor Level {mayorLevel} — {currentML.title}</p>
            <p className="text-[10px]" style={{color:"var(--text-muted)"}}>{mayorXp} XP {nextML ? `/ ${nextML.xpRequired} for Lv${nextML.level}` : "(MAX)"}</p>
          </div>
          <span className="text-xs" style={{color:"var(--warning)"}}>🔥 {streak}-day streak</span>
        </div>
        {nextML && (
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{background:"var(--bg-tertiary)"}}>
            <div className="h-full rounded-full" style={{background:"var(--accent)", width: Math.min(100, (mayorXp / nextML.xpRequired) * 100) + "%"}} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {defs.map((a: any) => (
          <div key={a.id} className={"p-3 rounded-xl " + (unlockedSet.has(a.id) ? "" : "opacity-50")}
            style={{background:"var(--bg-secondary)", border:"1px solid var(--border)"}}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{a.emoji}</span>
              <div>
                <p className="text-xs font-bold" style={{color:"var(--text-primary)"}}>{a.name}</p>
                <p className="text-[9px]" style={{color:"var(--text-muted)"}}>{a.description}</p>
              </div>
            </div>
            <p className="text-[9px] mt-1" style={{color: unlockedSet.has(a.id) ? "var(--success)" : "var(--text-muted)"}}>
              {unlockedSet.has(a.id) ? "✅ Earned" : `🎁 +${a.reward} coins`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// === MAP VIEW (reuse from before) ===
function MapView() {
  const g = useGameStore();
  const [query, setQuery] = useState("");

  if (g.viewingCity) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center gap-3" style={{borderColor:"var(--border)"}}>
          <button onClick={g.clearViewing} className="text-xs font-medium" style={{color:"var(--accent)"}}>← Back</button>
          <span className="text-sm font-bold" style={{color:"var(--text-primary)"}}>🏙️ {g.viewingCity.cityName} — {g.viewingUser?.displayName}</span>
        </div>
        <div className="flex-1" style={{background:"linear-gradient(180deg,#87CEEB,#E0F0E8)"}}>
          <IsometricCity buildings={g.viewingCity.buildings || []} buildingDefs={g.buildingDefs} selectedSlot={null} onClickTile={() => {}} gridSize={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3 p-3 rounded-xl" style={{background:"var(--bg-secondary)", border:"1px solid var(--border)"}}>
        <div><p className="text-xs font-semibold" style={{color:"var(--text-primary)"}}>Map Visibility</p></div>
        <button onClick={g.toggleVisibility} className="w-11 h-6 rounded-full relative" style={{background: g.city?.mapVisible ? "var(--accent)" : "var(--bg-tertiary)", border:"1px solid var(--border)"}}>
          <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{left: g.city?.mapVisible ? "calc(100% - 22px)" : "1px"}} />
        </button>
      </div>
      <div className="flex gap-2 mb-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && query.length >= 2 && g.searchMap(query)}
          placeholder="Search player..." className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{background:"var(--bg-tertiary)", border:"1px solid var(--border)", color:"var(--text-primary)"}} />
        <button onClick={() => g.explore()} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{background:"var(--accent)"}}>🔄 Discover</button>
      </div>
      <div className="space-y-2">
        {g.mapPlayers.map((p: any, i: number) => {
          const user = p.user || p;
          return (
            <button key={i} onClick={() => g.viewOtherCity(user.id)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover-lift"
              style={{background:"var(--bg-secondary)", border:"1px solid var(--border)"}}>
              <div className="avatar-gradient-3 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm">{user.displayName?.charAt(0)?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{color:"var(--text-primary)"}}>{p.cityName || "City"} — {user.displayName}</p>
                <p className="text-[10px]" style={{color:"var(--text-muted)"}}>👥{p.population || 0} · 🏗️{p.buildingCount || 0}</p>
              </div>
            </button>
          );
        })}
        {g.mapPlayers.length === 0 && <p className="text-center text-xs py-8" style={{color:"var(--text-muted)"}}>Discover cities above!</p>}
      </div>
    </div>
  );
}
