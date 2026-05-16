/**
 * Router State Management
 * Each router maintains its own routing table and neighbor state
 */

import { 
  RouterState, 
  RoutingEntry, 
  LSAEntry,
  Protocol,
  ProtocolConfig,
  NetworkTopology,
  Link
} from './types';
import { getLink, getNodeLinks } from './NetworkBuilder';

/**
 * Initialize router state
 */
export function createRouter(
  id: number, 
  topology: NetworkTopology,
  protocol: Protocol
): RouterState {
  const router: RouterState = {
    id,
    routingTable: new Map(),
    neighbors: new Map(),
    messagesSent: 0,
    messagesReceived: 0,
    spfComputations: 0,
  };
  
  // Initialize self-route
  router.routingTable.set(id, {
    destination: id,
    nextHop: id,
    cost: 0,
    hops: 0,
    timestamp: 0,
    isValid: true,
  });
  
  // Initialize neighbors from topology
  const links = getNodeLinks(topology, id);
  for (const link of links) {
    const neighborId = link.source === id ? link.target : link.source;
    router.neighbors.set(neighborId, {
      neighborId,
      linkId: link.id,
      lastHello: 0,
      isUp: true,
    });
  }
  
  // OSPF-specific initialization
  if (protocol === 'OSPF' || protocol === 'QAA-OSPF' || protocol === 'EQA-OSPF') {
    router.lsdb = new Map();
    router.lsaSeqNum = 0;
  }
  
  // QAA/EQA-specific initialization
  if (protocol === 'QAA-OSPF' || protocol === 'EQA-OSPF') {
    router.backupRoutes = new Map();
  }
  
  return router;
}

/**
 * Calculate link cost based on protocol
 */
export function calculateLinkCost(
  link: Link,
  config: ProtocolConfig
): number {
  if (config.name === 'RIP') {
    return 1;
  }
  
  if (config.name === 'OSPF') {
    return Math.max(1, Math.floor(100000 / link.bandwidth));
  }
  
  // QAA-OSPF or EQA-OSPF: composite metric
  //
  // IMPORTANT: All components are NORMALIZED to 0-100 scale so that
  // weights actually matter. Without normalization, C_bw (up to 10000)
  // completely drowns out C_delay (up to 100), C_load (up to 100),
  // and C_loss (up to 80).
  //
  // Normalization: each component mapped to 0-100 range
  //   C_bw:   10Mbps→100, 100Mbps→10, 1000Mbps→1  → log scale 0-100
  //   C_delay: 0-50ms → 0-100
  //   C_load:  0-100% → 0-100
  //   C_loss:  0-8%   → 0-100
  
  const weights = config.metricWeights!;
  
  // Bandwidth: log-scale normalized. 10M=100, 100M=50, 1000M=0
  const cBw = Math.max(0, 100 - (Math.log10(link.bandwidth) - 1) * 50);
  
  // Delay: linear, 0-50ms → 0-100
  const cDelay = (link.delay / 50) * 100;
  
  // Load: already 0-1 → 0-100
  const cLoad = link.utilization * 100;
  
  // Loss: 0-0.08 → 0-100
  const cLoss = (link.loss / 0.08) * 100;
  
  return (
    weights.bandwidth * cBw +
    weights.delay * cDelay +
    weights.load * cLoad +
    weights.loss * cLoss
  );
}

/**
 * RIP: Update routing table with received update
 * Returns true if any routes changed
 */
export function ripUpdateRoutes(
  router: RouterState,
  sourceNeighbor: number,
  receivedRoutes: RoutingEntry[],
  linkCost: number,
  currentTime: number,
  maxHops: number = 15
): { changed: boolean; changedRoutes: number[] } {
  const changedRoutes: number[] = [];
  
  for (const received of receivedRoutes) {
    const dest = received.destination;
    
    // Skip routes to self
    if (dest === router.id) continue;
    
    // Calculate new cost through this neighbor
    const newCost = linkCost + received.cost;
    const newHops = received.hops + 1;
    
    // Check hop count limit - if over limit, treat as unreachable
    if (newHops > maxHops) continue;
    
    const current = router.routingTable.get(dest);
    
    // Update if: no route, better route, or same neighbor with new cost
    if (!current || 
        newCost < current.cost || 
        (current.nextHop === sourceNeighbor && newCost !== current.cost)) {
      
      const isValid = newCost < 16; // RIP infinity check
      
      router.routingTable.set(dest, {
        destination: dest,
        nextHop: sourceNeighbor,
        cost: newCost,
        hops: newHops,
        timestamp: currentTime,
        isValid: isValid,
      });
      changedRoutes.push(dest);
    }
  }
  
  return { changed: changedRoutes.length > 0, changedRoutes };
}

