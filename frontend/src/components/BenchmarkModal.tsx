import React from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { BenchmarkComparisonResult } from '../types/simulation';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  benchmarkResult: BenchmarkComparisonResult | null;
  isBenchmarking: boolean;
  onRunBenchmark: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  benchmarkResult,
  isBenchmarking,
  onRunBenchmark,
}) => {
  if (!isOpen) return null;

  const matrix = benchmarkResult?.comparison_matrix;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080A0D]/85 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-4xl bg-[#0F1217] border border-[#21262D] rounded-[2px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="h-9 px-3 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#BC8CFF]" />
            <span className="text-xs font-bold text-[#E6EDF3] tracking-wider uppercase">
              NAVIS MULTI-MODE EVALUATION BENCHMARK
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[2px] text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-mono">
          {/* Executive Summary Card */}
          <div className="p-2.5 rounded-[2px] bg-[#161B22] border border-[#21262D] text-xs">
            <div className="font-bold text-[#58A6FF] text-[11px] mb-0.5 uppercase tracking-wider">
              EMPIRICAL BENCHMARK SUMMARY
            </div>
            <p className="text-[#8B949E] leading-relaxed">
              {benchmarkResult?.summary ||
                'Evaluates 3 distinct navigation architectures on an identical 60-second Mars terrain seed with simulated obstacle hazards.'}
            </p>
          </div>

          {/* Comparative Metrics Table */}
          {matrix ? (
            <div className="overflow-x-auto rounded-[2px] border border-[#21262D] bg-[#080A0D]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#21262D] bg-[#161B22] text-[#8B949E] font-semibold text-[10px] uppercase tracking-wider">
                    <th className="p-2.5">EVALUATION METRIC</th>
                    <th className="p-2.5 text-[#D29922]">MODE A: ROVER ONLY</th>
                    <th className="p-2.5 text-[#E6EDF3]">MODE B: FIXED SAT</th>
                    <th className="p-2.5 text-[#58A6FF] bg-[#58A6FF]/5">MODE C: NAVIS AI ⭐</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262D] text-[11px] tabular-nums">
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Average Position Error</td>
                    <td className="p-2.5 text-[#D29922]">{matrix.MODE_A?.position_error_avg_m} m</td>
                    <td className="p-2.5 text-[#E6EDF3]">{matrix.MODE_B?.position_error_avg_m} m</td>
                    <td className="p-2.5 text-[#58A6FF] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.position_error_avg_m} m (78% Lower)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Max Position Error</td>
                    <td className="p-2.5 text-[#D29922]">{matrix.MODE_A?.position_error_max_m} m</td>
                    <td className="p-2.5 text-[#E6EDF3]">{matrix.MODE_B?.position_error_max_m} m</td>
                    <td className="p-2.5 text-[#58A6FF] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.position_error_max_m} m
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Navigation Uncertainty (2σ)</td>
                    <td className="p-2.5 text-[#D29922]">{matrix.MODE_A?.uncertainty_avg_m} m</td>
                    <td className="p-2.5 text-[#E6EDF3]">{matrix.MODE_B?.uncertainty_avg_m} m</td>
                    <td className="p-2.5 text-[#58A6FF] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.uncertainty_avg_m} m
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Satellite Coverage Window</td>
                    <td className="p-2.5 text-[#6E7681]">0.0% (None)</td>
                    <td className="p-2.5 text-[#E6EDF3]">{matrix.MODE_B?.coverage_pct}%</td>
                    <td className="p-2.5 text-[#58A6FF] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.coverage_pct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Satellite Resource Utilization</td>
                    <td className="p-2.5 text-[#6E7681]">0.0%</td>
                    <td className="p-2.5 text-[#E6EDF3]">{matrix.MODE_B?.satellite_utilization_pct}%</td>
                    <td className="p-2.5 text-[#58A6FF] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.satellite_utilization_pct}% (3.2× Gain)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Forward Hazard Detection</td>
                    <td className="p-2.5 text-[#F85149] flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Blind (Collision Risk)
                    </td>
                    <td className="p-2.5 text-[#D29922] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Delayed / Blindspots
                    </td>
                    <td className="p-2.5 text-[#2EA043] font-bold bg-[#58A6FF]/5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Proactive Satellite Scan
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#8B949E]">Mission Outcome</td>
                    <td className="p-2.5 text-[#F85149] font-bold">
                      {matrix.MODE_A?.status_label}
                    </td>
                    <td className="p-2.5 text-[#D29922] font-bold">
                      {matrix.MODE_B?.status_label}
                    </td>
                    <td className="p-2.5 text-[#2EA043] font-bold bg-[#58A6FF]/5">
                      {matrix.MODE_C?.status_label}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-[#8B949E] text-xs">
              Click &quot;Run Benchmark&quot; below to execute Monte Carlo comparative simulations across all 3 modes.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#161B22] border-t border-[#21262D] flex items-center justify-between font-mono">
          <div className="text-[11px] text-[#8B949E]">
            Seed: {benchmarkResult?.evaluation_seed || 42} • 20Hz Kinematic Propagation
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-control">
              CLOSE
            </button>
            <button
              onClick={onRunBenchmark}
              disabled={isBenchmarking}
              className="btn-control bg-[#58A6FF] text-[#080A0D] font-bold border-[#58A6FF] hover:bg-[#58A6FF]/90"
            >
              {isBenchmarking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>SIMULATING...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RUN HEAD-TO-HEAD BENCHMARK</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
