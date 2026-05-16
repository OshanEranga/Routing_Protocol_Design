# EQA-OSPF Simulation Suite
EN2150 Communication Network Engineering — University of Moratuwa

## Install

```
pip install networkx numpy matplotlib
```

## Files

| File | Description |
|---|---|
| `fullSimulation.py` | Main simulation — 20-node topology, all 4 protocols |
| `rip_breakdown_30nodes.py` | RIP 15-hop limit failure on 30-node chain topology |
| `topology.py` | Network graph builder (module) |
| `metrics.py` | Link-cost functions per protocol (module) |
| `dijkstra.py` | Dijkstra's algorithm for OSPF/QAA-OSPF/EQA-OSPF (module) |
| `bellmanFord.py` | Bellman-Ford with 15-hop limit for RIP (module) |
| `convergence.py` | Convergence time simulation (module) |
| `pathQuality.py` | Path latency and loss measurement (module) |

The 6 module files are not meant to be run directly.

## Run

```
python fullSimulation.py          # → figures/
python rip_breakdown_30nodes.py   # → figures_rip30/
```

## Output Figures

**`figures/`** (from main simulation)

| File | Shows |
|---|---|
| `fig01_convergence.png` | Convergence time per protocol after link failure |
| `fig02_path_quality.png` | Mean latency, loss, and hop count per protocol |
| `fig03_congestion.png` | Path loss vs network load (10%–90%) |
| `fig04_multi_failure.png` | Reachability after k simultaneous link failures |
| `fig05_topology.png` | 20-node network graph (edge colour = bandwidth tier) |
| `fig06_scalability.png` | Computation time and path loss at 20/50/100 nodes |

**`figures_rip30/`** (from RIP breakdown)

| File | Shows |
|---|---|
| `fig_rip_topology.png` | 30-node chain topology with diameter annotated |
| `fig_rip_delivery.png` | Flow delivery rate — RIP drops flows beyond 15 hops |
| `fig_rip_hops.png` | Hop distribution: RIP (cut at 15) vs EQA-OSPF (full) |
| `fig_rip_unreachable.png` | Unreachable destinations per source node |
| `fig_rip_quality.png` | Latency and loss for delivered flows only |

## Notes

- Both scripts use fixed random seeds — results are fully reproducible.
- RIP is skipped at 50 and 100 nodes in the scalability test (15-hop limit).
- RIP's latency in `fig_rip_quality` appears low because it only delivered shorter flows — the long ones were dropped.
