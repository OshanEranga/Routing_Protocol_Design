import { useState, useMemo, useEffect } from 'react';
import { 
  Network, 
  Zap, 
  Timer, 
  BarChart3, 
  Activity,
  TrendingUp,
  Layers,
  CheckCircle2,
  XCircle,
  Code2,
  FileText,
  Play,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from 'recharts';

import {
  buildTopology,
  runFullConvergenceSimulation,
  runOverheadSimulation,
  analyzePathQuality,
  aggregateConvergenceResults,
  formatTime,
  getProtocolDescription,
  runCongestionStressTest,
  runMultiFailureTest,
  runSecurityAnalysis,
  runFullDiagnostics,
  runLargeScaleTest,
  NetworkTopology,
  Protocol,
  ConvergenceResult,
  PathQualityResult,
  CongestionResult,
  MultiFailureResult,
  SecurityResult,
  DiagnosticCheck,
  ScaleTestResult,
  Link,
  Node,
} from './simulation';

import CodeViewer, { PYTHON_CODES } from './components/CodeViewer';

// ============================================================================
// CONSTANTS
// ============================================================================

const PROTOCOL_COLORS: Record<Protocol, string> = {
  'RIP': '#EF4444',
  'OSPF': '#3B82F6',
  'QAA-OSPF': '#F59E0B',
  'EQA-OSPF': '#10B981',
};

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle, 
  color, 
  icon: Icon 
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
        </div>
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode 
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        active 
          ? 'bg-emerald-600 text-white' 
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function TopologyVisualization({ topology }: { topology: NetworkTopology }) {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden p-4">
      <svg viewBox="0 0 500 500" className="w-full h-full">
        {/* Draw links */}
        {topology.links.map((link: Link, idx: number) => {
          const source = topology.nodes[link.source];
          const target = topology.nodes[link.target];
          const color = link.bandwidth === 1000 ? '#10B981' : link.bandwidth === 100 ? '#3B82F6' : '#EF4444';
          const width = link.bandwidth === 1000 ? 3 : link.bandwidth === 100 ? 2 : 1;
          
          return (
            <g key={idx}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={link.isUp ? color : '#4B5563'}
                strokeWidth={width}
                opacity={link.isUp ? 0.7 : 0.3}
                strokeDasharray={link.isUp ? undefined : '4 4'}
              />
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 8}
                fill="#94A3B8"
                fontSize="9"
                textAnchor="middle"
              >
                {link.bandwidth}M
              </text>
            </g>
          );
        })}

        {/* Draw nodes */}
        {topology.nodes.map((node: Node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={18}
              fill="#1E293B"
              stroke="#475569"
              strokeWidth={2}
            />
            <text
              x={node.x}
              y={node.y}
              fill="#FFF"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              R{node.id}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-slate-800/90 rounded-lg p-2 text-xs">
        <div className="flex items-center gap-3 text-slate-300">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-emerald-500 rounded"></div>
            <span>1G</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-blue-500 rounded"></div>
            <span>100M</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-red-500 rounded"></div>
            <span>10M</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'results' | 'code'>('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState('');
  const [selectedCodeSection, setSelectedCodeSection] = useState<keyof typeof PYTHON_CODES>('fullSimulation');

  // Simulation state
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [convergenceResults, setConvergenceResults] = useState<ConvergenceResult[]>([]);
  const [overheadResults, setOverheadResults] = useState<{ protocol: Protocol; messages: number; timeline: number[] }[]>([]);
  const [pathQualityResults, setPathQualityResults] = useState<PathQualityResult[]>([]);
  const [congestionResults, setCongestionResults] = useState<CongestionResult[]>([]);
  const [multiFailureResults, setMultiFailureResults] = useState<MultiFailureResult[]>([]);
  const [securityResults, setSecurityResults] = useState<SecurityResult[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticCheck[]>([]);
  const [scaleResults, setScaleResults] = useState<ScaleTestResult[]>([]);

  // Initialize topology
  useEffect(() => {
    const topo = buildTopology(12, 42);
    setTopology(topo);
  }, []);

  // Helper: yield to the browser so the UI can repaint before heavy work
  const yieldToBrowser = () => new Promise<void>(r => setTimeout(r, 80));

  // Run simulation
  const handleRunSimulation = async () => {
    if (!topology) return;
    
    setIsSimulating(true);
    setActiveTab('simulation');
    
    try {
      // Dump topology
      console.log('========================================');
      console.log('EQA-OSPF SIMULATION START');
      console.log('========================================');
      console.log(`Topology: ${topology.nodes.length} nodes, ${topology.links.length} links`);
      topology.links.forEach((l: Link) => {
        console.log(`  Link ${l.source}-${l.target}: bw=${l.bandwidth}M, delay=${l.delay.toFixed(1)}ms, loss=${(l.loss*100).toFixed(1)}%, util=${(l.utilization*100).toFixed(0)}%`);
      });
      console.log('========================================');
      
      // DIAGNOSTICS FIRST — validate simulation health
      setSimulationProgress('Running diagnostics (10+ checks per protocol)...');
      await yieldToBrowser();
      const diagResults = runFullDiagnostics(topology);
      setDiagnosticResults(diagResults);
      await yieldToBrowser();
      
      // Convergence simulation
      setSimulationProgress('Running convergence tests (10 trials per protocol)...');
      await yieldToBrowser();
      const convResults = runFullConvergenceSimulation(topology, 10);
      setConvergenceResults(convResults);
      await yieldToBrowser();
      
      // Overhead simulation
      setSimulationProgress('Running overhead simulation (30 seconds)...');
      await yieldToBrowser();
      const overResults = runOverheadSimulation(topology, 30000);
      setOverheadResults(overResults);
      await yieldToBrowser();
      
      // Path quality
      setSimulationProgress('Analyzing path quality (50 flows)...');
      await yieldToBrowser();
      const pathResults = analyzePathQuality(topology, 50);
      setPathQualityResults(pathResults);
      await yieldToBrowser();

      // Congestion stress test
      setSimulationProgress('Running congestion stress test (5 load levels × 4 protocols)...');
      await yieldToBrowser();
      const congResults = runCongestionStressTest(topology);
      setCongestionResults(congResults);
      await yieldToBrowser();

      // Multi-failure resilience
      setSimulationProgress('Running multi-failure resilience test (k=1..4 × 5 trials)...');
      await yieldToBrowser();
      const mfResults = runMultiFailureTest(topology);
      setMultiFailureResults(mfResults);
      await yieldToBrowser();

      // Security analysis
      setSimulationProgress('Running security overhead analysis...');
      await yieldToBrowser();
      const secResults = runSecurityAnalysis(topology);
      setSecurityResults(secResults);
      await yieldToBrowser();
      
      // Large-scale network test — run one size at a time to avoid freezing
      const sizes = [20, 50, 100];
      const scaleRes: ScaleTestResult[] = [];
      for (const size of sizes) {
        setSimulationProgress(`Running large-scale test (${size} nodes)...`);
        await yieldToBrowser();
        const result = runLargeScaleTest([size]);
        scaleRes.push(...result);
        setScaleResults([...scaleRes]);
        await yieldToBrowser();
      }
      
      console.log('========================================');
      console.log('SIMULATION COMPLETE — SUMMARY');
      console.log('========================================');
      console.log('Path Quality:');
      pathResults.forEach((r: PathQualityResult) => {
        console.log(`  ${r.protocol}: ${r.flows.length} flows delivered, avgLat=${r.avgLatency.toFixed(1)}ms, avgLoss=${r.avgLoss.toFixed(2)}%`);
      });
      console.log('Security:');
      secResults.forEach((r: SecurityResult) => {
        console.log(`  ${r.protocol}: ${r.messagesPerMinute.toFixed(0)} msgs/min, ${r.bytesPerAuth}B auth, blocked=[${r.attacksBlocked.join(', ')}]`);
      });
      console.log('========================================');
      
      setSimulationProgress('Simulation complete!');
      await new Promise(r => setTimeout(r, 500));
      
      setActiveTab('results');
    } finally {
      setIsSimulating(false);
    }
  };

  // Aggregate results
  const aggregatedConvergence = useMemo(() => 
    aggregateConvergenceResults(convergenceResults), 
    [convergenceResults]
  );

  // Chart data
  const convergenceChartData = useMemo(() => 
    aggregatedConvergence.map((r: ReturnType<typeof aggregateConvergenceResults>[0]) => ({
      protocol: r.protocol,
      mean: r.mean,
      min: r.min,
      max: r.max,
      detection: r.detectionMean,
    })),
    [aggregatedConvergence]
  );

  const overheadChartData = useMemo(() => {
    if (overheadResults.length === 0) return [];
    const maxLen = Math.max(...overheadResults.map((r: { timeline: number[] }) => r.timeline.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { second: i + 1 };
      overheadResults.forEach((r: { protocol: Protocol; timeline: number[] }) => {
        point[r.protocol] = r.timeline[i] || 0;
      });
      return point;
    });
  }, [overheadResults]);

  const pathQualityChartData = useMemo(() => 
    pathQualityResults.map((r: PathQualityResult) => ({
      protocol: r.protocol,
      latency: r.avgLatency,
      loss: r.avgLoss,
      hops: r.avgHops,
    })),
    [pathQualityResults]
  );

  // Stats
  const eqaStats = aggregatedConvergence.find((r: { protocol: Protocol }) => r.protocol === 'EQA-OSPF');
  const ripStats = aggregatedConvergence.find((r: { protocol: Protocol }) => r.protocol === 'RIP');
  const ospfStats = aggregatedConvergence.find((r: { protocol: Protocol }) => r.protocol === 'OSPF');

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600 rounded-xl">
                <Network className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">EQA-OSPF Protocol Simulation</h1>
                <p className="text-slate-400">Discrete Event Simulation — EN2150 Communication Network Engineering</p>
              </div>
            </div>
            
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating || !topology}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Simulation
                </>
              )}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-2 mt-6 flex-wrap">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </div>
            </TabButton>
            <TabButton active={activeTab === 'simulation'} onClick={() => setActiveTab('simulation')}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Simulation
              </div>
            </TabButton>
            <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Results
              </div>
            </TabButton>
            <TabButton active={activeTab === 'code'} onClick={() => setActiveTab('code')}>
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                Python Code
              </div>
            </TabButton>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && topology && (
          <div className="space-y-8">
            <SectionHeader 
              title="Protocol Overview" 
              description="EQA-OSPF vs existing routing protocols"
            />

            {/* Protocol Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(['RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'] as Protocol[]).map(proto => {
                const desc = getProtocolDescription(proto);
                return (
                  <div 
                    key={proto}
                    className="bg-slate-800 rounded-xl p-5 border-t-4"
                    style={{ borderColor: PROTOCOL_COLORS[proto] }}
                  >
                    <h3 className="text-lg font-semibold text-white">{proto}</h3>
                    <p className="text-slate-400 text-xs mt-1">{desc.name}</p>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs">
                        <span className="text-slate-500">Algorithm:</span>{' '}
                        <span className="text-slate-300">{desc.algorithm}</span>
                      </p>
                      <p className="text-xs">
                        <span className="text-slate-500">Metric:</span>{' '}
                        <span className="text-slate-300 font-mono text-[10px]">{desc.metric}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {desc.features.map((f: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-700 rounded text-slate-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Network Topology */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Network Topology</h3>
                <p className="text-slate-400 text-sm mb-4">12-node network with random link properties</p>
                <TopologyVisualization topology={topology} />
              </div>

              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Simulation Parameters</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Nodes</div>
                      <div className="text-white text-xl font-bold">{topology.nodes.length}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Links</div>
                      <div className="text-white text-xl font-bold">{topology.links.length}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Bandwidth Range</div>
                      <div className="text-white text-xl font-bold">10-1000 Mbps</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Delay Range</div>
                      <div className="text-white text-xl font-bold">1-50 ms</div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    <p className="font-medium text-white mb-2">What the simulation does:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Runs actual Dijkstra/Bellman-Ford algorithms</li>
                      <li>Models protocol timers (Hello, Dead interval)</li>
                      <li>Simulates link failures and convergence</li>
                      <li>Measures real message counts</li>
                      <li>Calculates path latency and loss from link data</li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <button
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                      {isSimulating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Running Simulation...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Start Simulation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Simulation Progress" 
              description="Real-time simulation status"
            />

            <div className="bg-slate-800 rounded-xl p-8 text-center">
              {isSimulating ? (
                <div className="space-y-6">
                  <Loader2 className="w-16 h-16 text-emerald-500 mx-auto animate-spin" />
                  <div>
                    <p className="text-xl text-white font-medium">{simulationProgress}</p>
                    <p className="text-slate-400 mt-2">This runs actual routing algorithms...</p>
                  </div>
                </div>
              ) : convergenceResults.length > 0 ? (
                <div className="space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                  <div>
                    <p className="text-xl text-white font-medium">Simulation Complete!</p>
                    <p className="text-slate-400 mt-2">
                      Ran {convergenceResults.length} convergence trials across 4 protocols
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('results')}
                    className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    View Results
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Activity className="w-16 h-16 text-slate-500 mx-auto" />
                  <div>
                    <p className="text-xl text-white font-medium">Ready to Simulate</p>
                    <p className="text-slate-400 mt-2">Click "Run Simulation" to start</p>
                  </div>
                </div>
              )}
            </div>

            {/* Simulation Details */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Event-Driven Simulation Model</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-emerald-400 mb-2">Events Simulated</h4>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• HELLO_SEND / HELLO_RECEIVE</li>
                    <li>• UPDATE_SEND / UPDATE_RECEIVE (RIP)</li>
                    <li>• LSA_SEND / LSA_RECEIVE (OSPF)</li>
                    <li>• SPF_COMPUTE (Dijkstra)</li>
                    <li>• BFD_SEND / BFD_TIMEOUT (EQA)</li>
                    <li>• LINK_FAILURE / NEIGHBOR_TIMEOUT</li>
                    <li>• BACKUP_ACTIVATE (QAA/EQA)</li>
                  </ul>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-emerald-400 mb-2">Protocol Timers</h4>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• RIP: Hello 30s, Dead 180s</li>
                    <li>• OSPF: Hello 10s, Dead 40s</li>
                    <li>• QAA-OSPF: Same + backup routes</li>
                    <li>• EQA-OSPF: BFD 50ms × 3 = 150ms</li>
                  </ul>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-emerald-400 mb-2">Metrics Measured</h4>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• Convergence time (actual)</li>
                    <li>• Detection time (actual)</li>
                    <li>• Message count (actual)</li>
                    <li>• Path latency (from link delays)</li>
                    <li>• Path loss (from link loss rates)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && convergenceResults.length > 0 && (
          <div className="space-y-8">
            <SectionHeader 
              title="Simulation Results" 
              description="Real data from discrete event simulation"
            />

            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="EQA-OSPF Convergence"
                value={eqaStats ? formatTime(eqaStats.mean) : 'N/A'}
                subtitle="Mean convergence time"
                color="#10B981"
                icon={Zap}
              />
              <StatCard
                title="vs RIP"
                value={eqaStats && ripStats ? `${(ripStats.mean / eqaStats.mean).toFixed(0)}×` : 'N/A'}
                subtitle="Faster convergence"
                color="#EF4444"
                icon={Timer}
              />
              <StatCard
                title="vs OSPF"
                value={eqaStats && ospfStats ? `${(ospfStats.mean / eqaStats.mean).toFixed(0)}×` : 'N/A'}
                subtitle="Faster convergence"
                color="#3B82F6"
                icon={Timer}
              />
              <StatCard
                title="Trials Run"
                value={`${convergenceResults.length}`}
                subtitle="Convergence tests"
                color="#F59E0B"
                icon={Activity}
              />
            </div>

            {/* Diagnostics Panel */}
            {diagnosticResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Simulation Validation Checks</h3>
                    <p className="text-sm text-slate-400">
                      {diagnosticResults.filter(c => c.passed).length} / {diagnosticResults.length} checks passed
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      {diagnosticResults.filter(c => c.passed).length} Pass
                    </span>
                    <span className="flex items-center gap-1 text-sm text-red-400">
                      <XCircle className="w-4 h-4" />
                      {diagnosticResults.filter(c => !c.passed).length} Fail
                    </span>
                  </div>
                </div>
                
                {/* Group by protocol */}
                {(['ALL', 'RIP', 'OSPF', 'QAA-OSPF', 'EQA-OSPF'] as const).map(proto => {
                  const protoChecks = diagnosticResults.filter(c => c.protocol === proto);
                  if (protoChecks.length === 0) return null;
                  const pPassed = protoChecks.filter(c => c.passed).length;
                  return (
                    <div key={proto} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold" style={{ color: proto === 'ALL' ? '#94A3B8' : PROTOCOL_COLORS[proto as Protocol] || '#94A3B8' }}>
                          {proto === 'ALL' ? 'Topology & Cross-Protocol' : proto}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${pPassed === protoChecks.length ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                          {pPassed}/{protoChecks.length}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-1.5 px-2 text-slate-500 w-8"></th>
                              <th className="text-left py-1.5 px-2 text-slate-500">Check</th>
                              <th className="text-left py-1.5 px-2 text-slate-500">Expected</th>
                              <th className="text-left py-1.5 px-2 text-slate-500">Actual</th>
                            </tr>
                          </thead>
                          <tbody>
                            {protoChecks.map((check: DiagnosticCheck) => (
                              <tr key={check.id} className={`border-b border-slate-700/30 ${!check.passed ? 'bg-red-900/10' : ''}`}>
                                <td className="py-1.5 px-2">
                                  {check.passed 
                                    ? <span className="text-emerald-400">✓</span> 
                                    : <span className="text-red-400 font-bold">✗</span>
                                  }
                                </td>
                                <td className="py-1.5 px-2 text-slate-300">{check.name}</td>
                                <td className="py-1.5 px-2 text-slate-400 font-mono">{check.expected}</td>
                                <td className={`py-1.5 px-2 font-mono ${check.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {check.actual}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Convergence Chart */}
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Convergence Time</h3>
                <p className="text-sm text-slate-400 mb-4">Time to converge after link failure (actual simulation)</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={convergenceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="protocol" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <YAxis 
                        tick={{ fill: '#94A3B8' }} 
                        label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
                        labelStyle={{ color: '#F8FAFC' }}
                      />
                      <Legend />
                      <Bar dataKey="mean" name="Mean" radius={[4, 4, 0, 0]}>
                        {convergenceChartData.map((entry: { protocol: Protocol }, index: number) => (
                          <Cell key={index} fill={PROTOCOL_COLORS[entry.protocol]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Path Quality Chart */}
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Path Quality</h3>
                <p className="text-sm text-slate-400 mb-4">Average latency and loss of selected paths</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pathQualityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="protocol" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: '#94A3B8' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94A3B8' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
                        labelStyle={{ color: '#F8FAFC' }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="latency" name="Avg Latency (ms)" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="loss" name="Avg Loss (%)" fill="#F472B6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Overhead Timeline */}
              <div className="bg-slate-800 rounded-xl p-5 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-2">Control Message Overhead</h3>
                <p className="text-sm text-slate-400 mb-4">Messages per second during simulation</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overheadChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="second" 
                        tick={{ fill: '#94A3B8' }}
                        label={{ value: 'Time (seconds)', position: 'bottom', fill: '#94A3B8', offset: -5 }}
                      />
                      <YAxis tick={{ fill: '#94A3B8' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
                        labelStyle={{ color: '#F8FAFC' }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="RIP" stroke={PROTOCOL_COLORS['RIP']} fill={PROTOCOL_COLORS['RIP']} fillOpacity={0.3} />
                      <Area type="monotone" dataKey="OSPF" stroke={PROTOCOL_COLORS['OSPF']} fill={PROTOCOL_COLORS['OSPF']} fillOpacity={0.3} />
                      <Area type="monotone" dataKey="QAA-OSPF" stroke={PROTOCOL_COLORS['QAA-OSPF']} fill={PROTOCOL_COLORS['QAA-OSPF']} fillOpacity={0.3} />
                      <Area type="monotone" dataKey="EQA-OSPF" stroke={PROTOCOL_COLORS['EQA-OSPF']} fill={PROTOCOL_COLORS['EQA-OSPF']} fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Detailed Results</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">Protocol</th>
                      <th className="text-right py-3 px-4 text-slate-400">Mean Conv.</th>
                      <th className="text-right py-3 px-4 text-slate-400">Std Dev</th>
                      <th className="text-right py-3 px-4 text-slate-400">Min</th>
                      <th className="text-right py-3 px-4 text-slate-400">Max</th>
                      <th className="text-right py-3 px-4 text-slate-400">Detection</th>
                      <th className="text-right py-3 px-4 text-slate-400">Messages</th>
                      <th className="text-right py-3 px-4 text-slate-400">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedConvergence.map((r: ReturnType<typeof aggregateConvergenceResults>[0]) => (
                      <tr key={r.protocol} className="border-b border-slate-700/50">
                        <td className="py-3 px-4">
                          <span className="font-medium" style={{ color: PROTOCOL_COLORS[r.protocol] }}>
                            {r.protocol}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-mono">
                          {formatTime(r.mean)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          ±{formatTime(r.std)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          {formatTime(r.min)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          {formatTime(r.max)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          {formatTime(r.detectionMean)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                          {r.messagesMean.toFixed(0)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          {r.samples}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Congestion Stress Test */}
            {congestionResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Congestion Stress Test</h3>
                <p className="text-sm text-slate-400 mb-4">Path loss under increasing network load — QAA/EQA-OSPF adapt via load-aware metrics</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={congestionResults.map((cr: CongestionResult) => {
                      const row: Record<string, number> = { load: Math.round(cr.loadLevel * 100) };
                      cr.protocols.forEach((p: CongestionResult['protocols'][0]) => { row[p.protocol] = parseFloat(p.avgLoss.toFixed(2)); });
                      return row;
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="load" tick={{ fill: '#94A3B8' }} label={{ value: 'Network Load (%)', position: 'bottom', fill: '#94A3B8', offset: -5 }} />
                      <YAxis tick={{ fill: '#94A3B8' }} label={{ value: 'Avg Path Loss (%)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#F8FAFC' }} />
                      <Legend />
                      <Area type="monotone" dataKey="RIP" stroke={PROTOCOL_COLORS['RIP']} fill={PROTOCOL_COLORS['RIP']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="OSPF" stroke={PROTOCOL_COLORS['OSPF']} fill={PROTOCOL_COLORS['OSPF']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="QAA-OSPF" stroke={PROTOCOL_COLORS['QAA-OSPF']} fill={PROTOCOL_COLORS['QAA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="EQA-OSPF" stroke={PROTOCOL_COLORS['EQA-OSPF']} fill={PROTOCOL_COLORS['EQA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Multi-Failure Resilience */}
            {multiFailureResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Multi-Failure Resilience</h3>
                <p className="text-sm text-slate-400 mb-4">Reachability under simultaneous link failures (5 trials per k)</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={multiFailureResults.map((mf: MultiFailureResult) => {
                      const row: Record<string, number | string> = { k: `k=${mf.k}` };
                      mf.protocols.forEach((p: MultiFailureResult['protocols'][0]) => { row[p.protocol] = parseFloat(p.reachabilityPct.toFixed(1)); });
                      return row;
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="k" tick={{ fill: '#94A3B8' }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8' }} label={{ value: 'Reachability (%)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#F8FAFC' }} />
                      <Legend />
                      <Area type="monotone" dataKey="RIP" stroke={PROTOCOL_COLORS['RIP']} fill={PROTOCOL_COLORS['RIP']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="OSPF" stroke={PROTOCOL_COLORS['OSPF']} fill={PROTOCOL_COLORS['OSPF']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="QAA-OSPF" stroke={PROTOCOL_COLORS['QAA-OSPF']} fill={PROTOCOL_COLORS['QAA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="EQA-OSPF" stroke={PROTOCOL_COLORS['EQA-OSPF']} fill={PROTOCOL_COLORS['EQA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Security Analysis */}
            {securityResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Security Overhead Analysis</h3>
                <p className="text-sm text-slate-400 mb-4">Real message counts from simulation + modeled per-message authentication cost</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-3 text-slate-400">Protocol</th>
                        <th className="text-left py-3 px-3 text-slate-400">Mechanism</th>
                        <th className="text-right py-3 px-3 text-slate-400">Msgs/min</th>
                        <th className="text-right py-3 px-3 text-slate-400">Auth bytes</th>
                        <th className="text-right py-3 px-3 text-slate-400">CPU cost</th>
                        <th className="text-left py-3 px-3 text-slate-400">Attacks Blocked</th>
                        <th className="text-left py-3 px-3 text-slate-400">Vulnerable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityResults.map((sr: SecurityResult) => (
                        <tr key={sr.protocol} className="border-b border-slate-700/50">
                          <td className="py-3 px-3">
                            <span className="font-medium" style={{ color: PROTOCOL_COLORS[sr.protocol] }}>{sr.protocol}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 text-xs max-w-[200px] truncate">{sr.mechanism}</td>
                          <td className="py-3 px-3 text-right text-white font-mono">{sr.messagesPerMinute.toFixed(0)}</td>
                          <td className="py-3 px-3 text-right text-white font-mono">{sr.bytesPerAuth}B</td>
                          <td className="py-3 px-3 text-right text-white font-mono">{sr.cpuCostPerAuth.toFixed(1)}×</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {sr.attacksBlocked.map((a: string, i: number) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 rounded">✓ {a}</span>
                              ))}
                              {sr.attacksBlocked.length === 0 && <span className="text-[10px] text-red-400">None</span>}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {sr.attacksVulnerable.map((a: string, i: number) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">✗ {a}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Large-Scale Test */}
            {scaleResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Large-Scale Network Test</h3>
                <p className="text-sm text-slate-400 mb-4">Testing on 20, 50, and 100-node networks — proves scalability</p>
                
                {scaleResults.map((sr: ScaleTestResult) => (
                  <div key={sr.networkSize} className="mb-6">
                    <h4 className="text-md font-medium text-emerald-400 mb-3">
                      {sr.networkSize}-Node Network ({sr.numLinks} links)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-3 text-slate-400">Protocol</th>
                            <th className="text-right py-2 px-3 text-slate-400">Warmup (wall)</th>
                            <th className="text-right py-2 px-3 text-slate-400">Detection</th>
                            <th className="text-right py-2 px-3 text-slate-400">Convergence</th>
                            <th className="text-right py-2 px-3 text-slate-400">Messages</th>
                            <th className="text-right py-2 px-3 text-slate-400">Routes</th>
                            <th className="text-right py-2 px-3 text-slate-400">Avg Latency</th>
                            <th className="text-right py-2 px-3 text-slate-400">Avg Loss</th>
                            <th className="text-right py-2 px-3 text-slate-400">Flows</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sr.protocols.map((p: ScaleTestResult['protocols'][0]) => {
                            const skipped = p.warmupTimeMs < 0;
                            return (
                              <tr key={p.protocol} className="border-b border-slate-700/30">
                                <td className="py-2 px-3">
                                  <span className="font-medium" style={{ color: PROTOCOL_COLORS[p.protocol] }}>
                                    {p.protocol}
                                  </span>
                                </td>
                                {skipped ? (
                                  <td colSpan={8} className="py-2 px-3 text-center text-slate-500 italic">
                                    Skipped (RIP hop limit exceeded)
                                  </td>
                                ) : (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{p.warmupTimeMs.toFixed(0)}ms</td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{formatTime(p.detectionTimeMs)}</td>
                                    <td className="py-2 px-3 text-right font-mono" style={{ color: PROTOCOL_COLORS[p.protocol] }}>
                                      {formatTime(p.convergenceTimeMs)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{(p.totalMessages / 1000).toFixed(1)}K</td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">
                                      {p.routingTableValid}/{p.routingTableExpected}
                                      {p.routingTableValid < p.routingTableExpected && 
                                        <span className="text-red-400 ml-1">⚠</span>
                                      }
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{p.pathQuality.avgLatency.toFixed(1)}ms</td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{p.pathQuality.avgLoss.toFixed(2)}%</td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono">{p.pathQuality.flowsDelivered}/{p.pathQuality.flowsAttempted}</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                
                {/* Summary insight */}
                <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                  <p className="text-emerald-400 text-sm font-medium">Key Findings</p>
                  <ul className="mt-2 text-slate-300 text-xs space-y-1 list-disc list-inside">
                    <li>RIP cannot scale beyond ~30 nodes due to 15-hop limit</li>
                    <li>EQA-OSPF maintains sub-second convergence even at 100 nodes via BFD</li>
                    <li>OSPF/QAA-OSPF convergence grows with dead interval, not network size</li>
                    <li>EQA-OSPF generates more messages (BFD overhead) but achieves fastest recovery</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 'code' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Python Simulation Code" 
              description="Equivalent Python + NetworkX implementation"
            />

            {/* Code Section Selector */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'fullSimulation', label: 'Full Script' },
                { key: 'topology', label: 'Topology' },
                { key: 'metrics', label: 'Metrics' },
                { key: 'dijkstra', label: 'Dijkstra' },
                { key: 'bellmanFord', label: 'Bellman-Ford' },
                { key: 'convergence', label: 'Convergence' },
                { key: 'pathQuality', label: 'Path Quality' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedCodeSection(key as keyof typeof PYTHON_CODES)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCodeSection === key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Code Display */}
            <CodeViewer 
              title={`${selectedCodeSection}.py`}
              code={PYTHON_CODES[selectedCodeSection]}
            />

            {/* Instructions */}
            <div className="bg-gradient-to-r from-emerald-900/30 to-slate-800 rounded-xl p-6 border border-emerald-700/50">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-600 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Run the Python Code</h3>
                  <p className="text-slate-300 mt-2 text-sm">
                    Copy the "Full Script" code and save it as <code className="text-emerald-400">eqa_ospf_simulation.py</code>
                  </p>
                  <pre className="mt-3 bg-slate-900 rounded-lg p-3 text-sm text-emerald-400 font-mono overflow-x-auto">
                    pip install networkx numpy matplotlib{'\n'}
                    python eqa_ospf_simulation.py
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-400 text-sm">
              EN2150 — Communication Network Engineering | University of Moratuwa
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-400 text-sm font-medium">EQA-OSPF Discrete Event Simulation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
