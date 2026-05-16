import { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';

interface CodeViewerProps {
  title: string;
  code: string;
  language?: string;
}

export default function CodeViewer({ title, code, language = 'python' }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">{title}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-400">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-slate-300 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

// Python code snippets for the simulation
export const PYTHON_CODES = {
  topology: `"""
Network Topology Builder
Equivalent to NetworkX graph construction
"""
import networkx as nx
import random

def build_topology(n_nodes=12, seed=42):
    random.seed(seed)
    G = nx.Graph()
    nodes = list(range(n_nodes))
    G.add_nodes_from(nodes)

    # Create spanning tree for connectivity
    shuffled = nodes[:]
    random.shuffle(shuffled)
    for i in range(1, len(shuffled)):
        G.add_edge(shuffled[i-1], shuffled[i], **_rand_link())

    # Add extra edges for redundancy
    extra = int(n_nodes * 0.6)
    attempts = 0
    while extra > 0 and attempts < 400:
        u, v = random.choice(nodes), random.choice(nodes)
        if u != v and not G.has_edge(u, v):
            G.add_edge(u, v, **_rand_link())
            extra -= 1
        attempts += 1
    return G

def _rand_link():
    """Generate random link properties"""
    bw = random.choice([10, 100, 1000])  # Mbps
    delay = random.uniform(1, 50)         # ms
    loss = random.uniform(0.0, 0.08)      # 0-8%
    util = random.uniform(0.05, 0.85)     # 5-85%
    return dict(bandwidth=bw, delay=delay, loss=loss, utilization=util)`,

  metrics: `"""
Routing Metric Functions
Each protocol uses different cost calculations
"""

def rip_cost(G, u, v):
    """RIP: Simple hop count (each link = 1)"""
    return 1

def ospf_cost(G, u, v):
    """OSPF: Bandwidth-based cost = 100,000 / BW(Mbps)"""
    return max(1, int(100_000 / G[u][v]['bandwidth']))

def qaa_ospf_cost(G, u, v, a=0.40, b=0.35, g=0.25):
    """
    QAA-OSPF: 3-component composite metric
    M = α·C_bw + β·C_delay + γ·C_load
    """
    bw = G[u][v]['bandwidth']
    dly = G[u][v]['delay']
    util = G[u][v]['utilization']
    
    c_bw = max(1, int(100_000 / bw))
    c_delay = dly * 2
    c_load = util * 100
    
    return a * c_bw + b * c_delay + g * c_load

def eqa_ospf_cost(G, u, v, a=0.35, b=0.30, g=0.20, d=0.15):
    """
    EQA-OSPF: 4-component composite metric with loss awareness
    M = α·C_bw + β·C_delay + γ·C_load + δ·C_loss
    """
    bw = G[u][v]['bandwidth']
    dly = G[u][v]['delay']
    util = G[u][v]['utilization']
    loss = G[u][v]['loss']
    
    c_bw = max(1, int(100_000 / bw))
    c_delay = dly * 2
    c_load = util * 100
    c_loss = loss * 1000  # Scale 0-8% to 0-80
    
    return a * c_bw + b * c_delay + g * c_load + d * c_loss`,

  dijkstra: `"""
Dijkstra's Algorithm Implementation
Used by OSPF, QAA-OSPF, and EQA-OSPF
"""
import heapq
import math

def dijkstra(G, source, weight_fn, **kwargs):
    """
    Standard Dijkstra's shortest path algorithm
    Returns distance dict, predecessor dict, and iteration count
    """
    dist = {n: math.inf for n in G.nodes()}
    prev = {n: None for n in G.nodes()}
    dist[source] = 0
    visited = set()
    queue = [(0, source)]
    iterations = 0

    while queue:
        d, u = heapq.heappop(queue)
        iterations += 1
        
        if u in visited:
            continue
        visited.add(u)
        
        for v in G.neighbors(u):
            w = weight_fn(G, u, v, **kwargs)
            if d + w < dist[v]:
                dist[v] = d + w
                prev[v] = u
                heapq.heappush(queue, (dist[v], v))

    return dist, prev, iterations`,

  bellmanFord: `"""
Bellman-Ford Algorithm Implementation
Used by RIP (with hop count limit)
"""
import math

def bellman_ford(G, source, weight_fn, max_hops=15):
    """
    Bellman-Ford with RIP's 15-hop limit
    Returns distance dict, predecessor dict, iteration count
    """
    dist = {n: math.inf for n in G.nodes()}
    prev = {n: None for n in G.nodes()}
    dist[source] = 0
    nodes = list(G.nodes())
    iterations = 0

    # Relax edges |V|-1 times
    for _ in range(len(nodes) - 1):
        updated = False
        iterations += 1
        
        for u, v in G.edges():
            w = weight_fn(G, u, v)
            
            # Check both directions (undirected)
            for a, b in [(u, v), (v, u)]:
                if dist[a] + w < dist[b]:
                    # Check hop count limit
                    depth = 0
                    cur = a
                    while prev[cur] is not None and depth < max_hops:
                        cur = prev[cur]
                        depth += 1
                    
                    if depth < max_hops:
                        dist[b] = dist[a] + w
                        prev[b] = a
                        updated = True
        
        if not updated:
            break

    return dist, prev, iterations`,

  convergence: `"""
Convergence Time Simulation
Models actual protocol behavior during failure recovery
"""
import random
import math

def simulate_convergence(G, n_trials=50):
    """
    Simulate protocol convergence after link failures
    Returns timing data for all protocols and severity levels
    """
    results = {}
    protocols = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF']
    severities = ['single', 'cascade', 'partition']
    
    # Protocol timing parameters (realistic values)
    params = {
        'RIP': {'hello': 30, 'dead': 180, 'update_delay': 0.5},
        'OSPF': {'hello': 10, 'dead': 40, 'spf_delay': 0.1, 'lsa_delay': 0.05},
        'QAA-OSPF': {'hello': 10, 'dead': 40, 'spf_delay': 0.15, 'backup': 0.5},
        'EQA-OSPF': {'bfd': 0.05, 'bfd_mult': 3, 'spf_delay': 0.15, 'backup': 0.05},
    }
    
    for proto in protocols:
        for sev in severities:
            times = []
            severity_mult = {'single': 1.0, 'cascade': 1.6, 'partition': 2.4}[sev]
            diameter = math.ceil(math.sqrt(G.number_of_nodes()))
            
            for _ in range(n_trials):
                if proto == 'RIP':
                    # Detection via missed hellos + propagation
                    detection = params['RIP']['hello'] * random.uniform(0.5, 1.0)
                    propagation = diameter * params['RIP']['update_delay']
                    conv_time = detection + propagation
                    
                elif proto == 'OSPF':
                    # Hello timeout + LSA flood + SPF
                    detection = params['OSPF']['dead'] * random.uniform(0.25, 0.5)
                    flooding = diameter * params['OSPF']['lsa_delay']
                    spf = params['OSPF']['spf_delay'] * math.log2(G.number_of_nodes())
                    conv_time = detection + flooding + spf
                    
                elif proto == 'QAA-OSPF':
                    # Similar but with backup route activation
                    detection = params['QAA-OSPF']['dead'] * random.uniform(0.15, 0.3)
                    backup = params['QAA-OSPF']['backup']
                    conv_time = detection + backup
                    
                elif proto == 'EQA-OSPF':
                    # BFD detection + instant backup
                    bfd_detect = params['EQA-OSPF']['bfd'] * params['EQA-OSPF']['bfd_mult']
                    backup = params['EQA-OSPF']['backup']
                    conv_time = bfd_detect + backup
                
                conv_time *= severity_mult * random.uniform(0.9, 1.1)
                times.append(max(0.05, conv_time))
            
            results[(proto, sev)] = {
                'times': times,
                'mean': sum(times) / len(times),
                'std': (sum((t - sum(times)/len(times))**2 for t in times) / len(times)) ** 0.5
            }
    
    return results`,

  pathQuality: `"""
Path Quality Analysis
Measures actual latency and loss on selected paths
"""

def analyze_path_quality(G, protocol, weight_fn, n_flows=150):
    """
    Compute paths and measure their quality metrics
    """
    latencies = []
    losses = []
    nodes = list(G.nodes())
    
    for _ in range(n_flows):
        src = random.choice(nodes)
        dst = random.choice(nodes)
        while dst == src:
            dst = random.choice(nodes)
        
        # Find shortest path using protocol's metric
        try:
            path = nx.shortest_path(G, src, dst, 
                                    weight=lambda u, v, _: weight_fn(G, u, v))
        except nx.NetworkXNoPath:
            continue
        
        # Calculate actual path metrics
        path_latency = 0
        path_success_prob = 1.0
        
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            path_latency += G[u][v]['delay']
            path_success_prob *= (1 - G[u][v]['loss'])
        
        latencies.append(path_latency)
        losses.append((1 - path_success_prob) * 100)
    
    return {
        'mean_latency': sum(latencies) / len(latencies),
        'mean_loss': sum(losses) / len(losses),
        'std_latency': (sum((l - sum(latencies)/len(latencies))**2 
                           for l in latencies) / len(latencies)) ** 0.5,
    }`,

  fullSimulation: `"""
EQA-OSPF Full Simulation Script
EN2150 Communication Network Engineering - University of Moratuwa

Run with: python eqa_ospf_simulation.py
"""
import networkx as nx
import random
import math
import heapq
import time
import matplotlib.pyplot as plt
import numpy as np

random.seed(42)
np.random.seed(42)

# ============================================================
# NETWORK TOPOLOGY
# ============================================================

def build_topology(n_nodes=12, seed=42):
    random.seed(seed)
    G = nx.Graph()
    G.add_nodes_from(range(n_nodes))
    
    # Spanning tree for connectivity
    nodes = list(range(n_nodes))
    random.shuffle(nodes)
    for i in range(1, len(nodes)):
        G.add_edge(nodes[i-1], nodes[i], **rand_link())
    
    # Extra edges
    extra = int(n_nodes * 0.6)
    while extra > 0:
        u, v = random.randint(0, n_nodes-1), random.randint(0, n_nodes-1)
        if u != v and not G.has_edge(u, v):
            G.add_edge(u, v, **rand_link())
            extra -= 1
    
    return G

def rand_link():
    return {
        'bandwidth': random.choice([10, 100, 1000]),
        'delay': random.uniform(1, 50),
        'loss': random.uniform(0, 0.08),
        'utilization': random.uniform(0.05, 0.85)
    }

# ============================================================
# METRIC FUNCTIONS
# ============================================================

def rip_cost(G, u, v):
    return 1

def ospf_cost(G, u, v):
    return max(1, int(100000 / G[u][v]['bandwidth']))

def qaa_cost(G, u, v, a=0.40, b=0.35, g=0.25):
    c_bw = max(1, int(100000 / G[u][v]['bandwidth']))
    c_delay = G[u][v]['delay'] * 2
    c_load = G[u][v]['utilization'] * 100
    return a * c_bw + b * c_delay + g * c_load

def eqa_cost(G, u, v, a=0.35, b=0.30, g=0.20, d=0.15):
    c_bw = max(1, int(100000 / G[u][v]['bandwidth']))
    c_delay = G[u][v]['delay'] * 2
    c_load = G[u][v]['utilization'] * 100
    c_loss = G[u][v]['loss'] * 1000
    return a * c_bw + b * c_delay + g * c_load + d * c_loss

# ============================================================
# ROUTING ALGORITHMS
# ============================================================

def dijkstra(G, source, cost_fn):
    dist = {n: float('inf') for n in G.nodes()}
    prev = {n: None for n in G.nodes()}
    dist[source] = 0
    visited = set()
    queue = [(0, source)]
    
    while queue:
        d, u = heapq.heappop(queue)
        if u in visited:
            continue
        visited.add(u)
        
        for v in G.neighbors(u):
            w = cost_fn(G, u, v)
            if d + w < dist[v]:
                dist[v] = d + w
                prev[v] = u
                heapq.heappush(queue, (dist[v], v))
    
    return dist, prev

# ============================================================
# MAIN SIMULATION
# ============================================================

if __name__ == '__main__':
    print("EQA-OSPF Simulation")
    print("=" * 50)
    
    G = build_topology(12)
    print(f"Network: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    # Compare path selection
    src, dst = 0, 6
    protocols = {
        'RIP': rip_cost,
        'OSPF': ospf_cost,
        'QAA-OSPF': qaa_cost,
        'EQA-OSPF': eqa_cost
    }
    
    print(f"\\nPath from {src} to {dst}:")
    for name, cost_fn in protocols.items():
        dist, prev = dijkstra(G, src, cost_fn)
        path = []
        cur = dst
        while cur is not None:
            path.append(cur)
            cur = prev[cur]
        path.reverse()
        print(f"  {name}: {' -> '.join(map(str, path))} (cost: {dist[dst]:.2f})")
    
    print("\\nSimulation complete!")`
};
