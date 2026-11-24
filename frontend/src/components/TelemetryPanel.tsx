import React from 'react';
import { Activity, Battery, Gauge, Compass, MapPin, Radio, ShieldCheck, Zap } from 'lucide-react';
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

  const getBatteryColor = (pct: number) => {
    if (pct > 50) return 'text-[#2EA043]';
    if (pct > 20) return 'text-[#D29922]';
    return 'text-[#F85149]';
  };

  return (
    <div className="panel-matte flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span>ROVER TELEMETRY / DYNAMICS</span>
        </div>
        <span className="text-[9px] text-[#2EA043]">NOMINAL</span>
      </div>

      <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono">
        {/* Position */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 text-[#58A6FF]" /> POS (X, Y)
          </div>
          <div className="text-sm font-semibold text-[#E6EDF3] num-readout mt-0.5">
            {(rover?.x ?? 50.0).toFixed(1)}m, {(rover?.y ?? 50.0).toFixed(1)}m
          </div>
          <div className="text-[8px] text-[#6E7681]">GRID COORD</div>
        </div>

        {/* Speed */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
            <Gauge className="w-2.5 h-2.5 text-[#2EA043]" /> VELOCITY
          </div>
          <div className="text-sm font-semibold text-[#E6EDF3] num-readout mt-0.5 flex items-baseline gap-1">
            <span>{speed.toFixed(2)}</span>
            <span className="text-[10px] text-[#8B949E]">m/s</span>
          </div>
          <div className="text-[8px] text-[#6E7681]">MAX 3.5 m/s</div>
        </div>

        {/* Heading Azimuth */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
            <Compass className="w-2.5 h-2.5 text-[#D29922]" /> HEADING (YAW)
          </div>
          <div className="text-sm font-semibold text-[#E6EDF3] num-readout mt-0.5">
            {headingDeg.toFixed(1)}°
          </div>
          <div className="text-[8px] text-[#6E7681]">TRUE AZIMUTH</div>
        </div>

        {/* Battery */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
            <Battery className="w-2.5 h-2.5 text-[#58A6FF]" /> POWER PACK
          </div>
          <div className={`text-sm font-semibold num-readout mt-0.5 flex items-baseline gap-1 ${getBatteryColor(batteryPct)}`}>
            <span>{batteryPct.toFixed(1)}</span>
            <span className="text-[10px] text-[#8B949E]">%</span>
          </div>
          <div className="text-[8px] text-[#6E7681]">SOLAR BUS</div>
        </div>

        {/* Traveled Distance */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E]">ODOMETRY DIST</div>
          <div className="text-sm font-semibold text-[#E6EDF3] num-readout mt-0.5">
            {totalDist.toFixed(1)} m
          </div>
          <div className="text-[8px] text-[#6E7681]">TOTAL ROLL</div>
        </div>

        {/* Target Range */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E]">TARGET RANGE</div>
          <div className="text-sm font-semibold text-[#2EA043] num-readout mt-0.5">
            {distToTarget.toFixed(1)} m
          </div>
          <div className="text-[8px] text-[#6E7681]">VECTOR TO GO</div>
        </div>

        {/* Constellation Window Coverage */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-[#58A6FF]" /> PNT COVERAGE
          </div>
          <div className="text-sm font-semibold text-[#58A6FF] num-readout mt-0.5">
            {(metrics?.coverage_pct ?? 100.0).toFixed(1)}%
          </div>
          <div className="text-[8px] text-[#6E7681]">WINDOW PCT</div>
        </div>

        {/* Wheel Slip Index */}
        <div className="telemetry-cell">
          <div className="text-[9px] uppercase tracking-wider text-[#8B949E]">WHEEL SLIP</div>
          <div
            className={`text-sm font-semibold num-readout mt-0.5 ${
              Number(wheelSlip) > 15 ? 'text-[#D29922]' : 'text-[#E6EDF3]'
            }`}
          >
            {wheelSlip}%
          </div>
          <div className="text-[8px] text-[#6E7681]">TERRAIN SLIP</div>
        </div>
      </div>
    </div>
  );
};
