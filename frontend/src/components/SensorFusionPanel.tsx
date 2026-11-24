import React from 'react';
import { Layers, ShieldCheck, AlertTriangle, Target, Gauge, Check, X } from 'lucide-react';
import { EKFState, SensorSuiteState, PerformanceMetricsState } from '../types/simulation';

interface SensorFusionPanelProps {
  ekf: EKFState | null;
  sensors: SensorSuiteState | null;
  metrics: PerformanceMetricsState | null;
  truePos: { x: number; y: number; speed: number; heading_deg: number };
}

export const SensorFusionPanel: React.FC<SensorFusionPanelProps> = ({
  ekf,
  sensors,
  metrics,
  truePos,
}) => {
  const isFallback = ekf?.fallback_active || false;
  const pntActive = sensors?.pnt?.active || false;
  const posError = metrics?.position_error_instant_m || metrics?.current_position_error_m || 0.0;
  const uncertainty = ekf?.uncertainty_m || 0.5;

  return (
    <div className="panel-matte flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span>SENSOR FUSION & EKF ESTIMATOR</span>
        </div>
        <div>
          {isFallback ? (
            <span className="text-[#F85149] text-[9px] font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> FALLBACK
            </span>
          ) : (
            <span className="text-[#2EA043] text-[9px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> PNT LOCKED
            </span>
          )}
        </div>
      </div>

      <div className="p-2 flex flex-col gap-2 font-mono">
        {/* Sensor Health Matrix */}
        <div className="grid grid-cols-4 gap-1">
          {/* Satellite PNT */}
          <div
            className={`px-2 py-1 rounded-[2px] border text-[10px] flex items-center justify-between ${
              pntActive
                ? 'bg-[#080A0D] border-[#2EA043]/50 text-[#2EA043]'
                : 'bg-[#080A0D] border-[#F85149]/50 text-[#F85149]'
            }`}
          >
            <span>PNT</span>
            {pntActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          </div>

          {/* IMU */}
          <div className="px-2 py-1 rounded-[2px] border bg-[#080A0D] border-[#21262D] text-[#2EA043] text-[10px] flex items-center justify-between">
            <span>IMU</span>
            <Check className="w-3 h-3" />
          </div>

          {/* Visual Odometry */}
          <div className="px-2 py-1 rounded-[2px] border bg-[#080A0D] border-[#21262D] text-[#2EA043] text-[10px] flex items-center justify-between">
            <span>VO CAM</span>
            <Check className="w-3 h-3" />
          </div>

          {/* Wheel Odometry */}
          <div className="px-2 py-1 rounded-[2px] border bg-[#080A0D] border-[#21262D] text-[#2EA043] text-[10px] flex items-center justify-between">
            <span>W-ODOM</span>
            <Check className="w-3 h-3" />
          </div>
        </div>

        {/* Fallback Warning Flag */}
        {isFallback && (
          <div className="p-1.5 rounded-[2px] bg-[#F85149]/10 border border-[#F85149] text-[#F85149] text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <div className="leading-tight">
              <span className="font-bold">AUTONOMOUS DEAD RECKONING ACTIVE:</span> PNT denied. Propagating state covariance via IMU + VO + Wheel Odom.
            </div>
          </div>
        )}

        {/* Position Error & Uncertainty Cards */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="telemetry-cell">
            <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
              <Target className="w-2.5 h-2.5 text-[#58A6FF]" /> LOCALIZATION ERROR
            </div>
            <div className="text-base font-semibold text-[#E6EDF3] num-readout mt-0.5 flex items-baseline gap-1">
              <span>{posError.toFixed(2)}</span>
              <span className="text-[10px] text-[#8B949E]">m</span>
            </div>
            <div className="text-[8px] text-[#6E7681]">|TRUE - EST|</div>
          </div>

          <div className="telemetry-cell">
            <div className="text-[9px] uppercase tracking-wider text-[#8B949E] flex items-center gap-1">
              <Gauge className="w-2.5 h-2.5 text-[#D29922]" /> UNCERTAINTY (2σ)
            </div>
            <div
              className={`text-base font-semibold num-readout mt-0.5 flex items-baseline gap-1 ${
                uncertainty > 2.5 ? 'text-[#D29922]' : 'text-[#2EA043]'
              }`}
            >
              <span>{uncertainty.toFixed(2)}</span>
              <span className="text-[10px] text-[#8B949E]">m</span>
            </div>
            <div className="text-[8px] text-[#6E7681]">COVARIANCE TRACE</div>
          </div>
        </div>

        {/* 8-DOF State Vector Table */}
        <div className="telemetry-cell text-[11px] space-y-1">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[#8B949E] border-b border-[#21262D] pb-1">
            ESTIMATED 8-DOF STATE VECTOR
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8B949E]">EST POS (X, Y):</span>
            <span className="text-[#E6EDF3] font-semibold num-readout">
              {(ekf?.est_x ?? truePos.x ?? 50.0).toFixed(2)}m, {(ekf?.est_y ?? truePos.y ?? 50.0).toFixed(2)}m
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8B949E]">EST VEL (Vx, Vy):</span>
            <span className="text-[#E6EDF3] num-readout">
              {(ekf?.est_vx ?? 0.0).toFixed(2)}m/s, {(ekf?.est_vy ?? 0.0).toFixed(2)}m/s
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#8B949E]">EST HEADING (θ):</span>
            <span className="text-[#E6EDF3] num-readout">{(ekf?.est_heading_deg ?? truePos.heading_deg ?? 0.0).toFixed(1)}°</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#6E7681] pt-1 border-t border-[#21262D]">
            <span>IMU ACC BIAS:</span>
            <span className="num-readout">{(ekf?.bias_estimates?.b_ax ?? 0.04).toFixed(4)} m/s²</span>
          </div>
        </div>
      </div>
    </div>
  );
};
