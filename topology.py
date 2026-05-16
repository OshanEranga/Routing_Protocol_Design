"""
Network Topology Builder — builds a connected graph with
realistic correlated link properties using NetworkX.
"""
import networkx as nx
import random
import math

def build_topology(n_nodes=12, seed=42):
    random.seed(seed)
    G = nx.Graph()
    G.add_nodes_from(range(n_nodes))

    # Spanning tree for guaranteed connectivity
    nodes = list(range(n_nodes))
    random.shuffle(nodes)
    for i in range(1, len(nodes)):
        G.add_edge(nodes[i-1], nodes[i], **_rand_link())

    # Extra edges for path diversity / redundancy
    extra = int(n_nodes * 0.6)
    attempts = 0
    while extra > 0 and attempts < 400:
        u, v = random.randint(0, n_nodes-1), random.randint(0, n_nodes-1)
        if u != v and not G.has_edge(u, v):
            G.add_edge(u, v, **_rand_link())
            extra -= 1
        attempts += 1
    return G

def _rand_link():
    """Link properties correlated with bandwidth (realistic)."""
    bw = random.choice([10, 100, 1000])
    if bw == 1000:   # Fiber: fast, clean, but popular → congested
        delay = random.uniform(1, 10)
        loss  = random.uniform(0, 0.02)
        util  = random.uniform(0.50, 0.95)
    elif bw == 100:  # Copper/moderate
        delay = random.uniform(5, 30)
        loss  = random.uniform(0.01, 0.05)
        util  = random.uniform(0.20, 0.70)
    else:            # 10 Mbps: wireless/legacy, high delay+loss, low util
        delay = random.uniform(15, 50)
        loss  = random.uniform(0.03, 0.08)
        util  = random.uniform(0.05, 0.40)
    return dict(bandwidth=bw, delay=delay, loss=loss, utilization=util)
