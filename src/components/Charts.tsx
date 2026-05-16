import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  ComposedChart,
  Scatter,
} from 'recharts';
import { Protocol } from '../types';

const COLORS: Record<string, string> = {
  'RIP': '#EF4444',
  'OSPF': '#3B82F6',
  'QAA-OSPF': '#F59E0B',
  'EQA-OSPF': '#10B981',
};

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ title, subtitle, children, className = '' }: ChartContainerProps) {
  return (
    <div className={`bg-slate-800 rounded-xl p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="h-[300px]">
        {children}
      </div>
    </div>
  );
}

// Convergence Time Box Plot
interface ConvergenceData {
  protocol: Protocol;
  mean: number;
  min: number;
  max: number;
  std: number;
}

export function ConvergenceChart({ data }: { data: ConvergenceData[] }) {
  const chartData = data.map(d => ({
    name: d.protocol,
    mean: d.mean,
    min: d.min,
    max: d.max,
    std: d.std,
    fill: COLORS[d.protocol],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Bar dataKey="mean" radius={[4, 4, 0, 0]} name="Mean">
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
        <Scatter dataKey="min" fill="#FFF" name="Min" />
        <Scatter dataKey="max" fill="#FFF" name="Max" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Convergence comparison grouped bar chart
interface ConvergenceComparisonData {
  protocol: Protocol;
  single: number;
  cascade: number;
  partition: number;
}

export function ConvergenceComparisonChart({ data }: { data: ConvergenceComparisonData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="protocol" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Convergence Time (s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Bar dataKey="single" name="Single Failure" fill="#A78BFA" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cascade" name="Cascade Failure" fill="#60A5FA" radius={[4, 4, 0, 0]} />
        <Bar dataKey="partition" name="Partition Failure" fill="#34D399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Overhead Timeline Chart
interface OverheadTimelineData {
  minute: number;
  RIP: number;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function OverheadTimelineChart({ data }: { data: OverheadTimelineData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="minute" 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Time (minutes)', position: 'bottom', fill: '#94A3B8', offset: -5 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Packets/min', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Area type="monotone" dataKey="RIP" stackId="1" stroke={COLORS['RIP']} fill={COLORS['RIP']} fillOpacity={0.3} />
        <Area type="monotone" dataKey="OSPF" stackId="2" stroke={COLORS['OSPF']} fill={COLORS['OSPF']} fillOpacity={0.3} />
        <Area type="monotone" dataKey="QAA-OSPF" stackId="3" stroke={COLORS['QAA-OSPF']} fill={COLORS['QAA-OSPF']} fillOpacity={0.3} />
        <Area type="monotone" dataKey="EQA-OSPF" stackId="4" stroke={COLORS['EQA-OSPF']} fill={COLORS['EQA-OSPF']} fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Total Overhead Bar Chart
interface TotalOverheadData {
  protocol: Protocol;
  total: number;
  percentage: number;
}

export function TotalOverheadChart({ data }: { data: TotalOverheadData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 50, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal />
        <XAxis type="number" tick={{ fill: '#94A3B8' }} />
        <YAxis dataKey="protocol" type="category" tick={{ fill: '#94A3B8', fontSize: 12 }} width={80} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[entry.protocol]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Load Distribution Histogram
interface LoadDistData {
  bin: string;
  RIP: number;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function LoadDistributionChart({ data, selectedProtocol }: { data: LoadDistData[], selectedProtocol: Protocol }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="bin" 
          tick={{ fill: '#94A3B8', fontSize: 10 }} 
          label={{ value: 'Load (flows per link)', position: 'bottom', fill: '#94A3B8', offset: 0 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: '# Links', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Bar dataKey={selectedProtocol} fill={COLORS[selectedProtocol]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Path Quality Chart (Latency + Loss)
interface PathQualityData {
  protocol: Protocol;
  latency: number;
  loss: number;
}

export function PathQualityChart({ data }: { data: PathQualityData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="protocol" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <YAxis 
          yAxisId="left"
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Loss (%)', angle: 90, position: 'insideRight', fill: '#94A3B8', fontSize: 11 }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Bar yAxisId="left" dataKey="latency" name="Mean Latency (ms)" fill="#60A5FA" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="loss" name="Mean Loss (%)" fill="#F472B6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Scalability Chart
interface ScalabilityData {
  size: number;
  RIP: number;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function ScalabilityChart({ data }: { data: ScalabilityData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="size" 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Network Size (nodes)', position: 'bottom', fill: '#94A3B8', offset: 0 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Computation Time (ms)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Line type="monotone" dataKey="RIP" stroke={COLORS['RIP']} strokeWidth={2} dot={{ fill: COLORS['RIP'], r: 4 }} />
        <Line type="monotone" dataKey="OSPF" stroke={COLORS['OSPF']} strokeWidth={2} dot={{ fill: COLORS['OSPF'], r: 4 }} />
        <Line type="monotone" dataKey="QAA-OSPF" stroke={COLORS['QAA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['QAA-OSPF'], r: 4 }} />
        <Line type="monotone" dataKey="EQA-OSPF" stroke={COLORS['EQA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['EQA-OSPF'], r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Count to Infinity Chart
interface CountToInfinityData {
  round: number;
  RIP: number | null;
  'QAA-OSPF': number | null;
  'EQA-OSPF': number | null;
}

export function CountToInfinityChart({ data }: { data: CountToInfinityData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="round" 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Update Rounds', position: 'bottom', fill: '#94A3B8', offset: 0 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          domain={[0, 18]}
          label={{ value: 'Metric Value', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Line 
          type="monotone" 
          dataKey={() => 16} 
          stroke="#6B7280" 
          strokeDasharray="5 5" 
          name="RIP Infinity (16)"
          dot={false}
        />
        <Line type="monotone" dataKey="RIP" stroke={COLORS['RIP']} strokeWidth={2} dot={{ fill: COLORS['RIP'], r: 4 }} name="RIP (counting)" connectNulls />
        <Line type="monotone" dataKey="QAA-OSPF" stroke={COLORS['QAA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['QAA-OSPF'], r: 5 }} name="QAA-OSPF" connectNulls />
        <Line type="monotone" dataKey="EQA-OSPF" stroke={COLORS['EQA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['EQA-OSPF'], r: 5 }} name="EQA-OSPF" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Fault Recovery Timeline
interface FaultRecoveryData {
  time: number;
  RIP: number;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function FaultRecoveryChart({ data }: { data: FaultRecoveryData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="time" 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Time after failure (s)', position: 'bottom', fill: '#94A3B8', offset: 0 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          domain={[0, 100]}
          label={{ value: 'Packet Loss Rate (%)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Area type="monotone" dataKey="RIP" stroke={COLORS['RIP']} fill={COLORS['RIP']} fillOpacity={0.2} strokeWidth={2} />
        <Area type="monotone" dataKey="OSPF" stroke={COLORS['OSPF']} fill={COLORS['OSPF']} fillOpacity={0.2} strokeWidth={2} />
        <Area type="monotone" dataKey="QAA-OSPF" stroke={COLORS['QAA-OSPF']} fill={COLORS['QAA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
        <Area type="monotone" dataKey="EQA-OSPF" stroke={COLORS['EQA-OSPF']} fill={COLORS['EQA-OSPF']} fillOpacity={0.2} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Weight Sensitivity Chart (EQA-OSPF)
interface WeightSensitivityData {
  profile: string;
  latency: number;
  loss: number;
}

export function WeightSensitivityChart({ data }: { data: WeightSensitivityData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 50, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="profile" 
          tick={{ fill: '#94A3B8', fontSize: 10 }} 
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          yAxisId="left"
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Loss (%)', angle: 90, position: 'insideRight', fill: '#94A3B8', fontSize: 11 }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Bar yAxisId="left" dataKey="latency" name="Mean Latency" fill="#14B8A6" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="loss" name="Mean Loss" fill="#F87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Multi-Failure Resilience Chart
interface MultiFailureData {
  k: string;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function MultiFailureChart({ data }: { data: MultiFailureData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="k" 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Simultaneous Failures (k)', position: 'bottom', fill: '#94A3B8', offset: 0 }}
        />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          domain={[30, 100]}
          label={{ value: 'Reachable Destinations (%)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Line type="monotone" dataKey="OSPF" stroke={COLORS['OSPF']} strokeWidth={2} dot={{ fill: COLORS['OSPF'], r: 5 }} />
        <Line type="monotone" dataKey="QAA-OSPF" stroke={COLORS['QAA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['QAA-OSPF'], r: 5 }} />
        <Line type="monotone" dataKey="EQA-OSPF" stroke={COLORS['EQA-OSPF']} strokeWidth={2} dot={{ fill: COLORS['EQA-OSPF'], r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Security Overhead Chart
interface SecurityOverheadData {
  mechanism: string;
  overhead: number;
  color: string;
}

export function SecurityOverheadChart({ data }: { data: SecurityOverheadData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 50, left: 160, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal />
        <XAxis 
          type="number" 
          tick={{ fill: '#94A3B8' }} 
          domain={[0, 1.5]}
          label={{ value: 'Relative CPU Overhead (OSPF = 1.0)', position: 'bottom', fill: '#94A3B8', offset: -5 }}
        />
        <YAxis 
          dataKey="mechanism" 
          type="category" 
          tick={{ fill: '#94A3B8', fontSize: 10 }} 
          width={160} 
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Bar dataKey="overhead" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Radar Chart for Protocol Comparison
interface RadarData {
  metric: string;
  RIP: number;
  OSPF: number;
  'QAA-OSPF': number;
  'EQA-OSPF': number;
}

export function ProtocolRadarChart({ data }: { data: RadarData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#94A3B8', fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: '#94A3B8' }} />
        <Radar name="RIP" dataKey="RIP" stroke={COLORS['RIP']} fill={COLORS['RIP']} fillOpacity={0.1} strokeWidth={2} />
        <Radar name="OSPF" dataKey="OSPF" stroke={COLORS['OSPF']} fill={COLORS['OSPF']} fillOpacity={0.1} strokeWidth={2} />
        <Radar name="QAA-OSPF" dataKey="QAA-OSPF" stroke={COLORS['QAA-OSPF']} fill={COLORS['QAA-OSPF']} fillOpacity={0.1} strokeWidth={2} />
        <Radar name="EQA-OSPF" dataKey="EQA-OSPF" stroke={COLORS['EQA-OSPF']} fill={COLORS['EQA-OSPF']} fillOpacity={0.3} strokeWidth={2} />
        <Legend wrapperStyle={{ color: '#94A3B8' }} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Recovery Time Bar Chart
interface RecoveryTimeData {
  protocol: Protocol;
  time: number;
}

export function RecoveryTimeChart({ data }: { data: RecoveryTimeData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="protocol" tick={{ fill: '#94A3B8', fontSize: 12 }} />
        <YAxis 
          tick={{ fill: '#94A3B8' }} 
          label={{ value: 'Recovery Time (s)', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: 8 }}
          labelStyle={{ color: '#F8FAFC' }}
        />
        <Bar dataKey="time" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[entry.protocol]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
