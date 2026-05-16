"""
Routing Metric Functions — defines how each protocol evaluates link cost.

Key insight: all QoS components are NORMALIZED to 0-100 so that the
weights actually affect path selection. Without normalization, bandwidth
cost (up to 10,000) drowns out delay/load/loss (up to 100).
"""
import math

def rip_cost(G, u, v):
    """RIP: hop count — always 1."""
    return 1

def ospf_cost(G, u, v):
    """OSPF: inverse bandwidth — 100,000 / BW(Mbps)."""
    return max(1, int(100000 / G[u][v]['bandwidth']))

def qaa_ospf_cost(G, u, v):
    """QAA-OSPF: 3-component normalized composite.
    M = 0.40·C_bw + 0.35·C_delay + 0.25·C_load
    """
    d = G[u][v]
    c_bw    = max(0, 100 - (math.log10(d['bandwidth']) - 1) * 50)  # 0-100
    c_delay = (d['delay'] / 50) * 100                               # 0-100
    c_load  = d['utilization'] * 100                                 # 0-100
    return 0.40 * c_bw + 0.35 * c_delay + 0.25 * c_load

def eqa_ospf_cost(G, u, v):
    """EQA-OSPF: 4-component normalized composite (adds loss).
    M = 0.35·C_bw + 0.30·C_delay + 0.20·C_load + 0.15·C_loss
    """
    d = G[u][v]
    c_bw    = max(0, 100 - (math.log10(d['bandwidth']) - 1) * 50)
    c_delay = (d['delay'] / 50) * 100
    c_load  = d['utilization'] * 100
    c_loss  = (d['loss'] / 0.08) * 100                              # 0-100
    return 0.35 * c_bw + 0.30 * c_delay + 0.20 * c_load + 0.15 * c_loss
