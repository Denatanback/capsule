import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth } from "./authMiddleware.js";
import {
  BUILDINGS, TECH_TREE, MAYOR_LEVELS, ACHIEVEMENTS, DAILY_REWARDS, STARTER_BUILDINGS,
  getBuildingDef, buildCost, buildTimeForLevel, calculateOfflineEarnings,
  calculateEconomy, populationDrain, canBuild, gridSize, diminishingMult,
  XP_BUILD, XP_UPGRADE, XP_DAILY_LOGIN, MAX_GRID,
} from "./gameConfig.js";

export async function gameRoutes(app: FastifyInstance) {


  // Get or create city
  app.get("/api/game/city", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) city = await db.playerCity.create({ data: { userId } });

    const result = processTick(city);
    const dailyResult = processDailyLogin(city);

    if (result.changed || dailyResult.changed) {
      city = await db.playerCity.update({
        where: { id: city.id },
        data: {
          coins: result.coins + (dailyResult.bonusCoins || 0),
          population: result.population, happiness: result.happiness,
          buildings: result.buildings, buildQueue: result.buildQueue,
          mayorXp: (city.mayorXp || 0) + (dailyResult.bonusXp || 0),
          loginStreak: dailyResult.streak ?? city.loginStreak,
          lastLoginDate: dailyResult.today ?? city.lastLoginDate,
          lastTick: new Date(),
          ...levelUp(city.mayorXp + (dailyResult.bonusXp || 0), city.mayorLevel, city.techPoints),
        },
      });
    }

    const econ = calculateEconomy(result.buildings as any[], result.happiness, (city.unlockedTech as string[]) || []);

    // Check new achievements
    const newAch = checkAchievements(city);
    if (newAch.length > 0) {
      const achReward = newAch.reduce((s, a) => s + a.reward, 0);
      city = await db.playerCity.update({
        where: { id: city.id },
        data: {
          achievements: [...((city.achievements as string[]) || []), ...newAch.map((a) => a.id)],
          coins: city.coins + achReward,
        },
      });
    }

    return rep.send({
      city, economy: econ,
      buildingDefs: BUILDINGS, techTree: TECH_TREE,
      mayorLevels: MAYOR_LEVELS, achievements: ACHIEVEMENTS,
      starterBuildings: STARTER_BUILDINGS,
      dailyReward: dailyResult.reward,
      newAchievements: newAch,
      offlineEarnings: result.offlineCoins,
    });
  });

  // Pick starter buildings (once)
  app.post("/api/game/starter", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({ picks: z.array(z.string()).length(2) }).parse(req.body);

    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "No city" });
    if (city.starterPicked) return rep.status(400).send({ error: "Already picked" });

    const valid = body.picks.every((id) => STARTER_BUILDINGS.some((b) => b.id === id));
    if (!valid) return rep.status(400).send({ error: "Invalid starter picks" });

    // Place at predefined positions
    const positions = [[2, 2], [2, 3]];
    const buildings = body.picks.map((defId, i) => ({
      id: Date.now().toString(36) + i,
      defId, gridX: positions[i][0], gridY: positions[i][1],
      level: 0, status: "built",
    }));

    city = await db.playerCity.update({
      where: { id: city.id },
      data: { starterPicked: true, buildings: buildings as any, mayorXp: XP_BUILD * 2 },
    });
    return rep.send({ city });
  });

  // Build
  app.post("/api/game/build", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({
      defId: z.string(),
      gridX: z.number().int().min(0),
      gridY: z.number().int().min(0),
    }).parse(req.body);

    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "No city" });

    const tick = processTick(city);
    let buildings = tick.buildings as any[];
    let coins = tick.coins;
    let queue = tick.buildQueue as any[];
    const tech = (city.unlockedTech as string[]) || [];
    const grid = gridSize(tech);

    if (body.gridX >= grid || body.gridY >= grid) {
      return rep.status(400).send({ error: "Outside grid (need expansion tech)" });
    }

    const def = getBuildingDef(body.defId);
    if (!def) return rep.status(400).send({ error: "Unknown building" });

    const check = canBuild(body.defId, buildings, tech);
    if (!check.ok) return rep.status(400).send({ error: check.reason });

    if (buildings.some((b) => b.gridX === body.gridX && b.gridY === body.gridY)) {
      return rep.status(400).send({ error: "Slot occupied" });
    }

    const sameTypeCount = buildings.filter((b) => b.defId === body.defId).length;
    const cost = Math.floor(buildCost(def, 0) * (1 + sameTypeCount * 0.3)); // cost inflation
    if (coins < cost) return rep.status(400).send({ error: "Need " + cost + " coins" });
    if (queue.length >= 2) return rep.status(400).send({ error: "Queue full (max 2)" });

    coins -= cost;
    const buildId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const finishAt = Date.now() + buildTimeForLevel(def, 0) * 1000;

    buildings.push({ id: buildId, defId: body.defId, gridX: body.gridX, gridY: body.gridY, level: 0, status: "building", finishAt });
    queue.push({ buildingId: buildId, finishAt });

    const newXp = (city.mayorXp || 0) + XP_BUILD;
    city = await db.playerCity.update({
      where: { id: city.id },
      data: {
        coins, buildings: buildings as any, buildQueue: queue as any,
        mayorXp: newXp, lastTick: new Date(),
        ...levelUp(newXp, city.mayorLevel, city.techPoints),
      },
    });
    return rep.send({ city, costPaid: cost });
  });

  // Upgrade
  app.post("/api/game/upgrade", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({ buildingId: z.string() }).parse(req.body);

    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "No city" });

    const tick = processTick(city);
    let buildings = tick.buildings as any[];
    let coins = tick.coins;
    let queue = tick.buildQueue as any[];

    const bIdx = buildings.findIndex((b) => b.id === body.buildingId);
    if (bIdx === -1) return rep.status(404).send({ error: "Not found" });
    const b = buildings[bIdx];
    if (b.status !== "built") return rep.status(400).send({ error: "Not ready" });

    const def = getBuildingDef(b.defId);
    if (!def || b.level >= def.maxLevel) return rep.status(400).send({ error: "Max level" });
    if (queue.length >= 2) return rep.status(400).send({ error: "Queue full" });

    const cost = buildCost(def, b.level + 1);
    if (coins < cost) return rep.status(400).send({ error: "Need " + cost + " coins" });

    coins -= cost;
    const finishAt = Date.now() + buildTimeForLevel(def, b.level + 1) * 1000;
    buildings[bIdx] = { ...b, status: "upgrading", finishAt };
    queue.push({ buildingId: b.id, finishAt });

    const newXp = (city.mayorXp || 0) + XP_UPGRADE;
    city = await db.playerCity.update({
      where: { id: city.id },
      data: {
        coins, buildings: buildings as any, buildQueue: queue as any,
        mayorXp: newXp, lastTick: new Date(),
        ...levelUp(newXp, city.mayorLevel, city.techPoints),
      },
    });
    return rep.send({ city });
  });

  // Unlock tech
  app.post("/api/game/tech", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({ techId: z.string() }).parse(req.body);

    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "No city" });

    const tech = (city.unlockedTech as string[]) || [];
    if (tech.includes(body.techId)) return rep.status(400).send({ error: "Already unlocked" });

    const node = TECH_TREE.find((t) => t.id === body.techId);
    if (!node) return rep.status(400).send({ error: "Unknown tech" });
    if (node.requires && !node.requires.every((r) => tech.includes(r))) {
      return rep.status(400).send({ error: "Prerequisites not met" });
    }
    if ((city.techPoints || 0) < node.cost) {
      return rep.status(400).send({ error: "Need " + node.cost + " tech points (have " + city.techPoints + ")" });
    }

    city = await db.playerCity.update({
      where: { id: city.id },
      data: {
        unlockedTech: [...tech, body.techId] as any,
        techPoints: (city.techPoints || 0) - node.cost,
      },
    });
    return rep.send({ city });
  });

  // Collect (tick)
  app.post("/api/game/collect", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    let city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "No city" });
    const tick = processTick(city);
    city = await db.playerCity.update({
      where: { id: city.id },
      data: { coins: tick.coins, population: tick.population, happiness: tick.happiness,
        buildings: tick.buildings, buildQueue: tick.buildQueue, lastTick: new Date() },
    });
    const econ = calculateEconomy(tick.buildings as any[], tick.happiness, (city.unlockedTech as string[]) || []);
    return rep.send({ city, economy: econ });
  });

  // Visibility, rename
  app.post("/api/game/visibility", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({ visible: z.boolean() }).parse(req.body);
    const city = await db.playerCity.update({ where: { userId }, data: { mapVisible: body.visible } });
    return rep.send({ city });
  });

  app.post("/api/game/rename", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const body = z.object({ name: z.string().min(1).max(30) }).parse(req.body);
    const city = await db.playerCity.update({ where: { userId }, data: { cityName: body.name } });
    return rep.send({ city });
  });

  // === LEADERBOARDS ===
  app.get("/api/game/leaderboard", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const { type, scope } = req.query as { type?: string; scope?: string };
    const sortBy = type || "population";

    let where: any = {};
    if (scope === "friends") {
      const friends = await db.friendship.findMany({
        where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      });
      const friendIds = friends.map((f) => f.requesterId === userId ? f.addresseeId : f.requesterId);
      friendIds.push(userId);
      where = { userId: { in: friendIds } };
    }

    const order: any = sortBy === "coins" ? { coins: "desc" }
      : sortBy === "mayorLevel" ? { mayorLevel: "desc" }
      : { population: "desc" };

    const cities = await db.playerCity.findMany({
      where, orderBy: order, take: 50,
    });
    const userIds = cities.map((c) => c.userId);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = cities.map((c, i) => ({
      rank: i + 1,
      user: userMap.get(c.userId),
      cityName: c.cityName,
      population: c.population,
      coins: Math.floor(c.coins),
      mayorLevel: c.mayorLevel,
      happiness: c.happiness,
      buildingCount: (c.buildings as any[]).length,
      isMe: c.userId === userId,
    }));

    return rep.send({ leaderboard });
  });

  // Map endpoints (same as before)
  app.get("/api/game/map/search", { preHandler: requireAuth as any }, async (req, rep) => {
    const { q } = req.query as { q: string };
    if (!q || q.length < 2) return rep.send({ players: [] });
    const users = await db.user.findMany({
      where: { username: { contains: q, mode: "insensitive" } },
      select: { id: true, username: true, displayName: true }, take: 10,
    });
    const cities = await db.playerCity.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    const cityMap = new Map(cities.map((c) => [c.userId, c]));
    return rep.send({
      players: users.map((u) => ({
        ...u, city: cityMap.get(u.id) || null,
        buildingCount: ((cityMap.get(u.id)?.buildings as any[]) || []).length,
      })),
    });
  });

  app.get("/api/game/map/explore", { preHandler: requireAuth as any }, async (req, rep) => {
    const userId = (req as any).userId;
    const cities = await db.playerCity.findMany({
      where: { mapVisible: true, userId: { not: userId } }, take: 20, orderBy: { updatedAt: "desc" },
    });
    const users = await db.user.findMany({
      where: { id: { in: cities.map((c) => c.userId) } },
      select: { id: true, username: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return rep.send({
      players: cities.map((c) => ({
        user: userMap.get(c.userId), cityName: c.cityName,
        population: c.population, buildingCount: (c.buildings as any[]).length,
      })),
    });
  });

  app.get("/api/game/city/:userId", { preHandler: requireAuth as any }, async (req, rep) => {
    const { userId } = req.params as { userId: string };
    const city = await db.playerCity.findUnique({ where: { userId } });
    if (!city) return rep.status(404).send({ error: "Not found" });
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, displayName: true } });
    return rep.send({ city, user });
  });
}

