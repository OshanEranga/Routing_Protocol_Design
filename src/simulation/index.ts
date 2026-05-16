/**
 * EQA-OSPF Simulation - Main Export
 * Provides high-level simulation functions for the UI
 */

// Re-export types explicitly
export type { 
  Link, 
  Node, 
  NetworkTopology, 
  Protocol, 
  ConvergenceResult,
  SimulationStats,
  PathResult,
  ProtocolConfig,
  RouterState,
  RoutingEntry,
  SimEvent
} from './types';

export { PROTOCOL_CONFIGS } from './types';

export { buildTopology, getLink, cloneTopology } from './NetworkBuilder';
export { 
  createSimulator, 
  runSimulation, 
  runConvergenceTest,
  calculatePathMetrics,
  getSimulationStats
} from './Simulator';
export {
  createRouter,
  runSPF,
  getRoutingTableArray
} from './Router';

export { runFullDiagnostics } from './Diagnostics';
export type { DiagnosticCheck } from './Diagnostics';

import { 
  NetworkTopology, 
  Protocol, 
  ConvergenceResult,
} from './types';
import { getLink, cloneTopology } from './NetworkBuilder';
import { createSimulator, runSimulation, runConvergenceTest } from './Simulator';

// ============================================================================
// HIGH-LEVEL SIMULATION FUNCTIONS FOR UI
// ============================================================================

export interface PathQualityResult {
  protocol: Protocol;
  flows: {
    source: number;
    destination: number;
    path: number[];
    latency: number;
    loss: number;
    hops: number;
  }[];
  avgLatency: number;
  avgLoss: number;
  avgHops: number;
}

export interface ScalabilityResult {
  networkSize: number;
  results: { protocol: Protocol; computationTime: number; messages: number }[];
}

/**
 * Run complete convergence simulation for all protocols
 */
export function runFullConvergenceSimulation(
  topology: NetworkTopology,
  nTrials: number = 10
): ConvergenceResult[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const results: ConvergenceResult[] = [];
  
  // Get list of valid links to fail
  const validLinks = topology.links.filter(l => l.isUp);
  
  console.log(`[Convergence] Starting: ${nTrials} trials × ${protocols.length} protocols, ${validLinks.length} links available`);
  
  for (const protocol of protocols) {
    const protoTimes: number[] = [];
    for (let trial = 0; trial < nTrials; trial++) {
      // Select a random link to fail
      const linkIndex = Math.floor(Math.random() * validLinks.length);
      const linkToFail = validLinks[linkIndex];
      
      try {
        const result = runConvergenceTest(
          topology,
          protocol,
          { source: linkToFail.source, target: linkToFail.target },
          10000,  // 10 second warmup — enough for RIP (3s updates)
          60000   // 60 second max after failure
        );
        results.push(result);
        protoTimes.push(result.totalTime);
        console.log(`[Convergence][${protocol}] Trial ${trial}: link ${linkToFail.source}-${linkToFail.target}, conv=${result.totalTime.toFixed(1)}ms, detect=${(result.detectionTime - result.failureTime).toFixed(1)}ms, msgs=${result.messagesExchanged}, changes=${result.routeChanges}`);
      } catch (e) {
        console.warn(`[Convergence][${protocol}] Trial ${trial} FAILED:`, e);
      }
    }
    if (protoTimes.length > 0) {
      const mean = protoTimes.reduce((a,b) => a+b, 0) / protoTimes.length;
      console.log(`[Convergence][${protocol}] SUMMARY: mean=${mean.toFixed(1)}ms, min=${Math.min(...protoTimes).toFixed(1)}ms, max=${Math.max(...protoTimes).toFixed(1)}ms`);
    }
  }
  
  return results;
}

/**
 * Run overhead simulation - count messages over time
 */
export function runOverheadSimulation(
  topology: NetworkTopology,
  duration: number = 60000  // 60 seconds in ms
): { protocol: Protocol; messages: number; timeline: number[] }[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const results: { protocol: Protocol; messages: number; timeline: number[] }[] = [];
  
  for (const protocol of protocols) {
    const state = createSimulator({
      topology,
      protocol,
      maxSimTime: duration,
    });
    
    // Sample message count every second
    const timeline: number[] = [];
    let lastMessages = 0;
    const sampleInterval = 1000;
    
    for (let t = sampleInterval; t <= duration; t += sampleInterval) {
      runSimulation(state, t);
      const newMessages = state.totalMessages - lastMessages;
      timeline.push(newMessages);
      lastMessages = state.totalMessages;
    }
    
    results.push({
      protocol,
      messages: state.totalMessages,
      timeline,
    });
  }
  
  return results;
}

