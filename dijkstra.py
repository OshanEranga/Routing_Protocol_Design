"""
Dijkstra's Algorithm — used by OSPF, QAA-OSPF, and EQA-OSPF.
Computes shortest paths from a source to all destinations.
"""
import heapq
import math

def dijkstra_all(G, source, cost_fn):
    """Run Dijkstra from source using cost_fn.
    Returns {dest: (cost, path)} for all reachable destinations.
    """
    dist = {n: math.inf for n in G.nodes()}
    prev = {n: None     for n in G.nodes()}
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

    # Reconstruct paths
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
