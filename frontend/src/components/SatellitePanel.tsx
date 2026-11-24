import React from 'react';
import { Satellite, Radio, Camera, Cpu, Battery, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { SatelliteState, AISchedulerState } from '../types/simulation';

interface SatellitePanelProps {
  satellites: SatelliteState[];
  aiScheduler: AISchedulerState;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({ satellites, aiScheduler }) => {
  const getTaskBadge = (task: string, isVisible: boolean) => {
    if (!isVisible || task === 'IDLE') {
      return (
        <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono bg-[#161B22] text-[#8B949E] border border-[#21262D]">
          IDLE
        </span>
      );
    }
    if (task === 'PNT') {
      return (
        <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono font-bold bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/40 flex items-center gap-1">
          <Radio className="w-2.5 h-2.5" /> PNT LOCK
        </span>
      );
    }
    if (task === 'IMAGING') {
      return (
        <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono font-bold bg-[#BC8CFF]/15 text-[#BC8CFF] border border-[#BC8CFF]/40 flex items-center gap-1">
          <Camera className="w-2.5 h-2.5" /> IMAGING
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono font-bold bg-[#2EA043]/15 text-[#2EA043] border border-[#2EA043]/40 flex items-center gap-1">
        <Satellite className="w-2.5 h-2.5" /> COMM RELAY
      </span>
    );
  };

  const visibleCount = satellites.filter((s) => s.is_visible).length;

  return (
    <div className="panel-matte flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-1.5">
          <Satellite className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span>ORBITAL CONSTELLATION STATUS</span>
        </div>
        <span className="text-[10px] font-mono text-[#58A6FF] num-readout">
          {visibleCount}/4 IN VIEW
        </span>
      </div>

      {/* Satellite Cards Grid */}
      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {satellites.map((sat) => {
          const isSelected = aiScheduler.selected_satellite === sat.sat_id;
          const score = aiScheduler.scores?.[sat.sat_id] || sat.score || 0;

          return (
            <div
              key={sat.sat_id}
              className={`p-2 rounded-[2px] border font-mono transition-colors relative ${
                sat.is_outage
                  ? 'bg-[#080A0D] border-[#F85149]/40'
                  : sat.is_visible
                  ? isSelected
                    ? 'bg-[#161B22] border-[#58A6FF]/60'
                    : 'bg-[#080A0D] border-[#21262D]'
                  : 'bg-[#080A0D]/60 border-[#21262D] opacity-60'
              }`}
            >
              {/* Header: ID + Name + Task Badge */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-[#E6EDF3]">{sat.sat_id}</span>
                  <span className="text-[10px] text-[#8B949E]">({sat.name})</span>
                </div>
                {getTaskBadge(sat.current_task, sat.is_visible)}
              </div>

              {/* Orbital Visibility & Elevation */}
              <div className="flex items-center justify-between text-[10px] mb-1">
                <div className="flex items-center gap-1">
                  {sat.is_outage ? (
                    <span className="text-[#F85149] flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> OUTAGE
                    </span>
                  ) : sat.is_visible ? (
                    <span className="text-[#2EA043] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> LOS LOCK
                    </span>
                  ) : (
                    <span className="text-[#8B949E] flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> BELOW HORIZON
                    </span>
                  )}
                </div>
                <span className="text-[#8B949E] num-readout">ELEV: {sat.elevation_deg}°</span>
              </div>

              {/* Altitude & Battery */}
              <div className="flex items-center justify-between text-[10px] text-[#8B949E] mb-1.5 num-readout">
                <span>ALT: {sat.altitude_km} km</span>
                <div className="flex items-center gap-1">
                  <Battery className="w-3 h-3 text-[#8B949E]" />
                  <span>{sat.battery_pct.toFixed(0)}%</span>
                </div>
              </div>

              {/* AI Utility Score Meter */}
              <div className="w-full bg-[#161B22] rounded-[1px] h-1 overflow-hidden mb-1 border border-[#21262D]">
                <div
                  className={`h-full transition-all duration-300 ${
                    sat.current_task === 'PNT'
                      ? 'bg-[#58A6FF]'
                      : sat.current_task === 'IMAGING'
                      ? 'bg-[#BC8CFF]'
                      : 'bg-[#2EA043]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, score * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#8B949E] num-readout">
                <span>AI UTILITY SCORE</span>
                <span className="text-[#E6EDF3] font-bold">{score.toFixed(2)}</span>
              </div>

              {/* Swarm Target Rover Allocation */}
              {sat.target_rover_id && sat.is_visible && sat.current_task !== 'IDLE' && (
                <div className="flex items-center justify-between text-[9px] mt-1.5 pt-1 border-t border-[#21262D]">
                  <span className="text-[#8B949E]">SERVING:</span>
                  <span
                    className={`font-bold px-1.5 py-0.2 rounded-[2px] ${
                      sat.target_rover_id === 'ROVER-1'
                        ? 'bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/40'
                        : sat.target_rover_id === 'ROVER-2'
                        ? 'bg-[#2EA043]/15 text-[#2EA043] border border-[#2EA043]/40'
                        : 'bg-[#BC8CFF]/15 text-[#BC8CFF] border border-[#BC8CFF]/40'
                    }`}
                  >
                    {sat.target_rover_id === 'ROVER-1'
                      ? 'ROVER-1 (ALPHA)'
                      : sat.target_rover_id === 'ROVER-2'
                      ? 'ROVER-2 (BETA)'
                      : 'ROVER-3 (GAMMA)'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Scheduler Matrix Rationale Summary */}
      {aiScheduler.reason_summary && (
        <div className="mx-2 mb-2 p-1.5 rounded-[2px] bg-[#161B22] border border-[#21262D] text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-[#58A6FF] font-semibold mb-0.5">
            <Cpu className="w-3 h-3" />
            <span>AI SCHEDULER RATIONALE</span>
          </div>
          <p className="text-[#8B949E] leading-relaxed">{aiScheduler.reason_summary}</p>
        </div>
      )}
    </div>
  );
};
