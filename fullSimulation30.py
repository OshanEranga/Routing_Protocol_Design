#!/usr/bin/env python3
"""
RIP 15-Hop Breakdown — 30-Node Sparse Topology
EN2150 Communication Network Engineering — University of Moratuwa

Demonstrates RIP's practical failure at 30 nodes:
  - Sparse, chain-heavy topology forces long paths (> 15 hops)
  - RIP silently drops unreachable destinations (infinity cost)
  - QoS metrics (QAA-OSPF, EQA-OSPF) still route all flows correctly

Run:
    python rip_breakdown_30nodes.py

Outputs:
    figures_rip30/fig_rip_delivery.png    — delivery rate per protocol
    figures_rip30/fig_rip_hops.png        — hop distribution (RIP vs EQA-OSPF)
    figures_rip30/fig_rip_unreachable.png — unreachable destinations per source
    figures_rip30/fig_rip_quality.png     — latency & loss for delivered flows
    figures_rip30/fig_rip_topology.png    — 30-node topology diagram
"""

import networkx as nx
import numpy as np
import heapq
import math
import random
import os
import copy
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

random.seed(7)
np.random.seed(7)

os.makedirs('figures_rip30', exist_ok=True)

COLORS = {
    'RIP':      '#E74C3C',
    'OSPF':     '#3498DB',
    'QAA-OSPF': '#F39C12',
    'EQA-OSPF': '#2ECC71',
}

N_NODES  = 30
N_FLOWS  = 400   # large sample to expose partial reachability clearly

# ════════════════════════════════════════════════════════════
# TOPOLOGY — sparse chain-heavy, low redundancy
# Strategy: build a long sequential chain (backbone), then add
# only a few random cross-links.  This forces Bellman-Ford to
# route many pairs through long paths that breach the 15-hop limit.
# Extra-edge ratio = 0.25 (vs 0.80 in the main simulation).
# ════════════════════════════════════════════════════════════

def build_sparse_topology(n_nodes=30, seed=7):
    """Build a chain-dominant topology whose diameter exceeds 15 hops.

    Strategy:
      - Pure sequential chain gives diameter = n_nodes - 1 = 29 hops.
      - We add only 4 short-range cross-links (gap ≤ 3) for a little
        redundancy, keeping the longest paths well above 15 hops.
      - Cross-links connect adjacent regions so the graph stays connected
        but diameter stays around 18-22 hops.
    """
    random.seed(seed)
    G = nx.Graph()
    G.add_nodes_from(range(n_nodes))

    # Full sequential backbone chain — diameter starts at 29
    for i in range(n_nodes - 1):
        G.add_edge(i, i + 1, **_rand_link())

    # Add exactly 4 short-range cross-links (gap 2 or 3 only)
    # These add redundancy without dramatically shortcutting the chain
    cross_links = [(2, 5), (8, 11), (15, 18), (22, 25)]
    for u, v in cross_links:
        if not G.has_edge(u, v):
            G.add_edge(u, v, **_rand_link())

    return G


def _rand_link():
    bw = random.choice([10, 100, 1000])
    if bw == 1000:
        return dict(bandwidth=bw, delay=random.uniform(1, 10),
                    loss=random.uniform(0, 0.02),  utilization=random.uniform(0.50, 0.95))
    elif bw == 100:
        return dict(bandwidth=bw, delay=random.uniform(5, 30),
                    loss=random.uniform(0.01, 0.05), utilization=random.uniform(0.20, 0.70))
    else:
        return dict(bandwidth=bw, delay=random.uniform(15, 50),
                    loss=random.uniform(0.03, 0.08), utilization=random.uniform(0.05, 0.40))


# ════════════════════════════════════════════════════════════
# METRICS
# ════════════════════════════════════════════════════════════

def rip_cost(G, u, v):      return 1
def ospf_cost(G, u, v):     return max(1, int(100000 / G[u][v]['bandwidth']))
def qaa_ospf_cost(G, u, v):
    d = G[u][v]
    c_bw    = max(0, 100 - (math.log10(d['bandwidth']) - 1) * 50)
    c_delay = (d['delay'] / 50) * 100
    c_load  = d['utilization'] * 100
    return 0.40 * c_bw + 0.35 * c_delay + 0.25 * c_load

def eqa_ospf_cost(G, u, v):
    d = G[u][v]
    c_bw    = max(0, 100 - (math.log10(d['bandwidth']) - 1) * 50)
    c_delay = (d['delay'] / 50) * 100
    c_load  = d['utilization'] * 100
    c_loss  = (d['loss'] / 0.08) * 100
    return 0.35 * c_bw + 0.30 * c_delay + 0.20 * c_load + 0.15 * c_loss


