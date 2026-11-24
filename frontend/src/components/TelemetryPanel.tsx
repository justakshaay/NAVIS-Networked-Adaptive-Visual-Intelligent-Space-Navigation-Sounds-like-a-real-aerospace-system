import React from 'react';
import { RoverState, PerformanceMetricsState } from '../types/simulation';

interface TelemetryPanelProps {
  rover: RoverState | null;
  metrics: PerformanceMetricsState | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ rover, metrics }) => {
  const batteryPct = rover?.battery_pct || 100;
  const speed = rover?.speed || 0.0;
  const headingDeg = rover?.heading_deg || 0;
  const distToTarget = rover?.dist_to_target || 0;
  const totalDist = rover?.total_distance || 0;
  const wheelSlip = rover?.wheel_slip ? (rover.wheel_slip * 100).toFixed(1) : '2.0';

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1E1E22]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#A1A1AA]">
          Rover Dynamics
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Nominal</span>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <div>
          <div className="text-[11px] text-[#71717A]">Position (X, Y)</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {(rover?.x ?? 50.0).toFixed(1)}m, {(rover?.y ?? 50.0).toFixed(1)}m
          </div>
        </div>

        <div>
          <div className="text-[11px] text-[#71717A]">Velocity</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {speed.toFixed(2)} <span className="text-[#71717A] text-xs">m/s</span>
          </div>
        </div>

        <div className="col-span-2 h-px bg-[#1E1E22]" />

        <div>
          <div className="text-[11px] text-[#71717A]">Heading</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {headingDeg.toFixed(1)}°
          </div>
        </div>

        <div>
          <div className="text-[11px] text-[#71717A]">Power</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                batteryPct > 50 ? 'bg-emerald-500' : batteryPct > 20 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
            <span>{batteryPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="col-span-2 h-px bg-[#1E1E22]" />

        <div>
          <div className="text-[11px] text-[#71717A]">Odometry</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {totalDist.toFixed(1)} m
          </div>
        </div>

        <div>
          <div className="text-[11px] text-[#71717A]">Target Range</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {distToTarget.toFixed(1)} m
          </div>
        </div>

        <div className="col-span-2 h-px bg-[#1E1E22]" />

        <div>
          <div className="text-[11px] text-[#71717A]">PNT Coverage</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {(metrics?.coverage_pct ?? 100.0).toFixed(1)}%
          </div>
        </div>

        <div>
          <div className="text-[11px] text-[#71717A]">Wheel Slip</div>
          <div className="text-sm font-medium text-[#F4F4F5] num-readout mt-0.5">
            {wheelSlip}%
          </div>
        </div>
      </div>
    </div>
  );
};
