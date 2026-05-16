/**
 * Network Topology Builder
 * Creates a connected graph with random link properties
 */

import { NetworkTopology, Node, Link } from './types';

// Seeded random number generator for reproducibility
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export function buildTopology(nNodes: number = 12, seed: number = 42): NetworkTopology {
  const rng = new SeededRandom(seed);
  const nodes: Node[] = [];
  const links: Link[] = [];
  const adjacency = new Map<number, number[]>();
  
  // Initialize nodes with circular layout
  for (let i = 0; i < nNodes; i++) {
    const angle = (2 * Math.PI * i) / nNodes;
    const radius = 180;
    nodes.push({
      id: i,
      x: 250 + radius * Math.cos(angle - Math.PI / 2),
      y: 250 + radius * Math.sin(angle - Math.PI / 2),
    });
    adjacency.set(i, []);
  }
  
  // Create spanning tree for connectivity
  const shuffled = rng.shuffle([...Array(nNodes).keys()]);
  for (let i = 1; i < shuffled.length; i++) {
    const link = createLink(shuffled[i - 1], shuffled[i], rng, links.length);
    links.push(link);
    adjacency.get(link.source)!.push(link.target);
    adjacency.get(link.target)!.push(link.source);
  }
  
  // Add extra edges for redundancy
  const extraCount = Math.floor(nNodes * 0.6);
  let added = 0;
  let attempts = 0;
  
  while (added < extraCount && attempts < 400) {
    const u = Math.floor(rng.next() * nNodes);
    const v = Math.floor(rng.next() * nNodes);
    
    if (u !== v && !adjacency.get(u)!.includes(v)) {
      const link = createLink(u, v, rng, links.length);
      links.push(link);
      adjacency.get(u)!.push(v);
      adjacency.get(v)!.push(u);
      added++;
    }
    attempts++;
  }
  
  return { nodes, links, adjacency };
}

function createLink(source: number, target: number, rng: SeededRandom, index: number): Link {
  const bandwidths = [10, 100, 1000];  // Mbps
  const bw = rng.choice(bandwidths);
  
  // Create REALISTIC link properties where high-BW links tend to be
  // more utilized (they carry more traffic) and low-BW links tend to
  // have higher loss (older/wireless equipment). This creates genuine
  // trade-offs that make QoS-aware routing valuable.
  let delay: number, loss: number, utilization: number;
  
  if (bw === 1000) {
    // High-BW fiber: low delay, low loss, but high utilization (popular path)
    delay = rng.uniform(1, 10);
    loss = rng.uniform(0, 0.02);
    utilization = rng.uniform(0.50, 0.95);
  } else if (bw === 100) {
    // Medium-BW: moderate everything
    delay = rng.uniform(5, 30);
    loss = rng.uniform(0.01, 0.05);
    utilization = rng.uniform(0.20, 0.70);
  } else {
    // Low-BW (10M): high delay, high loss (wireless/old), but low utilization
    delay = rng.uniform(15, 50);
    loss = rng.uniform(0.03, 0.08);
    utilization = rng.uniform(0.05, 0.40);
  }
  
  return {
    id: `link-${index}`,
    source,
    target,
    bandwidth: bw,
    delay,
    loss,
    utilization,
    isUp: true,
  };
}

/**
 * Get link between two nodes
 */
export function getLink(topology: NetworkTopology, u: number, v: number): Link | undefined {
  return topology.links.find(l => 
    (l.source === u && l.target === v) || (l.source === v && l.target === u)
  );
}

/**
 * Get all links connected to a node
 */
export function getNodeLinks(topology: NetworkTopology, nodeId: number): Link[] {
  return topology.links.filter(l => 
    (l.source === nodeId || l.target === nodeId) && l.isUp
  );
}

/**
 * Clone topology for modifications
 */
export function cloneTopology(topology: NetworkTopology): NetworkTopology {
  return {
    nodes: [...topology.nodes],
    links: topology.links.map(l => ({ ...l })),
    adjacency: new Map(
      Array.from(topology.adjacency.entries()).map(([k, v]) => [k, [...v]])
    ),
  };
}