/**
 * RIP: Mark routes through a neighbor as invalid (poison)
 */
export function ripPoisonRoutes(
  router: RouterState,
  failedNeighbor: number,
  currentTime: number,
  infinity: number = 16
): number[] {
  const poisonedRoutes: number[] = [];
  
  router.routingTable.forEach((entry, dest) => {
    if (entry.nextHop === failedNeighbor && dest !== router.id) {
      entry.cost = infinity;
      entry.hops = infinity;
      entry.isValid = false;
      entry.timestamp = currentTime;
      poisonedRoutes.push(dest);
    }
  });
  
  return poisonedRoutes;
}

/**
 * OSPF: Generate LSA for this router
 */
export function generateLSA(
  router: RouterState,
  topology: NetworkTopology,
  config: ProtocolConfig,
  currentTime: number
): LSAEntry {
  router.lsaSeqNum = (router.lsaSeqNum || 0) + 1;
  
  const links: LSAEntry['links'] = [];
  
  router.neighbors.forEach((neighbor, neighborId) => {
    if (neighbor.isUp) {
      const link = getLink(topology, router.id, neighborId);
      if (link && link.isUp) {
        links.push({
          neighborId,
          cost: calculateLinkCost(link, config),
          bandwidth: link.bandwidth,
          delay: link.delay,
          utilization: link.utilization,
          loss: link.loss,
        });
      }
    }
  });
  
  return {
    routerId: router.id,
    sequenceNumber: router.lsaSeqNum,
    timestamp: currentTime,
    links,
  };
}

/**
 * OSPF: Process received LSA
 * Returns true if LSDB was updated
 */
export function processLSA(
  router: RouterState,
  lsa: LSAEntry
): boolean {
  if (!router.lsdb) return false;
  
  const existing = router.lsdb.get(lsa.routerId);
  
  // Only update if newer
  if (!existing || lsa.sequenceNumber > existing.sequenceNumber) {
    router.lsdb.set(lsa.routerId, { ...lsa });
    return true;
  }
  
  return false;
}

/**
 * OSPF: Run Dijkstra's SPF algorithm on LSDB
 * 
 * IMPORTANT: A link u→v is only traversable if BOTH:
 *   1. u's LSA lists v as a neighbor
 *   2. v's LSA lists u as a neighbor (bidirectional check)
 * This matches real OSPF RFC 2328 §16.1 behavior.
 */
export function runSPF(
  router: RouterState,
  _config: ProtocolConfig,
  currentTime: number
): { changed: boolean; changedRoutes: number[] } {
  if (!router.lsdb) return { changed: false, changedRoutes: [] };
  
  router.spfComputations++;
  const changedRoutes: number[] = [];
  
  const dist = new Map<number, number>();
  const prev = new Map<number, number | null>();
  const firstHop = new Map<number, number>();
  const visited = new Set<number>();
  
  // Get all nodes from LSDB
  const allNodes = new Set<number>();
  router.lsdb.forEach((lsa, routerId) => {
    allNodes.add(routerId);
    lsa.links.forEach(link => allNodes.add(link.neighborId));
  });
  
  // Bidirectional adjacency check (RFC 2328 §16.1)
  // A link u→v is only valid if v's LSA ALSO lists u as a neighbor.
  // If v has no LSA in our LSDB yet, we assume bidirectional (initial convergence).
  const isBidirectional = (u: number, v: number): boolean => {
    const vLsa = router.lsdb!.get(v);
    if (!vLsa) return true; // no LSA from v yet — assume ok for now
    return vLsa.links.some(l => l.neighborId === u);
  };
  
  // Initialize distances
  allNodes.forEach(node => {
    dist.set(node, Infinity);
    prev.set(node, null);
  });
  dist.set(router.id, 0);
  firstHop.set(router.id, router.id);
  
  // Dijkstra
  const queue: [number, number][] = [[0, router.id]];
  
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift()!;
    
    if (visited.has(u)) continue;
    visited.add(u);
    
    const lsa = router.lsdb.get(u);
    if (!lsa) continue;
    
    for (const link of lsa.links) {
      const v = link.neighborId;
      if (visited.has(v)) continue;
      
      // RFC 2328 §16.1: Only use link if bidirectional
      if (!isBidirectional(u, v)) continue;
      
      const newDist = d + link.cost;
      if (newDist < dist.get(v)!) {
        dist.set(v, newDist);
        prev.set(v, u);
        
        if (u === router.id) {
          firstHop.set(v, v);
        } else {
          firstHop.set(v, firstHop.get(u)!);
        }
        
        queue.push([newDist, v]);
      }
    }
  }
  
  // FIXED: Update routing table for ALL known destinations
  // This includes invalidating routes to now-unreachable destinations
  allNodes.forEach(dest => {
    if (dest === router.id) return;
    
    const cost = dist.get(dest) || Infinity;
    const current = router.routingTable.get(dest);
    
    if (cost === Infinity) {
      // Destination is unreachable - invalidate existing route
      if (current && current.isValid) {
        current.isValid = false;
        current.cost = Infinity;
        current.timestamp = currentTime;
        changedRoutes.push(dest);
      }
      return;
    }
    
    // Destination is reachable
    const newNextHop = firstHop.get(dest);
    if (newNextHop === undefined) return;
    
    // Count hops by tracing back
    let hops = 0;
    let curr: number | null = dest;
    while (curr !== null && curr !== router.id && hops < 100) {
      hops++;
      curr = prev.get(curr) ?? null;
    }
    
    // Update if: no route, cost changed, next-hop changed, or was invalid
    if (!current || 
        !current.isValid ||
        current.cost !== cost || 
        current.nextHop !== newNextHop) {
      
      router.routingTable.set(dest, {
        destination: dest,
        nextHop: newNextHop,
        cost,
        hops,
        timestamp: currentTime,
        isValid: true,
      });
      changedRoutes.push(dest);
    }
  });
  
  return { changed: changedRoutes.length > 0, changedRoutes };
}