// === TICK ===
function processTick(city: any) {
  const now = Date.now();
  const lastTick = new Date(city.lastTick).getTime();
  let buildings = [...((city.buildings as any[]) || [])];
  let queue = [...((city.buildQueue as any[]) || [])];
  let coins = city.coins;
  let changed = false;
  const tech = (city.unlockedTech as string[]) || [];

  // Complete builds
  const completedIds = new Set<string>();
  queue = queue.filter((q) => {
    if (now >= q.finishAt) { completedIds.add(q.buildingId); return false; }
    return true;
  });
  if (completedIds.size > 0) {
    changed = true;
    buildings = buildings.map((b) => {
      if (completedIds.has(b.id)) {
        return b.status === "upgrading"
          ? { ...b, status: "built", level: b.level + 1, finishAt: undefined }
          : { ...b, status: "built", finishAt: undefined };
      }
      return b;
    });
  }

  // Recalc stats
  let population = 0, happiness = 50;
  for (const b of buildings) {
    if (b.status !== "built") continue;
    const def = getBuildingDef(b.defId);
    if (!def) continue;
    population += Math.round(def.populationAdd * (1 + b.level * 0.3));
    happiness += Math.round(def.happinessAdd * (1 + b.level * 0.2));
  }
  happiness = Math.max(0, Math.min(100, happiness));

  // Offline earnings with full economy
  const earnings = calculateOfflineEarnings(buildings, happiness, tech, lastTick, now);
  const offlineCoins = earnings.coins;
  if (offlineCoins !== 0) { coins += offlineCoins; changed = true; }

  // Population drain
  const drain = populationDrain(happiness, population, earnings.minutesPassed);
  if (drain > 0) { population = Math.max(0, population - drain); changed = true; }

  // Floor coins at 0
  if (coins < 0) coins = 0;

  return { coins, population, happiness, buildings, buildQueue: queue, changed, offlineCoins };
}

// Daily login
function processDailyLogin(city: any) {
  const today = new Date().toISOString().slice(0, 10);
  if (city.lastLoginDate === today) return { changed: false, streak: city.loginStreak };

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = city.lastLoginDate === yesterday ? (city.loginStreak || 0) + 1 : 1;
  const dayIdx = Math.min(streak, 7) - 1;
  const reward = DAILY_REWARDS[dayIdx];

  return {
    changed: true, streak, today,
    bonusCoins: reward.coins, bonusXp: reward.xp,
    reward,
  };
}

// Level up check
function levelUp(xp: number, currentLevel: number, currentTP: number) {
  let level = currentLevel;
  let tp = currentTP;
  for (const ml of MAYOR_LEVELS) {
    if (ml.level > level && xp >= ml.xpRequired) {
      tp += ml.techPoints;
      level = ml.level;
    }
  }
  return level > currentLevel ? { mayorLevel: level, techPoints: tp } : {};
}

// Achievement check
function checkAchievements(city: any) {
  const unlocked = new Set((city.achievements as string[]) || []);
  const newOnes: any[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.check(city)) {
      newOnes.push(ach);
    }
  }
  return newOnes;
}
