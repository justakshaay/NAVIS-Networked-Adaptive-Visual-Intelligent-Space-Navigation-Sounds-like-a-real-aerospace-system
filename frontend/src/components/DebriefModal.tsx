import React from 'react';
import { X, Printer, Download, ShieldCheck, Activity, AlertTriangle, Compass, CheckCircle2 } from 'lucide-react';
import { DebriefSummary, exportTelemetryCsv } from '../utils/exportReport';
import { SimulationFullState } from '../types/simulation';

interface DebriefModalProps {
  summary: DebriefSummary;
  rawBuffer: SimulationFullState[];
  currentState: SimulationFullState;
  onClose: () => void;
}

export const DebriefModal: React.FC<DebriefModalProps> = ({
  summary,
  rawBuffer,
  currentState,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    exportTelemetryCsv(rawBuffer, currentState);
  };

  const metMin = Math.floor(summary.missionDuration_s / 60);
  const metSec = Math.floor(summary.missionDuration_s % 60);
  const metStr = `+${String(metMin).padStart(2, '0')}:${String(metSec).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-[#080A0D]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0F1217] border border-[#21262D] rounded-[2px] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col font-mono text-xs text-[#E6EDF3]">
        {/* Modal Header */}
        <div className="p-3 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#58A6FF]" />
            <div>
              <span className="font-bold text-sm tracking-wide text-[#E6EDF3]">
                NAVIS MISSION FLIGHT DEBRIEF REPORT
              </span>
              <span className="text-[10px] text-[#8B949E] block">
                NASA JPL OpenMCT & SpaceX Flight Operations Format
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleDownloadCsv}
              className="btn-control hover:text-[#58A6FF] flex items-center gap-1.5"
              title="Download Telemetry CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn-control bg-[#58A6FF]/15 text-[#58A6FF] border-[#58A6FF]/50 hover:bg-[#58A6FF]/25 font-bold flex items-center gap-1.5"
              title="Print or Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#21262D] text-[#8B949E] hover:text-[#E6EDF3] rounded-[2px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div className="p-4 overflow-y-auto space-y-4 print:p-0 print:space-y-3">
          {/* Mission Metadata Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-[#161B22]/60 border border-[#21262D] rounded-[2px]">
            <div>
              <span className="text-[9px] text-[#8B949E] uppercase block">ACTIVE ARCHITECTURE</span>
              <span className="font-bold text-[#58A6FF] text-[11px]">{summary.modeName}</span>
            </div>
            <div>
              <span className="text-[9px] text-[#8B949E] uppercase block">TERRAIN SURFACE</span>
              <span className="font-semibold text-[11px] uppercase">{summary.terrainPreset.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-[9px] text-[#8B949E] uppercase block">MISSION MET</span>
              <span className="font-semibold text-[11px] tabular-nums">MET {metStr}</span>
            </div>
            <div>
              <span className="text-[9px] text-[#8B949E] uppercase block">RECORDED SAMPLES</span>
              <span className="font-semibold text-[11px] tabular-nums">{summary.totalFrames} frames</span>
            </div>
          </div>

          {/* Performance KPIs Grid */}
          <div>
            <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>PRIMARY FLIGHT METRICS & LOCALIZATION FIDELITY</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
                <span className="text-[9px] text-[#8B949E] block">MEAN EKF ERROR</span>
                <span className="text-base font-bold text-[#2EA043] tabular-nums">
                  {summary.meanError_m.toFixed(2)} m
                </span>
                <span className="text-[9px] text-[#8B949E] block">Target &lt; 1.5m</span>
              </div>
              <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
                <span className="text-[9px] text-[#8B949E] block">PEAK ERROR SPIKE</span>
                <span className={`text-base font-bold tabular-nums ${summary.peakError_m > 4.0 ? 'text-[#F85149]' : 'text-[#D29922]'}`}>
                  {summary.peakError_m.toFixed(2)} m
                </span>
                <span className="text-[9px] text-[#8B949E] block">Worst-case drift</span>
              </div>
              <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
                <span className="text-[9px] text-[#8B949E] block">MEAN 2σ UNCERTAINTY</span>
                <span className="text-base font-bold text-[#58A6FF] tabular-nums">
                  ±{summary.meanUncertainty_m.toFixed(2)} m
                </span>
                <span className="text-[9px] text-[#8B949E] block">Covariance radius</span>
              </div>
              <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
                <span className="text-[9px] text-[#8B949E] block">SATELLITE LOCK COVERAGE</span>
                <span className="text-base font-bold text-[#2EA043] tabular-nums">
                  {summary.satAvailability_pct}%
                </span>
                <span className="text-[9px] text-[#8B949E] block">Orbital PNT availability</span>
              </div>
            </div>
          </div>

          {/* Mission Execution Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
              <span className="text-[9px] text-[#8B949E] block">DYNAMIC HAZARDS AVOIDED</span>
              <span className="text-sm font-bold text-[#2EA043] flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{summary.hazardsAvoided} Obstacles Bypassed</span>
              </span>
            </div>
            <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
              <span className="text-[9px] text-[#8B949E] block">TOTAL TRAVERSED DISTANCE</span>
              <span className="text-sm font-bold text-[#E6EDF3] mt-0.5 block tabular-nums">
                {summary.totalDistance_m.toFixed(1)} meters
              </span>
            </div>
            <div className="p-2.5 bg-[#080A0D] border border-[#21262D] rounded-[2px]">
              <span className="text-[9px] text-[#8B949E] block">BATTERY HEALTH STATUS</span>
              <span className="text-sm font-bold text-[#58A6FF] mt-0.5 block tabular-nums">
                {summary.batteryRemaining_pct.toFixed(0)}% Charge Nominal
              </span>
            </div>
          </div>

          {/* Chronological AI Decision & Event Log */}
          <div>
            <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>CHRONOLOGICAL AUTONAV & AI DECISION AUDIT TRAIL</span>
            </div>
            <div className="border border-[#21262D] rounded-[2px] overflow-hidden bg-[#080A0D]">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[#161B22] border-b border-[#21262D] text-[#8B949E]">
                    <th className="py-1 px-2">MET</th>
                    <th className="py-1 px-2">TIME</th>
                    <th className="py-1 px-2">SYSTEM</th>
                    <th className="py-1 px-2">EVENT LOG & ACTION EXPLANATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262D]/60 font-mono">
                  {summary.decisionLogs.length > 0 ? (
                    summary.decisionLogs.map((l, i) => (
                      <tr key={i} className="hover:bg-[#161B22]/40">
                        <td className="py-1 px-2 text-[#58A6FF] whitespace-nowrap">{l.met}</td>
                        <td className="py-1 px-2 text-[#8B949E] whitespace-nowrap">{l.time}</td>
                        <td className="py-1 px-2 font-bold text-[#E6EDF3] whitespace-nowrap">
                          <span className={`px-1 py-0.2 rounded-[1px] ${
                            l.category === 'HAZARD'
                              ? 'bg-[#F85149]/20 text-[#F85149]'
                              : l.category === 'STORM'
                              ? 'bg-[#D29922]/20 text-[#D29922]'
                              : l.category === 'SWARM' || l.category === 'SWARM-AI'
                              ? 'bg-[#BC8CFF]/20 text-[#BC8CFF]'
                              : 'bg-[#58A6FF]/10 text-[#58A6FF]'
                          }`}>
                            {l.category}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-[#E6EDF3]">{l.message}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-[#8B949E]">
                        No flight event entries recorded in current session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-2.5 bg-[#161B22] border-t border-[#21262D] flex items-center justify-between shrink-0 text-[10px] text-[#8B949E]">
          <span>NAVIS FLIGHT RECORDER // AUTONOMOUS RECONNAISSANCE SYSTEM</span>
          <button
            onClick={onClose}
            className="btn-control px-3 py-1 font-semibold hover:text-[#E6EDF3]"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