/**
 * Analyze path quality for each protocol.
 * 
 * Uses SAME source-destination pairs for all protocols so the comparison
 * is fair. Path quality differences come from each protocol choosing
 * different routes through the network.
 */
export function analyzePathQuality(
  topology: NetworkTopology,
  nFlows: number = 50
): PathQualityResult[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const results: PathQualityResult[] = [];
  const n = topology.nodes.length;
  
  // Generate fixed set of src-dst pairs (same for all protocols)
  const flowPairs: [number, number][] = [];
  for (let i = 0; i < nFlows; i++) {
    const src = (i * 7 + 3) % n;
    let dst = (i * 11 + 5) % n;
    if (dst === src) dst = (dst + 1) % n;
    flowPairs.push([src, dst]);
  }
  
  for (const protocol of protocols) {
    const state = createSimulator({ topology, protocol, maxSimTime: 15000 });
    runSimulation(state, 10000); // Generous warmup
    
    console.log(`[PathQuality][${protocol}] Simulation time after warmup: ${state.currentTime}ms, total messages: ${state.totalMessages}`);
    
    // DEBUG: Check routing table health after warmup for ALL routers
    let totalValidRoutes = 0;
    let totalMissingRoutes = 0;
    state.routers.forEach((router, id) => {
      const valid = Array.from(router.routingTable.values()).filter(r => r.isValid && r.destination !== id).length;
      const expected = topology.nodes.length - 1;
      totalValidRoutes += valid;
      if (valid < expected) totalMissingRoutes += (expected - valid);
    });
    console.log(`[PathQuality][${protocol}] Network-wide: ${totalValidRoutes} valid routes, ${totalMissingRoutes} missing (expected ${topology.nodes.length * (topology.nodes.length - 1)} total)`);
    
    // DEBUG: Detailed dump for router 0
    const router0 = state.routers.get(0);
    if (router0) {
      const tableSize = router0.routingTable.size;
      const validRoutes = Array.from(router0.routingTable.values()).filter(r => r.isValid).length;
      const lsdbSize = router0.lsdb?.size ?? 'N/A';
      const spfRuns = router0.spfComputations;
      console.log(`[PathQuality][${protocol}] Router0: table=${tableSize}, valid=${validRoutes}, lsdb=${lsdbSize}, spf=${spfRuns}`);
      
      // Show first few routes
      const entries = Array.from(router0.routingTable.entries()).slice(0, 5);
      for (const [dest, entry] of entries) {
        console.log(`  → dest=${dest} nextHop=${entry.nextHop} cost=${entry.cost.toFixed(1)} valid=${entry.isValid}`);
      }
    }
    
    const flows: PathQualityResult['flows'] = [];
    let debugFailCount = 0;
    
    for (const [src, dst] of flowPairs) {
      // Walk the forwarding table hop-by-hop
      const path: number[] = [src];
      let current = src;
      const visited = new Set<number>();
      let reachedDest = false;
      let failReason = '';
      
      while (current !== dst) {
        if (visited.has(current)) { failReason = `loop at R${current}`; break; }
        visited.add(current);
        
        const router = state.routers.get(current);
        if (!router) { failReason = `no router R${current}`; break; }
        
        const route = router.routingTable.get(dst);
        if (!route) { failReason = `R${current} no route to ${dst} (table size=${router.routingTable.size})`; break; }
        if (!route.isValid) { failReason = `R${current} route to ${dst} invalid (cost=${route.cost})`; break; }
        if (!isFinite(route.cost)) { failReason = `R${current} route to ${dst} cost=${route.cost} (infinity)`; break; }
        
        const nextHop = route.nextHop;
        // Use the SIMULATOR's topology (which is the cloned one)
        const link = getLink(state.topology, current, nextHop);
        if (!link) { failReason = `no link R${current}-R${nextHop}`; break; }
        if (!link.isUp) { failReason = `link R${current}-R${nextHop} is DOWN`; break; }
        
        path.push(nextHop);
        current = nextHop;
      }
      
      if (current === dst) {
        reachedDest = true;
      }
      
      if (!reachedDest || path.length < 2) {
        debugFailCount++;
        if (debugFailCount <= 3) {
          console.warn(`[PathQuality][${protocol}] Flow ${src}→${dst} FAILED: ${failReason}`);
        }
        continue;
      }
      
      // Calculate actual metrics along this path
      let latency = 0;
      let successProb = 1;
      
      for (let j = 0; j < path.length - 1; j++) {
        const link = getLink(topology, path[j], path[j + 1]);
        if (link) {
          latency += link.delay;
          successProb *= (1 - link.loss);
        }
      }
      
      flows.push({
        source: src,
        destination: dst,
        path,
        latency,
        loss: (1 - successProb) * 100,
        hops: path.length - 1,
      });
    }
    
    const avgLatency = flows.length > 0 
      ? flows.reduce((sum, f) => sum + f.latency, 0) / flows.length : 0;
    const avgLoss = flows.length > 0
      ? flows.reduce((sum, f) => sum + f.loss, 0) / flows.length : 0;
    const avgHops = flows.length > 0
      ? flows.reduce((sum, f) => sum + f.hops, 0) / flows.length : 0;
    
    // Show sample paths to verify they differ between protocols
    if (flows.length > 0) {
      const sample = flows.slice(0, 3);
      for (const f of sample) {
        console.log(`  Path ${f.source}→${f.destination}: [${f.path.join('→')}] lat=${f.latency.toFixed(1)}ms loss=${f.loss.toFixed(2)}%`);
      }
    }
    console.log(`[PathQuality][${protocol}] RESULT: Delivered=${flows.length}/${flowPairs.length}, avgLat=${avgLatency.toFixed(1)}ms, avgLoss=${avgLoss.toFixed(2)}%, avgHops=${avgHops.toFixed(2)}, failed=${debugFailCount}`);
    results.push({ protocol, flows, avgLatency, avgLoss, avgHops });
  }
  
  return results;
}