# ════════════════════════════════════════════════════════════
# ROUTING ALGORITHMS
# ════════════════════════════════════════════════════════════

def dijkstra_all(G, source, cost_fn):
    dist = {n: math.inf for n in G.nodes()}
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
    result = {}
    for dest in G.nodes():
        if dest == source:
            continue
        if math.isinf(dist[dest]):
            result[dest] = (math.inf, [])
        else:
            path, cur, seen = [], dest, set()
            while cur is not None and cur not in seen:
                path.append(cur); seen.add(cur); cur = prev[cur]
            result[dest] = (dist[dest], list(reversed(path)))
    return result


def bellman_ford_all(G, source, max_hops=15):
    """RIP: Bellman-Ford with hard 15-hop limit.
    Destinations requiring > 15 hops are returned as unreachable (infinity).
    """
    dist = {n: math.inf for n in G.nodes()}
    prev = {n: None for n in G.nodes()}
    hops = {n: math.inf for n in G.nodes()}
    dist[source] = 0
    hops[source] = 0
    for _ in range(len(G.nodes()) - 1):
        updated = False
        for u, v in G.edges():
            for a, b in [(u, v), (v, u)]:
                if dist[a] + 1 < dist[b] and hops[a] + 1 <= max_hops:
                    dist[b] = dist[a] + 1
                    prev[b] = a
                    hops[b] = hops[a] + 1
                    updated = True
        if not updated:
            break
    result = {}
    for dest in G.nodes():
        if dest == source:
            continue
        if math.isinf(dist[dest]):
            result[dest] = (math.inf, [])
        else:
            path, cur, seen = [], dest, set()
            while cur is not None and cur not in seen:
                path.append(cur); seen.add(cur); cur = prev[cur]
            result[dest] = (dist[dest], list(reversed(path)))
    return result


# ════════════════════════════════════════════════════════════
# MEASUREMENTS
# ════════════════════════════════════════════════════════════

def measure_full(G, cost_fn, n_flows=400, use_bf=False):
    """Return per-flow detail and aggregate stats."""
    nodes = list(G.nodes())
    latencies, losses, hop_counts = [], [], []
    dropped = 0

    for i in range(n_flows):
        src = (i * 7  + 3) % len(nodes)
        dst = (i * 11 + 5) % len(nodes)
        if dst == src:
            dst = (dst + 1) % len(nodes)

        table = bellman_ford_all(G, src) if use_bf else dijkstra_all(G, src, cost_fn)

        if dst in table and not math.isinf(table[dst][0]):
            path = table[dst][1]
            if len(path) < 2:
                dropped += 1
                continue
            lat  = sum(G[path[j]][path[j+1]]['delay'] for j in range(len(path)-1))
            prob = 1.0
            for j in range(len(path)-1):
                prob *= (1 - G[path[j]][path[j+1]]['loss'])
            latencies.append(lat)
            losses.append((1 - prob) * 100)
            hop_counts.append(len(path) - 1)
        else:
            dropped += 1

    delivered = len(latencies)
    return {
        'avg_latency':   np.mean(latencies)   if latencies   else 0,
        'avg_loss':      np.mean(losses)       if losses      else 0,
        'avg_hops':      np.mean(hop_counts)   if hop_counts  else 0,
        'p95_latency':   np.percentile(latencies, 95) if latencies else 0,
        'delivery_rate': delivered / n_flows * 100,
        'delivered':     delivered,
        'dropped':       dropped,
        'attempted':     n_flows,
        'hop_counts':    hop_counts,
    }


def per_source_unreachable(G, use_bf=False, cost_fn=None):
    """For every node as source, count how many destinations are unreachable."""
    unreachable_counts = []
    nodes = list(G.nodes())
    for src in nodes:
        if use_bf:
            table = bellman_ford_all(G, src)
        else:
            table = dijkstra_all(G, src, cost_fn)
        unreachable = sum(1 for d, (c, _) in table.items() if math.isinf(c))
        unreachable_counts.append(unreachable)
    return unreachable_counts


# ════════════════════════════════════════════════════════════
# PLOTTING
# ════════════════════════════════════════════════════════════

