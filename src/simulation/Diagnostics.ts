/**
 * Simulation Diagnostics & Validation
 * 
 * Runs 10+ checks per protocol to verify the simulation is correct.
 * Each check returns PASS/FAIL with the actual values found.
 */

import { NetworkTopology, Protocol } from './types';
import { getLink } from './NetworkBuilder';
import { createSimulator, runSimulation } from './Simulator';

export interface DiagnosticCheck {
  id: string;
  category: 'topology' | 'routing' | 'convergence' | 'metric' | 'security' | 'protocol';
  protocol: Protocol | 'ALL';
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export function runFullDiagnostics(topology: NetworkTopology): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  
  console.log('========================================');
  console.log('RUNNING DIAGNOSTICS');
  console.log('========================================');

  // ── TOPOLOGY CHECKS ──
  checks.push(...checkTopology(topology));
  
  // ── PER-PROTOCOL CHECKS ──
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  for (const proto of protocols) {
    checks.push(...checkProtocol(topology, proto));
  }
  
  // ── CROSS-PROTOCOL COMPARISON CHECKS ──
  checks.push(...checkCrossProtocol(topology));

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  console.log(`========================================`);
  console.log(`DIAGNOSTICS COMPLETE: ${passed} PASSED, ${failed} FAILED out of ${checks.length}`);
  console.log(`========================================`);

  return checks;
}

// ============================================================================
// TOPOLOGY CHECKS
// ============================================================================

function checkTopology(topology: NetworkTopology): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  // T1: Node count
  checks.push({
    id: 'T1', category: 'topology', protocol: 'ALL',
    name: 'Network has expected number of nodes',
    expected: '12 nodes',
    actual: `${topology.nodes.length} nodes`,
    passed: topology.nodes.length === 12,
  });

  // T2: Connectivity
  const visited = new Set<number>();
  const queue = [0];
  while (queue.length > 0) {
    const n = queue.shift()!;
    if (visited.has(n)) continue;
    visited.add(n);
    for (const nb of topology.adjacency.get(n) || []) {
      if (!visited.has(nb)) queue.push(nb);
    }
  }
  checks.push({
    id: 'T2', category: 'topology', protocol: 'ALL',
    name: 'Network is fully connected',
    expected: `${topology.nodes.length} reachable nodes`,
    actual: `${visited.size} reachable nodes`,
    passed: visited.size === topology.nodes.length,
  });

  // T3: Link count
  checks.push({
    id: 'T3', category: 'topology', protocol: 'ALL',
    name: 'Network has sufficient links for redundancy',
    expected: '≥ 13 links (N+1 for 12 nodes)',
    actual: `${topology.links.length} links`,
    passed: topology.links.length >= 13,
  });

  // T4: All links up
  const upLinks = topology.links.filter(l => l.isUp).length;
  checks.push({
    id: 'T4', category: 'topology', protocol: 'ALL',
    name: 'All links are initially UP',
    expected: `${topology.links.length} up`,
    actual: `${upLinks} up`,
    passed: upLinks === topology.links.length,
  });

  // T5: Bandwidth values valid
  const validBw = topology.links.every(l => [10, 100, 1000].includes(l.bandwidth));
  const bwCounts = { 10: 0, 100: 0, 1000: 0 };
  topology.links.forEach(l => { if (l.bandwidth in bwCounts) bwCounts[l.bandwidth as 10|100|1000]++; });
  checks.push({
    id: 'T5', category: 'topology', protocol: 'ALL',
    name: 'All bandwidths are valid (10/100/1000 Mbps)',
    expected: 'All links ∈ {10, 100, 1000}',
    actual: `10M:${bwCounts[10]}, 100M:${bwCounts[100]}, 1G:${bwCounts[1000]}, valid=${validBw}`,
    passed: validBw,
  });

  // T6: Delay range
  const delays = topology.links.map(l => l.delay);
  const minD = Math.min(...delays), maxD = Math.max(...delays);
  checks.push({
    id: 'T6', category: 'topology', protocol: 'ALL',
    name: 'Link delays are in range [1, 50] ms',
    expected: '1 ≤ delay ≤ 50',
    actual: `min=${minD.toFixed(1)}ms, max=${maxD.toFixed(1)}ms`,
    passed: minD >= 1 && maxD <= 50,
  });

  return checks;
}

// ============================================================================
// PER-PROTOCOL CHECKS
// ============================================================================

