"""
Path Quality Analysis — measures actual latency and loss on protocol-selected paths.
Uses SAME source-destination pairs for all protocols for fair comparison.
"""
import math
import numpy as np

def measure_path_quality(G, cost_fn, n_flows=100, use_bf=False):
    """Measure latency & loss on paths chosen by a given protocol metric."""
    nodes = list(G.nodes())
    latencies, losses, hop_counts = [], [], []

    for i in range(n_flows):
        src = (i * 7 + 3) % len(nodes)
        dst = (i * 11 + 5) % len(nodes)
        if dst == src:
            dst = (dst + 1) % len(nodes)

        if use_bf:
            table = bellman_ford_all(G, src)
        else:
            table = dijkstra_all(G, src, cost_fn)

        if dst in table and not math.isinf(table[dst][0]):
            path = table[dst][1]
            if len(path) < 2:
                continue

            # Sum actual link delays and losses along chosen path
            lat = sum(G[path[j]][path[j+1]]['delay']
                      for j in range(len(path)-1))
            prob = 1
            for j in range(len(path)-1):
                prob *= (1 - G[path[j]][path[j+1]]['loss'])

            latencies.append(lat)
            losses.append((1 - prob) * 100)
            hop_counts.append(len(path) - 1)

    return {
        'avg_latency': np.mean(latencies) if latencies else 0,
        'avg_loss':    np.mean(losses) if losses else 0,
        'avg_hops':    np.mean(hop_counts) if hop_counts else 0,
        'delivered':   len(latencies),
        'attempted':   n_flows,
    }