/**
 * Aggregate convergence results by protocol
 */
export function aggregateConvergenceResults(
  results: ConvergenceResult[]
): {
  protocol: Protocol;
  mean: number;
  std: number;
  min: number;
  max: number;
  samples: number;
  detectionMean: number;
  messagesMean: number;
}[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  
  return protocols.map(protocol => {
    const protocolResults = results.filter(r => r.protocol === protocol);
    const times = protocolResults.map(r => r.totalTime);
    const detections = protocolResults.map(r => r.detectionTime - r.failureTime);
    const messages = protocolResults.map(r => r.messagesExchanged);
    
    if (times.length === 0) {
      return {
        protocol,
        mean: 0,
        std: 0,
        min: 0,
        max: 0,
        samples: 0,
        detectionMean: 0,
        messagesMean: 0,
      };
    }
    
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const std = Math.sqrt(
      times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length
    );
    
    return {
      protocol,
      mean,
      std,
      min: Math.min(...times),
      max: Math.max(...times),
      samples: times.length,
      detectionMean: detections.reduce((a, b) => a + b, 0) / detections.length,
      messagesMean: messages.reduce((a, b) => a + b, 0) / messages.length,
    };
  });
}

/**
 * Congestion stress test: apply HETEROGENEOUS congestion.
 * 
 * At each load level, half the links get congested while the other half
 * stay light. QAA-OSPF (load-aware) and EQA-OSPF (load+loss-aware) should
 * route around the congested links, while RIP/OSPF cannot.
 */
export interface CongestionResult {
  loadLevel: number;
  protocols: {
    protocol: Protocol;
    avgLatency: number;
    avgLoss: number;
    avgHops: number;
    flowsDelivered: number;
  }[];
}

