"""
Bellman-Ford Algorithm — used by RIP.
Implements the distance-vector approach with 15-hop limit.
"""
import math

def bellman_ford_all(G, source, max_hops=15):
    """Bellman-Ford with RIP's 15-hop limit.
    Returns {dest: (cost, path)}.
    """
    dist = {n: math.inf for n in G.nodes()}
    prev = {n: None     for n in G.nodes()}
    hops = {n: math.inf for n in G.nodes()}
    dist[source] = 0
    hops[source] = 0

    for iteration in range(len(G.nodes()) - 1):
        updated = False
        for u, v in G.edges():
            for a, b in [(u, v), (v, u)]:
                new_cost = dist[a] + 1
                new_hops = hops[a] + 1
                if new_cost < dist[b] and new_hops <= max_hops:
                    dist[b] = new_cost
                    prev[b] = a
                    hops[b] = new_hops
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
            path, cur = [], dest
            seen = set()
            while cur is not None and cur not in seen:
                path.append(cur)
                seen.add(cur)
                cur = prev[cur]
            result[dest] = (dist[dest], list(reversed(path)))
    return result
