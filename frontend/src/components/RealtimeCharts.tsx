import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Activity } from 'lucide-react';
import { PerformanceMetricsState } from '../types/simulation';

interface RealtimeChartsProps {
  metrics: PerformanceMetricsState | null;
  simTime: number;
}

interface ChartSample {
  time: number;
  posError: number;
  uncertainty: number;
  activeSats: number;
}

export const RealtimeCharts: React.FC<RealtimeChartsProps> = ({ metrics, simTime }) => {
  const [history, setHistory] = useState<ChartSample[]>([]);
  const [selectedChart, setSelectedChart] = useState<'ERROR_UNCERTAINTY' | 'SATELLITE_USAGE'>('ERROR_UNCERTAINTY');

  useEffect(() => {
    if (!metrics) return;

    const sample: ChartSample = {
      time: Math.round(simTime * 10) / 10,
      posError: metrics.position_error_instant_m || metrics.current_position_error_m || 0.0,
      uncertainty: metrics.current_uncertainty_m || 0.5,
      activeSats: metrics.active_satellites_count || 0,
    };

    setHistory((prev) => {
      if (sample.time === 0 || (prev.length > 0 && sample.time < prev[prev.length - 1].time)) {
        return [sample];
      }
      const updated = [...prev, sample];
      return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
    });
  }, [metrics, simTime]);

  return (
    <div className="panel-matte flex flex-col overflow-hidden">
      {/* Chart Header */}
      <div className="panel-header">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span>REAL-TIME PERFORMANCE TELEMETRY</span>
        </div>
        {/* Toggle Charts */}
        <div className="flex items-center gap-0.5 font-mono text-[9px]">
          <button
            onClick={() => setSelectedChart('ERROR_UNCERTAINTY')}
            className={`px-1.5 py-0.5 rounded-[2px] transition-colors duration-150 ${
              selectedChart === 'ERROR_UNCERTAINTY'
                ? 'bg-[#21262D] text-[#58A6FF] font-semibold border border-[#30363D]'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
          >
            ERROR / UNCERTAINTY
          </button>
          <button
            onClick={() => setSelectedChart('SATELLITE_USAGE')}
            className={`px-1.5 py-0.5 rounded-[2px] transition-colors duration-150 ${
              selectedChart === 'SATELLITE_USAGE'
                ? 'bg-[#21262D] text-[#BC8CFF] font-semibold border border-[#30363D]'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
          >
            SATELLITE UTILIZATION
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="p-2 w-full bg-[#080A0D]">
        {history.length === 0 ? (
          <div className="h-[150px] flex flex-col items-center justify-center text-[#6E7681] text-xs font-mono border border-dashed border-[#21262D] rounded-[2px]">
            <span>ACQUIRING PERFORMANCE TIME SERIES...</span>
            <span className="text-[10px] text-[#8B949E] mt-1">Start mission execution to stream metrics</span>
          </div>
        ) : selectedChart === 'ERROR_UNCERTAINTY' ? (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F85149" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F85149" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="uncGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#58A6FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#21262D" vertical={false} />
              <XAxis dataKey="time" stroke="#6E7681" tick={{ fontSize: 9, fill: '#8B949E', fontFamily: 'monospace' }} unit="s" />
              <YAxis stroke="#6E7681" tick={{ fontSize: 9, fill: '#8B949E', fontFamily: 'monospace' }} unit="m" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F1217',
                  borderColor: '#21262D',
                  borderRadius: '2px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: '#E6EDF3',
                }}
              />
              <Area
                type="monotone"
                dataKey="posError"
                name="Position Error (m)"
                stroke="#F85149"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#errorGrad)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="uncertainty"
                name="Uncertainty 2σ (m)"
                stroke="#58A6FF"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#uncGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#21262D" vertical={false} />
              <XAxis dataKey="time" stroke="#6E7681" tick={{ fontSize: 9, fill: '#8B949E', fontFamily: 'monospace' }} unit="s" />
              <YAxis domain={[0, 4]} stroke="#6E7681" tick={{ fontSize: 9, fill: '#8B949E', fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F1217',
                  borderColor: '#21262D',
                  borderRadius: '2px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: '#E6EDF3',
                }}
              />
              <Line
                type="stepAfter"
                dataKey="activeSats"
                name="Active Satellites"
                stroke="#BC8CFF"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
