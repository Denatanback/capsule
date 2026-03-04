// Topology engine: builds optimal relay tree from latency matrix
// For N users, finds the user with minimum total latency to others as relay hub
// For larger groups, builds a minimum spanning tree with relay chains

interface LatencyEntry {
  from: string;
  to: string;
  rtt: number;
}

export interface TopologyNode {
  userId: string;
  role: "relay" | "leaf";
  connectTo: string[]; // direct peer connections
  relayFor: string[];  // forward audio from these users
}

export interface Topology {
  nodes: TopologyNode[];
  relayUserId: string | null;
}

// For 2 users: direct P2P
// For 3+: pick best relay, build star/tree
export function computeTopology(userIds: string[], latencies: LatencyEntry[]): Topology {
  const n = userIds.length;

  if (n <= 1) {
    return {
      nodes: userIds.map(id => ({ userId: id, role: "leaf", connectTo: [], relayFor: [] })),
      relayUserId: null,
    };
  }

  if (n === 2) {
    return {
      nodes: [
        { userId: userIds[0], role: "leaf", connectTo: [userIds[1]], relayFor: [] },
        { userId: userIds[1], role: "leaf", connectTo: [userIds[0]], relayFor: [] },
      ],
      relayUserId: null,
    };
  }

  // Build latency map
  const rttMap = new Map<string, number>();
  for (const e of latencies) {
    rttMap.set(e.from + ":" + e.to, e.rtt);
    rttMap.set(e.to + ":" + e.from, e.rtt); // symmetric
  }

  const getRtt = (a: string, b: string): number => {
    return rttMap.get(a + ":" + b) ?? rttMap.get(b + ":" + a) ?? 999;
  };

  if (n <= 6) {
    // Star topology: find user with minimum total RTT to all others
    let bestRelay = userIds[0];
    let bestTotal = Infinity;

    for (const candidate of userIds) {
      let total = 0;
      for (const other of userIds) {
        if (other !== candidate) total += getRtt(candidate, other);
      }
      if (total < bestTotal) {
        bestTotal = total;
        bestRelay = candidate;
      }
    }

    const nodes: TopologyNode[] = userIds.map(id => {
      if (id === bestRelay) {
        const others = userIds.filter(u => u !== id);
        return { userId: id, role: "relay" as const, connectTo: others, relayFor: others };
      } else {
        return { userId: id, role: "leaf" as const, connectTo: [bestRelay], relayFor: [] };
      }
    });

    return { nodes, relayUserId: bestRelay };
  }

  // For 7+ users: build MST (Prim's algorithm) then assign relays
  // Nodes with degree > 1 in MST become relays
  const edges: { u: string; v: string; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push({ u: userIds[i], v: userIds[j], w: getRtt(userIds[i], userIds[j]) });
    }
  }
  edges.sort((a, b) => a.w - b.w);

  // Kruskal's MST
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };

  const mstEdges: { u: string; v: string }[] = [];
  const adjacency = new Map<string, string[]>();
  for (const id of userIds) adjacency.set(id, []);

  for (const e of edges) {
    if (find(e.u) !== find(e.v)) {
      union(e.u, e.v);
      mstEdges.push({ u: e.u, v: e.v });
      adjacency.get(e.u)!.push(e.v);
      adjacency.get(e.v)!.push(e.u);
    }
  }

  // Nodes with degree >= 2 are relays
  const nodes: TopologyNode[] = userIds.map(id => {
    const neighbors = adjacency.get(id) || [];
    const isRelay = neighbors.length >= 2;
    return {
      userId: id,
      role: isRelay ? "relay" as const : "leaf" as const,
      connectTo: neighbors,
      relayFor: isRelay ? neighbors : [],
    };
  });

  // Primary relay = node with highest degree
  let relayUserId = userIds[0];
  let maxDeg = 0;
  for (const id of userIds) {
    const deg = (adjacency.get(id) || []).length;
    if (deg > maxDeg) { maxDeg = deg; relayUserId = id; }
  }

  return { nodes, relayUserId };
}
