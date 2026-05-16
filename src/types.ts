// Network topology types
export interface Link {
  source: number;
  target: number;
  bandwidth: number; // Mbps
  delay: number; // ms
  loss: number; // 0-1 (percentage as decimal)
  utilization: number; // 0-1
}

export interface Node {
  id: number;
  x: number;
  y: number;
  degree: number;
}

export interface NetworkGraph {
  nodes: Node[];
  links: Link[];
}

export interface RoutingTable {
  [destination: number]: {
    cost: number;
    path: number[];
    nextHop: number | null;
  };
}

// Protocol definitions
export type Protocol = 'RIP' | 'OSPF' | 'QAA-OSPF' | 'EQA-OSPF';

export interface ProtocolColor {
  primary: string;
  light: string;
  dark: string;
}

export const PROTOCOL_COLORS: Record<Protocol, ProtocolColor> = {
  'RIP': { primary: '#EF4444', light: '#FEE2E2', dark: '#DC2626' },
  'OSPF': { primary: '#3B82F6', light: '#DBEAFE', dark: '#2563EB' },
  'QAA-OSPF': { primary: '#F59E0B', light: '#FEF3C7', dark: '#D97706' },
  'EQA-OSPF': { primary: '#10B981', light: '#D1FAE5', dark: '#059669' },
};

// Traffic profiles for EQA-OSPF
export type TrafficProfile = 'balanced' | 'latency_sensitive' | 'bulk_transfer' | 'lossy_wireless' | 'congestion_avoid';

export interface WeightProfile {
  a: number; // bandwidth
  b: number; // delay
  g: number; // load
  d: number; // loss
}

export const TRAFFIC_PROFILES: Record<TrafficProfile, WeightProfile> = {
  balanced: { a: 0.35, b: 0.30, g: 0.20, d: 0.15 },
  latency_sensitive: { a: 0.20, b: 0.50, g: 0.15, d: 0.15 },
  bulk_transfer: { a: 0.55, b: 0.15, g: 0.20, d: 0.10 },
  lossy_wireless: { a: 0.20, b: 0.20, g: 0.20, d: 0.40 },
  congestion_avoid: { a: 0.25, b: 0.25, g: 0.40, d: 0.10 },
};

// Simulation results
export interface ConvergenceResult {
  protocol: Protocol;
  severity: 'single' | 'cascade' | 'partition';
  times: number[];
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface OverheadResult {
  protocol: Protocol;
  timeline: number[]; // packets per minute over 60 min
  total: number;
}

export interface LoadDistribution {
  protocol: Protocol;
  loads: number[];
  mean: number;
  std: number;
  max: number;
}

export interface PathQuality {
  protocol: Protocol;
  profile: TrafficProfile;
  meanLatency: number;
  stdLatency: number;
  meanLoss: number;
  stdLoss: number;
}

export interface ScalabilityResult {
  size: number;
  times: Record<Protocol, number>;
}

export interface MultiFailureResult {
  k: number; // number of simultaneous failures
  reachability: Record<Protocol, number>;
}

export interface SecurityOverhead {
  mechanism: string;
  protocol: string;
  overhead: number;
}