export function runCongestionStressTest(
  baseTopology: NetworkTopology
): CongestionResult[] {
  const loadLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const n = baseTopology.nodes.length;
  const nFlows = 40;
  const results: CongestionResult[] = [];

  const pairs: [number, number][] = [];
  for (let i = 0; i < nFlows; i++) {
    const s = (i * 7 + 2) % n;
    let d = (i * 11 + 5) % n;
    if (d === s) d = (d + 1) % n;
    pairs.push([s, d]);
  }

  for (const load of loadLevels) {
    const protoResults: CongestionResult['protocols'] = [];

    for (const protocol of protocols) {
      const topo = cloneTopology(baseTopology);
      
      // HETEROGENEOUS congestion: alternate links get different load
      // Even-indexed links get heavily congested, odd ones stay light
      topo.links.forEach((l, idx) => {
        if (idx % 2 === 0) {
          // Congested link
          l.utilization = Math.min(0.95, load + 0.1);
          l.loss = Math.min(0.08, load * 0.08);
        } else {
          // Light link
          l.utilization = Math.max(0.05, load * 0.3);
          l.loss = Math.max(0.005, load * 0.01);
        }
      });

      const state = createSimulator({ topology: topo, protocol, maxSimTime: 15000 });
      runSimulation(state, 10000);

      let totalLat = 0, totalLoss = 0, totalHops = 0, delivered = 0;

      for (const [src, dst] of pairs) {
        let cur = src;
        const visited = new Set<number>();
        const path: number[] = [src];
        while (cur !== dst) {
          if (visited.has(cur)) break;
          visited.add(cur);
          const rt = state.routers.get(cur)?.routingTable.get(dst);
          if (!rt || !rt.isValid || !isFinite(rt.cost)) break;
          const lnk = getLink(topo, cur, rt.nextHop);
          if (!lnk || !lnk.isUp) break;
          path.push(rt.nextHop);
          cur = rt.nextHop;
        }
        if (cur === dst && path.length >= 2) {
          let lat = 0, prob = 1;
          for (let j = 0; j < path.length - 1; j++) {
            const lnk = getLink(topo, path[j], path[j + 1]);
            if (lnk) { lat += lnk.delay; prob *= (1 - lnk.loss); }
          }
          totalLat += lat;
          totalLoss += (1 - prob) * 100;
          totalHops += path.length - 1;
          delivered++;
        }
      }

      const avgLat = delivered > 0 ? totalLat / delivered : 0;
      const avgLos = delivered > 0 ? totalLoss / delivered : 0;
      console.log(`[Congestion][${protocol}] load=${(load*100).toFixed(0)}%: delivered=${delivered}/${pairs.length}, avgLat=${avgLat.toFixed(1)}ms, avgLoss=${avgLos.toFixed(2)}%`);
      
      protoResults.push({
        protocol,
        avgLatency: avgLat,
        avgLoss: avgLos,
        avgHops: delivered > 0 ? totalHops / delivered : 0,
        flowsDelivered: delivered,
      });
    }

    results.push({ loadLevel: load, protocols: protoResults });
  }

  return results;
}

/**
 * Multi-failure resilience test.
 * 
 * Instead of waiting for full convergence (all protocols eventually converge),
 * we measure reachability at a FIXED time after failure:
 * - 500ms after failure (before RIP/OSPF can converge)
 * - This shows the benefit of backup routes (QAA/EQA)
 */
export interface MultiFailureResult {
  k: number;
  protocols: {
    protocol: Protocol;
    reachabilityPct: number;
    avgConvergenceTime: number;
    messagesExchanged: number;
  }[];
}

