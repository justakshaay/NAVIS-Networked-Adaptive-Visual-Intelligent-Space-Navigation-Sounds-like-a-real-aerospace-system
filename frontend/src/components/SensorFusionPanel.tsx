import React from 'react';
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
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1E1E22]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#A1A1AA]">
          Sensor Fusion & EKF
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isFallback ? 'bg-red-500' : 'bg-emerald-500'}`}
          />
          <span>{isFallback ? 'Fallback' : 'PNT Locked'}</span>
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Flat Sensor Health Strip */}
        <div className="flex items-center justify-between text-xs py-1">
          {[
            { label: 'PNT', ok: pntActive },
            { label: 'IMU', ok: true },
            { label: 'VO Cam', ok: true },
            { label: 'W-Odom', ok: true },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[#A1A1AA]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
              <span className={s.ok ? 'text-[#F4F4F5]' : 'text-[#71717A]'}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Subtle Left-Accent Fallback Notice */}
        {isFallback && (
          <div className="px-3 py-2 border-l-2 border-red-500/80 bg-[#141417] text-xs text-[#A1A1AA] leading-relaxed">
            <span className="text-[#F4F4F5] font-medium">Autonomous Dead Reckoning:</span> PNT denied. Propagating EKF covariance via IMU, VO & wheel odometry.
          </div>
        )}

        <div className="h-px bg-[#1E1E22]" />

        {/* Position Error & Uncertainty */}
        <div className="grid grid-cols-2 gap-x-6">
          <div>
            <div className="text-[11px] text-[#71717A]">Localization Error</div>
            <div className="text-base font-medium text-[#F4F4F5] num-readout mt-0.5">
              {posError.toFixed(2)} <span className="text-[#71717A] text-xs">m</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#71717A]">Uncertainty (2σ)</div>
            <div className="text-base font-medium text-[#F4F4F5] num-readout mt-0.5 flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  uncertainty > 2.5 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span>±{uncertainty.toFixed(2)}</span>
              <span className="text-[#71717A] text-xs">m</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[#1E1E22]" />

        {/* 8-DOF State Vector Key-Value Rows */}
        <div className="space-y-2 text-xs">
          <div className="text-[11px] text-[#71717A] uppercase tracking-wider">
            8-DOF State Vector
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#71717A]">Est. Position</span>
            <span className="text-[#F4F4F5] font-medium num-readout">
              {(ekf?.est_x ?? truePos.x ?? 50.0).toFixed(2)}m, {(ekf?.est_y ?? truePos.y ?? 50.0).toFixed(2)}m
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#71717A]">Est. Velocity</span>
            <span className="text-[#F4F4F5] num-readout">
              {(ekf?.est_vx ?? 0.0).toFixed(2)}, {(ekf?.est_vy ?? 0.0).toFixed(2)} m/s
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#71717A]">Est. Heading</span>
            <span className="text-[#F4F4F5] num-readout">
              {(ekf?.est_heading_deg ?? truePos.heading_deg ?? 0.0).toFixed(1)}°
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-[#1E1E22]">
            <span className="text-[#71717A]">IMU Acc Bias</span>
            <span className="text-[#A1A1AA] num-readout">
              {(ekf?.bias_estimates?.b_ax ?? 0.04).toFixed(4)} m/s²
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
