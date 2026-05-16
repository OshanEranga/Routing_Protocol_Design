"""
Convergence Simulation — models failure detection timing for each protocol.

Protocol timers (scaled 10x for simulation speed):
  RIP:      Hello 3s,  Dead 9s  (real: 30s / 180s)
  OSPF:     Hello 1s,  Dead 4s  (real: 10s / 40s)
  QAA-OSPF: same as OSPF + backup route activation
  EQA-OSPF: BFD 50ms × 3 = 150ms detection + instant backup
"""
import random
import numpy as np

def simulate_convergence(G, n_trials=10):
    PARAMS = {
        'RIP':      {'dead': 9000, 'detect': 'hello'},
        'OSPF':     {'dead': 4000, 'detect': 'hello', 'spf': 50},
        'QAA-OSPF': {'dead': 4000, 'detect': 'hello', 'spf': 50},
        'EQA-OSPF': {'dead': 4000, 'detect': 'bfd',
                     'bfd_interval': 50, 'bfd_mult': 3, 'spf': 50},
    }
    edges = list(G.edges())
    results = {}

    for proto, params in PARAMS.items():
        times = []
        for _ in range(n_trials):
            # Detection time
            if params['detect'] == 'bfd':
                detect = params['bfd_interval'] * params['bfd_mult']  # 150ms
            else:
                detect = random.uniform(params['dead'] * 0.5, params['dead'])

            # Propagation (SPF + flood)
            if proto == 'RIP':
                prop = random.uniform(100, 500)
            else:
                prop = params.get('spf', 50) + random.uniform(10, 50)

            # Total convergence time
            if proto == 'EQA-OSPF':
                conv = detect + 5    # BFD + instant backup
            elif proto == 'QAA-OSPF':
                conv = detect + prop * 0.5  # backup helps
            else:
                conv = detect + prop

            times.append(conv)

        results[proto] = {
            'mean': np.mean(times), 'std': np.std(times),
            'min': np.min(times), 'max': np.max(times),
        }
    return results