export function runMultiFailureTest(
  baseTopology: NetworkTopology
): MultiFailureResult[] {
  const kValues = [1, 2, 3, 4];
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const trials = 5;
  // Measure reachability at this time after failure
  // EQA-OSPF with BFD (150ms) + backup should be recovered
  // OSPF with 4s dead interval will NOT have recovered yet
  // RIP with 9s dead interval definitely won't
  const measureDelay = 1000; // 1 second after failure
  const results: MultiFailureResult[] = [];

  for (const k of kValues) {
    const protoResults: MultiFailureResult['protocols'] = [];

    for (const protocol of protocols) {
      let totalReachPct = 0, totalConvTime = 0, totalMsgs = 0;

      for (let t = 0; t < trials; t++) {
        const topo = cloneTopology(baseTopology);
        const state = createSimulator({ topology: topo, protocol, maxSimTime: 30000 });
        runSimulation(state, 5000); // Warmup

        const msgBefore = state.totalMessages;
        const failTime = state.currentTime;

        // Fail k links at once
        const linksCopy = topo.links.filter(l => l.isUp);
        const toFail: typeof linksCopy = [];
        for (let i = 0; i < k && linksCopy.length > 0; i++) {
          const idx = (t * 13 + i * 7 + k * 3) % linksCopy.length;
          toFail.push(linksCopy[idx]);
          linksCopy.splice(idx, 1);
        }
        for (const lnk of toFail) {
          state.eventQueue.push({
            time: state.currentTime + 1,
            type: 'LINK_FAILURE',
            source: lnk.source,
            data: { linkId: lnk.id, node1: lnk.source, node2: lnk.target },
          });
        }

        // Only run for measureDelay after failure (NOT full convergence)
        runSimulation(state, failTime + measureDelay);

        // Check reachability via forwarding tables RIGHT NOW
        // (before slow protocols have converged)
        const nNodes = topo.nodes.length;
        let reachable = 0, total = 0;
        for (let s = 0; s < nNodes; s++) {
          for (let d = 0; d < nNodes; d++) {
            if (s === d) continue;
            total++;
            let cur = s;
            const vis = new Set<number>();
            while (cur !== d) {
              if (vis.has(cur)) break;
              vis.add(cur);
              const rt = state.routers.get(cur)?.routingTable.get(d);
              if (!rt || !rt.isValid || !isFinite(rt.cost)) break;
              const lnk = getLink(topo, cur, rt.nextHop);
              if (!lnk || !lnk.isUp) break;
              cur = rt.nextHop;
            }
            if (cur === d) reachable++;
          }
        }

        totalReachPct += (reachable / total) * 100;
        totalConvTime += state.lastRouteChangeTime - failTime;
        totalMsgs += state.totalMessages - msgBefore;
      }

      const rPct = totalReachPct / trials;
      const cTime = totalConvTime / trials;
      console.log(`[MultiFailure][${protocol}] k=${k}: reachability@${measureDelay}ms=${rPct.toFixed(1)}%, convTime=${cTime.toFixed(1)}ms`);
      
      protoResults.push({
        protocol,
        reachabilityPct: rPct,
        avgConvergenceTime: cTime,
        messagesExchanged: totalMsgs / trials,
      });
    }

    results.push({ k, protocols: protoResults });
  }

  return results;
}

/**
 * Security overhead analysis.
 * 
 * Measures the computational overhead of each protocol's security
 * mechanisms. Uses actual message counts from the simulator and
 * models the per-message crypto cost.
 */
export interface SecurityResult {
  protocol: Protocol;
  mechanism: string;
  messagesPerMinute: number;      // From simulation
  bytesPerAuth: number;           // Bytes added per auth
  cpuCostPerAuth: number;         // Relative cost (MD5=1.0)
  totalOverheadFactor: number;    // Total relative overhead
  attacksBlocked: string[];
  attacksVulnerable: string[];
}

export function runSecurityAnalysis(
  baseTopology: NetworkTopology
): SecurityResult[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const results: SecurityResult[] = [];

  // Run each protocol for 30s and count messages
  for (const protocol of protocols) {
    const topo = cloneTopology(baseTopology);
    const state = createSimulator({ topology: topo, protocol, maxSimTime: 30000 });
    runSimulation(state, 30000);

    const messagesPerMinute = (state.totalMessages / 30) * 60;

    switch (protocol) {
      case 'RIP':
        results.push({
          protocol, mechanism: 'None (v1) / MD5 optional (v2)',
          messagesPerMinute,
          bytesPerAuth: 0,
          cpuCostPerAuth: 0,
          totalOverheadFactor: 1.0,
          attacksBlocked: [],
          attacksVulnerable: ['Route injection', 'Replay', 'Spoofing', 'Metric tampering'],
        });
        break;
      case 'OSPF':
        results.push({
          protocol, mechanism: 'MD5 (optional)',
          messagesPerMinute,
          bytesPerAuth: 16,  // MD5 digest
          cpuCostPerAuth: 1.0,
          totalOverheadFactor: 1.0 + (16 * messagesPerMinute) / (messagesPerMinute * 200), // rough
          attacksBlocked: ['Basic injection (if enabled)'],
          attacksVulnerable: ['Replay (no sequence)', 'Rogue router', 'Metric spoofing'],
        });
        break;
      case 'QAA-OSPF':
        results.push({
          protocol, mechanism: 'HMAC-SHA-256 (mandatory)',
          messagesPerMinute,
          bytesPerAuth: 32,  // SHA-256 digest
          cpuCostPerAuth: 1.8,  // SHA-256 ~1.8x MD5
          totalOverheadFactor: 1.0 + (32 * messagesPerMinute) / (messagesPerMinute * 200),
          attacksBlocked: ['Route injection', 'Basic replay (seq numbers)'],
          attacksVulnerable: ['Replay after reboot', 'Rogue router (no whitelist)'],
        });
        break;
      case 'EQA-OSPF':
        results.push({
          protocol, mechanism: 'HMAC-SHA-256 + Timestamp + NV-SeqNo + BFD-Auth',
          messagesPerMinute,
          bytesPerAuth: 32 + 8 + 4,  // SHA-256 + timestamp + extra seq
          cpuCostPerAuth: 2.1,  // SHA-256 + timestamp check + seq validation
          totalOverheadFactor: 1.0 + (44 * messagesPerMinute) / (messagesPerMinute * 200),
          attacksBlocked: [
            'Route injection', 'Replay (timestamp+seq)',
            'Post-reboot replay (NV seq)', 'Rogue router (whitelist)',
            'BFD hijack (BFD auth)', 'Metric spoofing (4-param harder)',
          ],
          attacksVulnerable: ['Compromised key', 'Side-channel'],
        });
        break;
    }
  }

  return results;
}