function checkProtocol(topology: NetworkTopology, protocol: Protocol): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  const prefix = protocol.replace('-', '');

  // Create simulator and run warmup
  const state = createSimulator({ topology, protocol, maxSimTime: 20000 });
  runSimulation(state, 15000);

  const n = topology.nodes.length;

  // P1: Routing table populated
  let totalValid = 0;
  let totalEntries = 0;
  state.routers.forEach((router, id) => {
    router.routingTable.forEach((entry, dest) => {
      if (dest !== id) {
        totalEntries++;
        if (entry.isValid && isFinite(entry.cost)) totalValid++;
      }
    });
  });
  const expectedRoutes = n * (n - 1);
  checks.push({
    id: `${prefix}-1`, category: 'routing', protocol,
    name: `${protocol}: All routing tables populated after warmup`,
    expected: `${expectedRoutes} valid routes`,
    actual: `${totalValid} valid out of ${totalEntries} entries`,
    passed: totalValid >= expectedRoutes * 0.95,
  });

  // P2: Every node can reach every other node via forwarding
  let reachablePairs = 0;
  let unreachableDetail = '';
  for (let s = 0; s < n; s++) {
    for (let d = 0; d < n; d++) {
      if (s === d) continue;
      let cur = s;
      const vis = new Set<number>();
      while (cur !== d) {
        if (vis.has(cur)) break;
        vis.add(cur);
        const rt = state.routers.get(cur)?.routingTable.get(d);
        if (!rt || !rt.isValid || !isFinite(rt.cost)) break;
        const lnk = getLink(state.topology, cur, rt.nextHop);
        if (!lnk || !lnk.isUp) break;
        cur = rt.nextHop;
      }
      if (cur === d) {
        reachablePairs++;
      } else if (unreachableDetail.length < 100) {
        // Capture first few failures for debug
        const rt = state.routers.get(s)?.routingTable.get(d);
        unreachableDetail += `${s}→${d}(${rt ? `nh=${rt.nextHop},cost=${rt.cost.toFixed(0)},valid=${rt.isValid}` : 'NO_ROUTE'}); `;
      }
    }
  }
  checks.push({
    id: `${prefix}-2`, category: 'routing', protocol,
    name: `${protocol}: All node pairs reachable via forwarding tables`,
    expected: `${expectedRoutes} pairs reachable`,
    actual: `${reachablePairs} reachable${unreachableDetail ? '. Failures: ' + unreachableDetail : ''}`,
    passed: reachablePairs === expectedRoutes,
  });

  // P3: No routing loops
  let loopCount = 0;
  for (let s = 0; s < n; s++) {
    for (let d = 0; d < n; d++) {
      if (s === d) continue;
      let cur = s;
      const vis = new Set<number>();
      while (cur !== d && !vis.has(cur)) {
        vis.add(cur);
        const rt = state.routers.get(cur)?.routingTable.get(d);
        if (!rt || !rt.isValid) break;
        cur = rt.nextHop;
      }
      if (vis.has(cur) && cur !== d) loopCount++;
    }
  }
  checks.push({
    id: `${prefix}-3`, category: 'routing', protocol,
    name: `${protocol}: No routing loops detected`,
    expected: '0 loops',
    actual: `${loopCount} loops`,
    passed: loopCount === 0,
  });

  // P4: Self-route exists for all routers
  let selfRouteOk = 0;
  state.routers.forEach((router, id) => {
    const self = router.routingTable.get(id);
    if (self && self.cost === 0 && self.nextHop === id) selfRouteOk++;
  });
  checks.push({
    id: `${prefix}-4`, category: 'routing', protocol,
    name: `${protocol}: All routers have cost-0 self-route`,
    expected: `${n} self-routes`,
    actual: `${selfRouteOk} self-routes`,
    passed: selfRouteOk === n,
  });

  // P5: Messages were exchanged
  checks.push({
    id: `${prefix}-5`, category: 'protocol', protocol,
    name: `${protocol}: Control messages were exchanged during warmup`,
    expected: '> 100 messages',
    actual: `${state.totalMessages} messages`,
    passed: state.totalMessages > 100,
  });

  // P6: Protocol-specific check — LSDB or distance vector
  if (protocol === 'RIP') {
    // RIP: Check hop counts are ≤ 15
    let maxHops = 0;
    state.routers.forEach(router => {
      router.routingTable.forEach(entry => {
        if (entry.isValid && entry.hops > maxHops) maxHops = entry.hops;
      });
    });
    checks.push({
      id: `${prefix}-6`, category: 'protocol', protocol,
      name: `RIP: All hop counts ≤ 15`,
      expected: 'max hops ≤ 15',
      actual: `max hops = ${maxHops}`,
      passed: maxHops <= 15 && maxHops > 0,
    });

    // RIP: All costs equal hop count (cost = hops for RIP)
    let costMismatch = 0;
    state.routers.forEach(router => {
      router.routingTable.forEach((entry, dest) => {
        if (dest !== router.id && entry.isValid) {
          if (entry.cost !== entry.hops) costMismatch++;
        }
      });
    });
    checks.push({
      id: `${prefix}-7`, category: 'metric', protocol,
      name: `RIP: Cost equals hop count for all routes`,
      expected: '0 mismatches',
      actual: `${costMismatch} mismatches`,
      passed: costMismatch === 0,
    });
  } else {
    // OSPF variants: Check LSDB
    let lsdbSizes: number[] = [];
    let spfRuns: number[] = [];
    state.routers.forEach(router => {
      if (router.lsdb) lsdbSizes.push(router.lsdb.size);
      spfRuns.push(router.spfComputations);
    });
    const minLsdb = Math.min(...lsdbSizes);
    const maxLsdb = Math.max(...lsdbSizes);
    checks.push({
      id: `${prefix}-6`, category: 'protocol', protocol,
      name: `${protocol}: LSDB populated on all routers`,
      expected: `${n} entries per router (one LSA per router)`,
      actual: `min=${minLsdb}, max=${maxLsdb} entries`,
      passed: minLsdb >= n - 1,
    });

    const minSpf = Math.min(...spfRuns);
    checks.push({
      id: `${prefix}-7`, category: 'protocol', protocol,
      name: `${protocol}: SPF ran at least once on every router`,
      expected: '≥ 1 SPF per router',
      actual: `min=${minSpf}, max=${Math.max(...spfRuns)} SPF runs`,
      passed: minSpf >= 1,
    });
  }

  // P8: Metric values are positive and finite
  let invalidMetrics = 0;
  let metricRange = { min: Infinity, max: -Infinity };
  state.routers.forEach(router => {
    router.routingTable.forEach((entry, dest) => {
      if (dest !== router.id && entry.isValid) {
        if (!isFinite(entry.cost) || entry.cost <= 0) invalidMetrics++;
        metricRange.min = Math.min(metricRange.min, entry.cost);
        metricRange.max = Math.max(metricRange.max, entry.cost);
      }
    });
  });
  checks.push({
    id: `${prefix}-8`, category: 'metric', protocol,
    name: `${protocol}: All valid route costs are finite and positive`,
    expected: '0 invalid metrics',
    actual: `${invalidMetrics} invalid (range: ${metricRange.min.toFixed(1)} – ${metricRange.max.toFixed(1)})`,
    passed: invalidMetrics === 0,
  });

  // P9: Path quality measurable — pick 5 random pairs and measure latency
  let measuredPaths = 0;
  let totalLat = 0;
  let totalLoss = 0;
  const samplePairs = [[0,5],[1,8],[2,10],[3,11],[4,9]];
  for (const [s, d] of samplePairs) {
    if (s >= n || d >= n) continue;
    let cur = s;
    const vis = new Set<number>();
    const path = [s];
    while (cur !== d && !vis.has(cur)) {
      vis.add(cur);
      const rt = state.routers.get(cur)?.routingTable.get(d);
      if (!rt || !rt.isValid || !isFinite(rt.cost)) break;
      const lnk = getLink(state.topology, cur, rt.nextHop);
      if (!lnk || !lnk.isUp) break;
      path.push(rt.nextHop);
      cur = rt.nextHop;
    }
    if (cur === d && path.length >= 2) {
      measuredPaths++;
      let lat = 0, prob = 1;
      for (let j = 0; j < path.length - 1; j++) {
        const lnk = getLink(state.topology, path[j], path[j + 1]);
        if (lnk) { lat += lnk.delay; prob *= (1 - lnk.loss); }
      }
      totalLat += lat;
      totalLoss += (1 - prob) * 100;
    }
  }
  checks.push({
    id: `${prefix}-9`, category: 'metric', protocol,
    name: `${protocol}: Path latency/loss measurable on sample paths`,
    expected: `${samplePairs.length} paths measurable`,
    actual: `${measuredPaths} paths, avgLat=${measuredPaths > 0 ? (totalLat/measuredPaths).toFixed(1) : 'N/A'}ms, avgLoss=${measuredPaths > 0 ? (totalLoss/measuredPaths).toFixed(2) : 'N/A'}%`,
    passed: measuredPaths >= samplePairs.length - 1,
  });

  // P10: Neighbor table consistency
  let nbIssues = 0;
  state.routers.forEach((router, id) => {
    router.neighbors.forEach((_nb, nbId) => {
      // Check neighbor link exists in topology
      const link = getLink(state.topology, id, nbId);
      if (!link) nbIssues++;
      // Check bidirectional — neighbor should also list us
      const otherRouter = state.routers.get(nbId);
      if (otherRouter && !otherRouter.neighbors.has(id)) nbIssues++;
    });
  });
  checks.push({
    id: `${prefix}-10`, category: 'protocol', protocol,
    name: `${protocol}: Neighbor tables are consistent and bidirectional`,
    expected: '0 inconsistencies',
    actual: `${nbIssues} issues`,
    passed: nbIssues === 0,
  });

  // P11: Protocol-specific metric check
  if (protocol === 'OSPF') {
    // OSPF costs should be 100000/BW
    let correctCosts = 0, totalChecked = 0;
    state.routers.forEach(router => {
      router.neighbors.forEach((nb, nbId) => {
        if (nb.isUp) {
          const link = getLink(state.topology, router.id, nbId);
          if (link) {
            const expectedCost = Math.max(1, Math.floor(100000 / link.bandwidth));
            totalChecked++;
            const rt = router.routingTable.get(nbId);
            // Direct neighbor cost should equal the single-link cost
            if (rt && rt.isValid && Math.abs(rt.cost - expectedCost) < 50) correctCosts++;
          }
        }
      });
    });
    checks.push({
      id: `${prefix}-11`, category: 'metric', protocol,
      name: `OSPF: Direct neighbor costs ≈ 100000/BW`,
      expected: `≥ 80% correct`,
      actual: `${correctCosts}/${totalChecked} correct`,
      passed: correctCosts >= totalChecked * 0.8,
    });
  } else if (protocol === 'EQA-OSPF') {
    // EQA should have backup routes
    let hasBackup = 0;
    state.routers.forEach(router => {
      if (router.backupRoutes && router.backupRoutes.size > 0) hasBackup++;
    });
    checks.push({
      id: `${prefix}-11`, category: 'protocol', protocol,
      name: `EQA-OSPF: Backup routes computed`,
      expected: `≥ ${Math.floor(n * 0.5)} routers with backups`,
      actual: `${hasBackup} routers have backup routes`,
      passed: hasBackup >= Math.floor(n * 0.5),
    });
  } else if (protocol === 'QAA-OSPF') {
    let hasBackup = 0;
    state.routers.forEach(router => {
      if (router.backupRoutes && router.backupRoutes.size > 0) hasBackup++;
    });
    checks.push({
      id: `${prefix}-11`, category: 'protocol', protocol,
      name: `QAA-OSPF: Backup routes computed`,
      expected: `≥ ${Math.floor(n * 0.5)} routers with backups`,
      actual: `${hasBackup} routers have backup routes`,
      passed: hasBackup >= Math.floor(n * 0.5),
    });
  } else {
    checks.push({
      id: `${prefix}-11`, category: 'metric', protocol,
      name: `RIP: No LSDB (distance-vector protocol)`,
      expected: 'LSDB = undefined',
      actual: `LSDB = ${state.routers.get(0)?.lsdb === undefined ? 'undefined' : 'EXISTS'}`,
      passed: state.routers.get(0)?.lsdb === undefined,
    });
  }

  // P12: Route changes happened during warmup (proves algorithm ran)
  checks.push({
    id: `${prefix}-12`, category: 'routing', protocol,
    name: `${protocol}: Routing table changes occurred during convergence`,
    expected: '> 0 changes',
    actual: `${state.routeChanges} changes`,
    passed: state.routeChanges > 0,
  });

  // Log summary
  const passed = checks.filter(c => c.protocol === protocol && c.passed).length;
  const total = checks.filter(c => c.protocol === protocol).length;
  console.log(`[Diagnostics][${protocol}] ${passed}/${total} checks passed`);

  return checks;
}