def plot_delivery(results):
    """Bar chart: delivery rate per protocol."""
    fig, ax = plt.subplots(figsize=(9, 5))
    protos = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF']
    rates  = [results[p]['delivery_rate'] for p in protos]
    drops  = [results[p]['dropped']       for p in protos]
    colors = [COLORS[p] for p in protos]

    bars = ax.bar(protos, rates, color=colors, alpha=0.85, edgecolor='black')
    ax.axhline(100, color='grey', linestyle='--', linewidth=1, alpha=0.5)

    for bar, rate, drop in zip(bars, rates, drops):
        label = f'{rate:.1f}%'
        if drop > 0:
            label += f'\n({drop} flows dropped)'
        ax.text(bar.get_x() + bar.get_width() / 2,
                min(rate + 1.5, 97), label,
                ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax.set_ylim(0, 110)
    ax.set_ylabel('Flow Delivery Rate (%)', fontsize=12)
    ax.set_title(f'Flow Delivery Rate — {N_NODES}-Node Sparse Topology\n'
                 f'RIP 15-hop limit silently drops unreachable destinations',
                 fontsize=12, fontweight='bold')
    ax.grid(axis='y', alpha=0.3)
    fig.tight_layout()
    fig.savefig('figures_rip30/fig_rip_delivery.png', dpi=150)
    plt.close()
    print("  Saved: figures_rip30/fig_rip_delivery.png")


def plot_hop_distribution(results):
    """Histogram: hop count distribution for RIP vs EQA-OSPF."""
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), sharey=False)

    rip_hops = results['RIP']['hop_counts']
    eqa_hops = results['EQA-OSPF']['hop_counts']

    max_hop = max(max(rip_hops) if rip_hops else 15,
                  max(eqa_hops) if eqa_hops else 15)
    bins = range(1, max_hop + 2)

    axes[0].hist(rip_hops, bins=bins, color=COLORS['RIP'],
                 alpha=0.85, edgecolor='black')
    axes[0].axvline(15, color='black', linestyle='--', linewidth=2,
                    label='15-hop limit')
    axes[0].set_title(f'RIP — Delivered Flows Only\n'
                      f'({results["RIP"]["delivered"]}/{N_FLOWS} delivered; '
                      f'{results["RIP"]["dropped"]} dropped beyond limit)',
                      fontweight='bold')
    axes[0].set_xlabel('Hop Count'); axes[0].set_ylabel('Number of Flows')
    axes[0].legend(); axes[0].grid(alpha=0.3)

    axes[1].hist(eqa_hops, bins=bins, color=COLORS['EQA-OSPF'],
                 alpha=0.85, edgecolor='black')
    axes[1].axvline(15, color='black', linestyle='--', linewidth=2,
                    label='RIP limit (reference)', alpha=0.4)
    axes[1].set_title(f'EQA-OSPF — All Flows Delivered\n'
                      f'({results["EQA-OSPF"]["delivered"]}/{N_FLOWS} delivered)',
                      fontweight='bold')
    axes[1].set_xlabel('Hop Count'); axes[1].set_ylabel('Number of Flows')
    axes[1].legend(); axes[1].grid(alpha=0.3)

    fig.suptitle('Hop Count Distribution: RIP vs EQA-OSPF\n'
                 'Flows requiring > 15 hops are invisible to RIP',
                 fontsize=13, fontweight='bold')
    fig.tight_layout()
    fig.savefig('figures_rip30/fig_rip_hops.png', dpi=150)
    plt.close()
    print("  Saved: figures_rip30/fig_rip_hops.png")


def plot_unreachable_per_source(G):
    """Per-source unreachable destination count: RIP vs EQA-OSPF."""
    rip_unreach = per_source_unreachable(G, use_bf=True)
    eqa_unreach = per_source_unreachable(G, use_bf=False, cost_fn=eqa_ospf_cost)

    fig, ax = plt.subplots(figsize=(12, 5))
    x = list(range(N_NODES))
    width = 0.4
    ax.bar([i - width/2 for i in x], rip_unreach, width=width,
           color=COLORS['RIP'], alpha=0.85, edgecolor='black', label='RIP')
    ax.bar([i + width/2 for i in x], eqa_unreach, width=width,
           color=COLORS['EQA-OSPF'], alpha=0.85, edgecolor='black', label='EQA-OSPF')

    ax.set_xlabel('Source Node', fontsize=11)
    ax.set_ylabel('Unreachable Destinations', fontsize=11)
    ax.set_title(f'Unreachable Destinations Per Source — {N_NODES}-Node Topology\n'
                 'RIP cannot reach nodes beyond 15 hops; EQA-OSPF reaches all',
                 fontsize=12, fontweight='bold')
    ax.legend(fontsize=11)
    ax.grid(axis='y', alpha=0.3)
    ax.set_xticks(x)
    fig.tight_layout()
    fig.savefig('figures_rip30/fig_rip_unreachable.png', dpi=150)
    plt.close()
    print("  Saved: figures_rip30/fig_rip_unreachable.png")


