import React from 'react';
import { SatelliteState, AISchedulerState } from '../types/simulation';

interface SatellitePanelProps {
  satellites: SatelliteState[];
  aiScheduler: AISchedulerState;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({ satellites, aiScheduler }) => {
  const getTaskLabel = (task: string, isVisible: boolean) => {
    if (!isVisible || task === 'IDLE') return 'Idle';
    if (task === 'PNT') return 'PNT Lock';
    if (task === 'IMAGING') return 'Imaging';
    return 'Relay';
  };

  const visibleCount = satellites.filter((s) => s.is_visible && !s.is_outage).length;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1E1E22]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#A1A1AA]">
          Orbital Constellation
        </span>
        <span className="text-[11px] font-mono text-[#71717A] num-readout">
          {visibleCount}/4 in view
        </span>
      </div>

      {/* Flat Divider-Separated Constellation List */}
      <div className="divide-y divide-[#1E1E22]">
        {satellites.map((sat) => {
          const isSelected = aiScheduler.selected_satellite === sat.sat_id;
          const score = aiScheduler.scores?.[sat.sat_id] || sat.score || 0;

          return (
            <div
              key={sat.sat_id}
              className={`px-4 py-3 transition-colors ${
                isSelected ? 'bg-[#141417]' : ''
              } ${!sat.is_visible && !sat.is_outage ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      sat.is_outage
                        ? 'bg-red-500'
                        : sat.is_visible
                        ? 'bg-emerald-500'
                        : 'bg-zinc-600'
                    }`}
                  />
                  <span className="font-mono text-xs font-medium text-[#F4F4F5]">
                    {sat.sat_id}
                  </span>
                  <span className="text-xs text-[#71717A]">{sat.name}</span>
                </div>
                <span className="text-[11px] font-mono text-[#A1A1AA]">
                  {sat.is_outage ? 'Outage' : getTaskLabel(sat.current_task, sat.is_visible)}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[#71717A] num-readout">
                <div>Elev {sat.elevation_deg}°</div>
                <div>Alt {sat.altitude_km} km</div>
                <div className="text-right">Bat {sat.battery_pct.toFixed(0)}%</div>
              </div>

              {/* Monochrome Utility Bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-[#1C1C21] h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F4F4F5] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(4, score * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#A1A1AA] num-readout w-8 text-right">
                  {score.toFixed(2)}
                </span>
              </div>

              {sat.target_rover_id && sat.is_visible && sat.current_task !== 'IDLE' && (
                <div className="mt-1.5 text-[11px] text-[#71717A] flex justify-between">
                  <span>Serving</span>
                  <span className="text-[#F4F4F5] font-mono">{sat.target_rover_id}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