/**
 * EQA-OSPF: Compute backup routes (link-disjoint paths)
 */
export function computeBackupRoutes(
  router: RouterState,
  _config: ProtocolConfig,
  currentTime: number
): void {
  if (!router.lsdb || !router.backupRoutes) return;
  
  // For each destination, find path that doesn't use primary next-hop
  router.routingTable.forEach((primary, dest) => {
    if (dest === router.id || !primary.isValid) return;
    
    const primaryNextHop = primary.nextHop;
    
    // Run SPF excluding primary next-hop link
    const dist = new Map<number, number>();
    const prev = new Map<number, number | null>();
    const firstHop = new Map<number, number>();
    const visited = new Set<number>();
    
    router.lsdb!.forEach((_, node) => {
      dist.set(node, Infinity);
      prev.set(node, null);
    });
    dist.set(router.id, 0);
    
    const queue: [number, number][] = [[0, router.id]];
    
    while (queue.length > 0) {
      queue.sort((a, b) => a[0] - b[0]);
      const [d, u] = queue.shift()!;
      
      if (visited.has(u)) continue;
      visited.add(u);
      
      const lsa = router.lsdb!.get(u);
      if (!lsa) continue;
      
      for (const link of lsa.links) {
        const v = link.neighborId;
        
        // Skip the primary next-hop from source
        if (u === router.id && v === primaryNextHop) continue;
        
        if (visited.has(v)) continue;
        
        // Bidirectional check
        const vLsa = router.lsdb!.get(v);
        if (vLsa && !vLsa.links.some(l => l.neighborId === u)) continue;
        
        const newDist = d + link.cost;
        if (newDist < dist.get(v)!) {
          dist.set(v, newDist);
          prev.set(v, u);
          if (u === router.id) {
            firstHop.set(v, v);
          } else {
            firstHop.set(v, firstHop.get(u)!);
          }
          queue.push([newDist, v]);
        }
      }
    }
    
    const backupCost = dist.get(dest);
    const backupNextHop = firstHop.get(dest);
    
    if (backupCost !== undefined && 
        backupCost !== Infinity && 
        backupNextHop !== undefined) {
      router.backupRoutes!.set(dest, {
        destination: dest,
        nextHop: backupNextHop,
        cost: backupCost,
        hops: 0,
        timestamp: currentTime,
        isValid: true,
      });
    }
  });
}

/**
 * Activate backup route for a destination
 */
export function activateBackupRoute(
  router: RouterState,
  destination: number,
  currentTime: number
): boolean {
  if (!router.backupRoutes) return false;
  
  const backup = router.backupRoutes.get(destination);
  if (backup && backup.isValid) {
    router.routingTable.set(destination, {
      ...backup,
      timestamp: currentTime,
    });
    return true;
  }
  
  return false;
}

/**
 * Check if routing table has converged (matches expected)
 */
export function hasConverged(
  router: RouterState,
  expectedRoutes: Map<number, number>,
): boolean {
  for (const [dest, expectedNextHop] of expectedRoutes) {
    if (dest === router.id) continue;
    
    const route = router.routingTable.get(dest);
    if (!route || !route.isValid || route.nextHop !== expectedNextHop) {
      return false;
    }
  }
  return true;
}

/**
 * Get routing table as array for display
 */
export function getRoutingTableArray(router: RouterState): RoutingEntry[] {
  return Array.from(router.routingTable.values())
    .filter(e => e.destination !== router.id)
    .sort((a, b) => a.destination - b.destination);
}