def plot_quality(results):
    """Side-by-side latency and loss for delivered flows only."""
    protos = ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF']
    colors = [COLORS[p] for p in protos]
    lats   = [results[p]['avg_latency'] for p in protos]
    losses = [results[p]['avg_loss']    for p in protos]
    rates  = [results[p]['delivery_rate'] for p in protos]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    b0 = axes[0].bar(protos, lats, color=colors, alpha=0.85, edgecolor='black')
    axes[0].set_ylabel('Mean Latency (ms)', fontsize=11)
    axes[0].set_title('Path Latency — Delivered Flows Only\n'
                      '(RIP result is biased: long-path flows are missing)',
                      fontweight='bold')
    axes[0].grid(axis='y', alpha=0.3)
    for bar, v, r in zip(b0, lats, rates):
        axes[0].text(bar.get_x() + bar.get_width()/2,
                     v + 0.5, f'{v:.1f}ms\n({r:.0f}% delivered)',
                     ha='center', fontsize=9)

    b1 = axes[1].bar(protos, losses, color=colors, alpha=0.85, edgecolor='black')
    axes[1].set_ylabel('Mean End-to-End Loss (%)', fontsize=11)
    axes[1].set_title('Path Loss — Delivered Flows Only\n'
                      '(RIP result is biased: long-path flows are missing)',
                      fontweight='bold')
    axes[1].grid(axis='y', alpha=0.3)
    for bar, v, r in zip(b1, losses, rates):
        axes[1].text(bar.get_x() + bar.get_width()/2,
                     v + 0.05, f'{v:.2f}%\n({r:.0f}% delivered)',
                     ha='center', fontsize=9)

    fig.tight_layout()
    fig.savefig('figures_rip30/fig_rip_quality.png', dpi=150)
    plt.close()
    print("  Saved: figures_rip30/fig_rip_quality.png")


def plot_topology_30(G):
    fig, ax = plt.subplots(figsize=(14, 9))
    # Shell layout shows the chain structure clearly
    pos = nx.kamada_kawai_layout(G)
    bw_colors = {10: '#E74C3C', 100: '#3498DB', 1000: '#2ECC71'}
    edge_colors = [bw_colors[G[u][v]['bandwidth']] for u, v in G.edges()]
    edge_widths = [0.8 + 3 * G[u][v]['bandwidth'] / 1000 for u, v in G.edges()]

    nx.draw_networkx_nodes(G, pos, node_color='#2C3E50', node_size=400, ax=ax)
    nx.draw_networkx_labels(G, pos, font_color='white', font_size=8,
                            font_weight='bold', ax=ax)
    nx.draw_networkx_edges(G, pos, edge_color=edge_colors,
                           width=edge_widths, alpha=0.75, ax=ax)

    import matplotlib.patches as mpatches
    patches = [mpatches.Patch(color='#2ECC71', label='1 Gbps'),
               mpatches.Patch(color='#3498DB', label='100 Mbps'),
               mpatches.Patch(color='#E74C3C', label='10 Mbps')]
    ax.legend(handles=patches, fontsize=11)

    # Annotate graph diameter
    diameter = nx.diameter(G)
    ax.set_title(
        f'30-Node Sparse Chain Topology  '
        f'({G.number_of_nodes()} nodes, {G.number_of_edges()} edges)\n'
        f'Graph diameter = {diameter} hops  —  '
        f'RIP 15-hop limit cuts off node pairs separated by > 15 hops',
        fontsize=12, fontweight='bold')
    ax.axis('off')
    fig.tight_layout()
    fig.savefig('figures_rip30/fig_rip_topology.png', dpi=150)
    plt.close()
    print("  Saved: figures_rip30/fig_rip_topology.png")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