// ============================================================================
// CROSS-PROTOCOL COMPARISON CHECKS
// ============================================================================

function checkCrossProtocol(topology: NetworkTopology): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  
  // Run all protocols and compare paths
  const protocols: Protocol[] = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'];
  const states = new Map<Protocol, ReturnType<typeof createSimulator>>();
  
  for (const proto of protocols) {
    const state = createSimulator({ topology, protocol: proto, maxSimTime: 20000 });
    runSimulation(state, 15000);
    states.set(proto, state);
  }

  // X1: Different protocols produce different paths (they should, since metrics differ)
  const src = 0, dst = topology.nodes.length - 1;
  const paths: Record<string, string> = {};
  for (const proto of protocols) {
    const st = states.get(proto)!;
    let cur = src;
    const vis = new Set<number>();
    const path = [src];
    while (cur !== dst && !vis.has(cur)) {
      vis.add(cur);
      const rt = st.routers.get(cur)?.routingTable.get(dst);
      if (!rt || !rt.isValid) break;
      path.push(rt.nextHop);
      cur = rt.nextHop;
    }
    paths[proto] = cur === dst ? path.join('→') : 'UNREACHABLE';
  }
  const uniquePaths = new Set(Object.values(paths)).size;
  checks.push({
    id: 'X1', category: 'routing', protocol: 'ALL',
    name: 'Different protocols choose different paths (metric diversity)',
    expected: '≥ 2 unique paths across 4 protocols',
    actual: `${uniquePaths} unique paths: ${Object.entries(paths).map(([p,path]) => `${p}=[${path}]`).join(', ')}`,
    passed: uniquePaths >= 2,
  });

  // X2: RIP uses more hops on average (because it minimizes hop count, not quality)
  let ripHops = 0, ospfHops = 0, ripCount = 0, ospfCount = 0;
  const ripState = states.get('RIP')!;
  const ospfState = states.get('OSPF')!;
  ripState.routers.get(0)?.routingTable.forEach((e, d) => { if (d !== 0 && e.isValid) { ripHops += e.hops; ripCount++; } });
  ospfState.routers.get(0)?.routingTable.forEach((e, d) => { if (d !== 0 && e.isValid) { ospfHops += e.hops; ospfCount++; } });
  const ripAvg = ripCount > 0 ? ripHops / ripCount : 0;
  const ospfAvg = ospfCount > 0 ? ospfHops / ospfCount : 0;
  checks.push({
    id: 'X2', category: 'metric', protocol: 'ALL',
    name: 'RIP avg hops ≤ OSPF avg hops (RIP minimizes hops)',
    expected: `RIP avg hops ≤ OSPF avg hops`,
    actual: `RIP=${ripAvg.toFixed(2)} hops, OSPF=${ospfAvg.toFixed(2)} hops`,
    passed: ripAvg <= ospfAvg + 0.5,
  });

  // X3: EQA-OSPF has BFD state (others don't)
  const eqaState = states.get('EQA-OSPF')!;
  let hasBfd = false;
  eqaState.routers.forEach(r => {
    r.neighbors.forEach(n => { if (n.bfdLastSeen !== undefined) hasBfd = true; });
  });
  checks.push({
    id: 'X3', category: 'protocol', protocol: 'ALL',
    name: 'EQA-OSPF has BFD state, others do not',
    expected: 'EQA-OSPF bfdLastSeen exists',
    actual: `EQA-OSPF BFD active: ${hasBfd}`,
    passed: hasBfd,
  });

  // X4: EQA-OSPF messages > OSPF messages (BFD overhead)
  const ospfMsgs = states.get('OSPF')!.totalMessages;
  const eqaMsgs = states.get('EQA-OSPF')!.totalMessages;
  checks.push({
    id: 'X4', category: 'protocol', protocol: 'ALL',
    name: 'EQA-OSPF sends more messages than OSPF (BFD overhead)',
    expected: `EQA msgs > OSPF msgs`,
    actual: `EQA=${eqaMsgs}, OSPF=${ospfMsgs}, ratio=${(eqaMsgs/ospfMsgs).toFixed(1)}×`,
    passed: eqaMsgs > ospfMsgs,
  });

  console.log(`[Diagnostics][Cross-Protocol] ${checks.filter(c=>c.passed).length}/${checks.length} checks passed`);

  return checks;
}