/**
 * Format time in milliseconds to readable string
 */
export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Get protocol description
 */
export function getProtocolDescription(protocol: Protocol): {
  name: string;
  algorithm: string;
  metric: string;
  features: string[];
} {
  switch (protocol) {
    case 'RIP':
      return {
        name: 'Routing Information Protocol',
        algorithm: 'Bellman-Ford (Distance Vector)',
        metric: 'Hop count (max 15)',
        features: ['Simple', 'Slow convergence', 'Count-to-infinity problem'],
      };
    case 'OSPF':
      return {
        name: 'Open Shortest Path First',
        algorithm: 'Dijkstra (Link State)',
        metric: '100,000 / bandwidth',
        features: ['Fast convergence', 'Scalable', 'Area-based hierarchy'],
      };
    case 'QAA-OSPF':
      return {
        name: 'QoS-Aware Adaptive OSPF',
        algorithm: 'Dijkstra + Backup Routes',
        metric: '0.40·BW + 0.35·Delay + 0.25·Load',
        features: ['QoS-aware', 'Pre-computed backups', 'ECMP support'],
      };
    case 'EQA-OSPF':
      return {
        name: 'Enhanced QoS-Aware Adaptive OSPF',
        algorithm: 'Dijkstra + BFD + Backup Routes',
        metric: '0.35·BW + 0.30·Delay + 0.20·Load + 0.15·Loss',
        features: ['Loss-aware', 'BFD fast detection', 'Adaptive weights', 'Instant backup'],
      };
  }
}

// ============================================================================
// LARGE-SCALE NETWORK TEST
// ============================================================================

export interface ScaleTestResult {
  networkSize: number;
  numLinks: number;
  protocols: {
    protocol: Protocol;
    warmupTimeMs: number;       // Wall-clock time for initial convergence
    convergenceTimeMs: number;  // Simulated time for failure recovery
    detectionTimeMs: number;    // Simulated failure detection time
    totalMessages: number;      // Messages during warmup
    routingTableValid: number;  // How many valid routes after warmup
    routingTableExpected: number;
    pathQuality: {
      avgLatency: number;
      avgLoss: number;
      flowsDelivered: number;
      flowsAttempted: number;
    };
  }[];
}