def main():
    SEP = "=" * 65
    print(SEP)
    print("  RIP 15-HOP BREAKDOWN — 30-NODE SPARSE TOPOLOGY")
    print("  EN2150 Communication Network Engineering")
    print(SEP)

    # Build topology
    print(f"\n[1] Building {N_NODES}-node sparse chain topology...")
    G = build_sparse_topology(N_NODES, seed=7)
    diameter = nx.diameter(G)
    bw_counts = {10: 0, 100: 0, 1000: 0}
    for u, v, d in G.edges(data=True):
        bw_counts[d['bandwidth']] += 1
    print(f"  Nodes: {G.number_of_nodes()}   Edges: {G.number_of_edges()}")
    print(f"  Link mix: {bw_counts[1000]}× 1 Gbps, "
          f"{bw_counts[100]}× 100 Mbps, {bw_counts[10]}× 10 Mbps")
    print(f"  Graph diameter: {diameter} hops")
    print(f"  *** Diameter = {diameter} hops > RIP's 15-hop limit ***"
          if diameter > 15 else
          f"  Note: diameter = {diameter} hops. Chain + cross-links tested below.")

    # Measure all protocols
    print(f"\n[2] Running {N_FLOWS} flows on all protocols...")
    protocols = {
        'RIP':      (rip_cost,      True),
        'OSPF':     (ospf_cost,     False),
        'QAA-OSPF': (qaa_ospf_cost, False),
        'EQA-OSPF': (eqa_ospf_cost, False),
    }
    results = {}
    for name, (fn, bf) in protocols.items():
        results[name] = measure_full(G, fn, n_flows=N_FLOWS, use_bf=bf)

    # ── Delivery rate table ──────────────────────────────────
    print(f"\n  {'Protocol':<12} {'Delivered':>10} {'Dropped':>9} "
          f"{'Delivery%':>10} {'Avg Hops':>10}")
    print("  " + "-" * 56)
    for p in ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF']:
        r = results[p]
        flag = ' ← HOP LIMIT' if p == 'RIP' and r['dropped'] > 0 else ''
        print(f"  {p:<12} {r['delivered']:>10} {r['dropped']:>9} "
              f"{r['delivery_rate']:>9.1f}% {r['avg_hops']:>9.2f}{flag}")

    # ── Quality table (delivered flows only) ────────────────
    print(f"\n  Path quality (delivered flows only):")
    print(f"  {'Protocol':<12} {'Latency':>10} {'P95 Lat':>10} {'Loss':>9}")
    print("  " + "-" * 45)
    for p in ['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF']:
        r = results[p]
        note = ' ← biased (short paths only)' if p == 'RIP' and r['dropped'] > 0 else ''
        print(f"  {p:<12} {r['avg_latency']:>8.1f}ms {r['p95_latency']:>8.1f}ms "
              f"{r['avg_loss']:>8.2f}%{note}")

    # ── Per-source unreachable ───────────────────────────────
    print(f"\n[3] Per-source unreachable destination count...")
    rip_unreach = per_source_unreachable(G, use_bf=True)
    eqa_unreach = per_source_unreachable(G, use_bf=False, cost_fn=eqa_ospf_cost)
    total_rip_unreach = sum(rip_unreach)
    total_eqa_unreach = sum(eqa_unreach)
    affected_sources  = sum(1 for x in rip_unreach if x > 0)
    print(f"  RIP: {total_rip_unreach} unreachable (src, dst) pairs across "
          f"{affected_sources}/{N_NODES} sources")
    print(f"  EQA-OSPF: {total_eqa_unreach} unreachable pairs")
    print(f"  Worst RIP source: node {rip_unreach.index(max(rip_unreach))} "
          f"→ {max(rip_unreach)} destinations unreachable")

    # ── Summary ─────────────────────────────────────────────
    print(f"\n[4] Summary:")
    rip_drop_pct = results['RIP']['dropped'] / N_FLOWS * 100
    print(f"  Graph diameter:       {diameter} hops")
    print(f"  RIP max hops:         15")
    print(f"  RIP flows dropped:    {results['RIP']['dropped']}/{N_FLOWS} "
          f"({rip_drop_pct:.1f}%)")
    print(f"  EQA-OSPF dropped:     {results['EQA-OSPF']['dropped']}/{N_FLOWS} (0.0%)")
    if results['RIP']['avg_latency'] > 0 and results['EQA-OSPF']['avg_latency'] > 0:
        print(f"  Note: RIP's measured latency appears lower because it only "
              f"delivered the shorter flows.")

    # ── Figures ─────────────────────────────────────────────
    print(f"\n[5] Generating figures...")
    plot_topology_30(G)
    plot_delivery(results)
    plot_hop_distribution(results)
    plot_unreachable_per_source(G)
    plot_quality(results)

    print()
    print(SEP)
    print("  DONE — figures saved to figures_rip30/")
    print(SEP)


if __name__ == '__main__':
    main()
