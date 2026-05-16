/**
 * EQA-OSPF Discrete Event Simulation - Type Definitions
 * EN2150 Communication Network Engineering
 * 
 * This implements a proper event-driven simulation where:
 * - Time advances through discrete events
 * - Routers maintain state and exchange messages
 * - Convergence is measured by actual routing table stability
 */

// ============================================================================
// NETWORK TYPES
// ============================================================================

export interface Link {
  id: string;
  source: number;
  target: number;
  bandwidth: number;      // Mbps
  delay: number;          // ms (propagation delay)
  loss: number;           // 0-1 probability
  utilization: number;    // 0-1
  isUp: boolean;          // Link status
}

export interface Node {
  id: number;
  x: number;
  y: number;
}

export interface NetworkTopology {
  nodes: Node[];
  links: Link[];
  adjacency: Map<number, number[]>;  // node -> neighbors
}

// ============================================================================
// SIMULATION EVENT TYPES
// ============================================================================

export type EventType = 
  | 'HELLO_SEND'           // Send hello to neighbors
  | 'HELLO_RECEIVE'        // Receive hello from neighbor
  | 'UPDATE_SEND'          // RIP: Send routing update
  | 'UPDATE_RECEIVE'       // RIP: Receive routing update
  | 'LSA_SEND'             // OSPF: Send Link State Advertisement
  | 'LSA_RECEIVE'          // OSPF: Receive LSA
  | 'LSA_FLOOD'            // OSPF: Flood LSA to neighbors
  | 'SPF_COMPUTE'          // OSPF: Run Dijkstra
  | 'LINK_FAILURE'         // Link goes down
  | 'LINK_RECOVERY'        // Link comes back up
  | 'NEIGHBOR_TIMEOUT'     // Neighbor declared dead
  | 'BFD_SEND'             // BFD: Send BFD hello
  | 'BFD_RECEIVE'          // BFD: Receive BFD hello
  | 'BFD_TIMEOUT'          // BFD: Neighbor timeout
  | 'BACKUP_ACTIVATE'      // EQA: Activate backup route
  | 'METRIC_UPDATE'        // QAA/EQA: Quality metric changed
  | 'CHECK_CONVERGENCE';   // Check if network has converged

export interface SimEvent {
  time: number;           // Simulation time in milliseconds
  type: EventType;
  source: number;         // Source router ID
  target?: number;        // Target router ID (for messages)
  data?: any;             // Event-specific data
}

// ============================================================================
// ROUTER STATE
// ============================================================================

export interface RoutingEntry {
  destination: number;
  nextHop: number;
  cost: number;
  hops: number;
  timestamp: number;      // When this entry was last updated
  isValid: boolean;
}

export interface NeighborEntry {
  neighborId: number;
  linkId: string;
  lastHello: number;      // Last hello received time
  isUp: boolean;
  bfdLastSeen?: number;   // For EQA-OSPF BFD
}

// OSPF Link State Database entry
export interface LSAEntry {
  routerId: number;       // Originating router
  sequenceNumber: number;
  timestamp: number;
  links: {
    neighborId: number;
    cost: number;
    bandwidth: number;
    delay: number;
    utilization: number;
    loss: number;
  }[];
}

export interface RouterState {
  id: number;
  routingTable: Map<number, RoutingEntry>;
  neighbors: Map<number, NeighborEntry>;
  
  // OSPF-specific
  lsdb?: Map<number, LSAEntry>;       // Link State Database
  lsaSeqNum?: number;                  // Own LSA sequence number
  
  // QAA/EQA-specific
  backupRoutes?: Map<number, RoutingEntry>;  // Pre-computed backups
  
  // Statistics
  messagesSent: number;
  messagesReceived: number;
  spfComputations: number;
}

// ============================================================================
// PROTOCOL CONFIGURATION
// ============================================================================

export type Protocol = 'RIP' | 'OSPF' | 'QAA-OSPF' | 'EQA-OSPF';

export interface ProtocolConfig {
  name: Protocol;
  helloInterval: number;      // ms between hellos
  deadInterval: number;       // ms until neighbor timeout
  updateInterval?: number;    // RIP: ms between full updates
  spfDelay?: number;          // OSPF: ms delay before SPF after LSA
  bfdInterval?: number;       // EQA: ms between BFD hellos
  bfdMultiplier?: number;     // EQA: missed BFDs before timeout
  metricWeights?: {           // QAA/EQA: composite metric weights
    bandwidth: number;
    delay: number;
    load: number;
    loss: number;
  };
}

export const PROTOCOL_CONFIGS: Record<Protocol, ProtocolConfig> = {
  'RIP': {
    name: 'RIP',
    helloInterval: 30000,     // 30 seconds
    deadInterval: 180000,     // 180 seconds (6x hello)
    updateInterval: 30000,    // 30 seconds
  },
  'OSPF': {
    name: 'OSPF',
    helloInterval: 10000,     // 10 seconds
    deadInterval: 40000,      // 40 seconds (4x hello)
    spfDelay: 200,            // 200ms SPF delay
  },
  'QAA-OSPF': {
    name: 'QAA-OSPF',
    helloInterval: 10000,
    deadInterval: 40000,
    spfDelay: 200,
    metricWeights: {
      bandwidth: 0.40,
      delay: 0.35,
      load: 0.25,
      loss: 0.00,
    },
  },
  'EQA-OSPF': {
    name: 'EQA-OSPF',
    helloInterval: 10000,
    deadInterval: 40000,
    spfDelay: 200,
    bfdInterval: 50,          // 50ms BFD
    bfdMultiplier: 3,         // 3 missed = failure (150ms)
    metricWeights: {
      bandwidth: 0.35,
      delay: 0.30,
      load: 0.20,
      loss: 0.15,
    },
  },
};

// ============================================================================
// SIMULATION RESULTS
// ============================================================================

export interface ConvergenceResult {
  protocol: Protocol;
  failureTime: number;        // When the failure occurred
  detectionTime: number;      // When failure was detected
  convergenceTime: number;    // When all routers had correct routes
  totalTime: number;          // Total time from failure to convergence
  messagesExchanged: number;  // Control messages during convergence
  routeChanges: number;       // Number of routing table updates
}

export interface SimulationStats {
  protocol: Protocol;
  totalMessages: number;
  totalSPFRuns: number;
  avgConvergenceTime: number;
  routingTableChanges: number;
  timeline: { time: number; event: string; detail: string }[];
}

export interface PathResult {
  source: number;
  destination: number;
  path: number[];
  cost: number;
  hops: number;
  totalDelay: number;         // Sum of link delays
  effectiveLoss: number;      // 1 - product of (1-loss)
  bandwidth: number;          // Min bandwidth on path
}