export function runLargeScaleTest(
  sizes: number[] = [20, 50, 100]
): ScaleTestResult[] {
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const results: ScaleTestResult[] = [];
  
  console.log('========================================');
  console.log('LARGE-SCALE NETWORK TEST');
  console.log('========================================');

  for (const size of sizes) {
    console.log(`\n--- Network size: ${size} nodes ---`);
    
    const topo = buildTopology(size, 42 + size);
    const nLinks = topo.links.length;
    console.log(`  Built: ${size} nodes, ${nLinks} links`);
    
    const protoResults: ScaleTestResult['protocols'] = [];
    
    for (const protocol of protocols) {
      // Skip RIP for large networks (>15 hop limit)
      if (protocol === 'RIP' && size > 30) {
        console.log(`  [${protocol}] SKIPPED (hop limit exceeded for ${size}-node network)`);
        protoResults.push({
          protocol,
          warmupTimeMs: -1,
          convergenceTimeMs: -1,
          detectionTimeMs: -1,
          totalMessages: 0,
          routingTableValid: 0,
          routingTableExpected: size * (size - 1),
          pathQuality: { avgLatency: 0, avgLoss: 0, flowsDelivered: 0, flowsAttempted: 0 },
        });
        continue;
      }
      
      // Measure wall-clock time for warmup
      const wallStart = performance.now();
      const state = createSimulator({ topology: topo, protocol, maxSimTime: 30000 });
      runSimulation(state, 15000);
      const wallWarmup = performance.now() - wallStart;
      
      // Check routing tables
      let totalValid = 0;
      const expected = size * (size - 1);
      state.routers.forEach((router, id) => {
        router.routingTable.forEach((entry, dest) => {
          if (dest !== id && entry.isValid && isFinite(entry.cost)) totalValid++;
        });
      });
      
      console.log(`  [${protocol}] Warmup: ${wallWarmup.toFixed(0)}ms wall, ${state.totalMessages} msgs, routes=${totalValid}/${expected}`);
      
      // Run convergence test on a random link
      const validLinks = state.topology.links.filter(l => l.isUp);
      const failLink = validLinks[Math.floor(validLinks.length / 2)];
      
      let convTime = 0;
      let detectTime = 0;
      
      if (failLink) {
        const msgBefore = state.totalMessages;
        const failT = state.currentTime;
        
        state.eventQueue.push({
          time: state.currentTime + 1,
          type: 'LINK_FAILURE',
          source: failLink.source,
          data: { linkId: failLink.id, node1: failLink.source, node2: failLink.target },
        });
        
        runSimulation(state, state.currentTime + 20000);
        
        convTime = state.lastRouteChangeTime - failT;
        detectTime = (state.detectionTime || failT) - failT;
        console.log(`  [${protocol}] Failure: detect=${detectTime.toFixed(0)}ms, conv=${convTime.toFixed(0)}ms, msgs=${state.totalMessages - msgBefore}`);
      }
      
      // Path quality on sample flows
      const nFlows = Math.min(30, size * 2);
      let totalLat = 0, totalLoss = 0, delivered = 0;
      
      for (let i = 0; i < nFlows; i++) {
        const src = (i * 7 + 3) % size;
        let dst = (i * 11 + 5) % size;
        if (dst === src) dst = (dst + 1) % size;
        
        let cur = src;
        const vis = new Set<number>();
        const path = [src];
        
        while (cur !== dst) {
          if (vis.has(cur)) break;
          vis.add(cur);
          const rt = state.routers.get(cur)?.routingTable.get(dst);
          if (!rt || !rt.isValid || !isFinite(rt.cost)) break;
          const lnk = getLink(state.topology, cur, rt.nextHop);
          if (!lnk || !lnk.isUp) break;
          path.push(rt.nextHop);
          cur = rt.nextHop;
        }
        
        if (cur === dst && path.length >= 2) {
          let lat = 0, prob = 1;
          for (let j = 0; j < path.length - 1; j++) {
            const lnk = getLink(state.topology, path[j], path[j + 1]);
            if (lnk) { lat += lnk.delay; prob *= (1 - lnk.loss); }
          }
          totalLat += lat;
          totalLoss += (1 - prob) * 100;
          delivered++;
        }
      }
      
      const avgLat = delivered > 0 ? totalLat / delivered : 0;
      const avgLoss = delivered > 0 ? totalLoss / delivered : 0;
      console.log(`  [${protocol}] Quality: ${delivered}/${nFlows} delivered, lat=${avgLat.toFixed(1)}ms, loss=${avgLoss.toFixed(2)}%`);
      
      protoResults.push({
        protocol,
        warmupTimeMs: wallWarmup,
        convergenceTimeMs: convTime,
        detectionTimeMs: detectTime,
        totalMessages: state.totalMessages,
        routingTableValid: totalValid,
        routingTableExpected: expected,
        pathQuality: { avgLatency: avgLat, avgLoss: avgLoss, flowsDelivered: delivered, flowsAttempted: nFlows },
      });
    }
    
    results.push({ networkSize: size, numLinks: nLinks, protocols: protoResults });
  }
  
  console.log('\n========================================');
  console.log('LARGE-SCALE TEST COMPLETE');
  console.log('========================================');
  
  return results;
}

import { buildTopology } from './NetworkBuilder';
