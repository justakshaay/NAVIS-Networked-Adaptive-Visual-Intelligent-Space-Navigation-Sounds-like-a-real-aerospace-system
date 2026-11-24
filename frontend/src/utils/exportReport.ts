import { SimulationFullState } from '../types/simulation';

export interface DebriefSummary {
  missionDuration_s: number;
  totalFrames: number;
  activeMode: string;
  modeName: string;
  terrainPreset: string;
  meanError_m: number;
  peakError_m: number;
  meanUncertainty_m: number;
  satAvailability_pct: number;
  outageEventsCount: number;
  hazardsAvoided: number;
  totalDistance_m: number;
  batteryRemaining_pct: number;
  decisionLogs: Array<{
    time: string;
    met: string;
    category: string;
    message: string;
    level: string;
  }>;
}

/**
 * Computes consolidated mission performance metrics from recorded black-box frames.
 */
export function generateDebriefData(
  buffer: SimulationFullState[],
  currentState: SimulationFullState
): DebriefSummary {
  const frames = buffer.length > 0 ? buffer : [currentState];
  const totalFrames = frames.length;

  let totalErr = 0;
  let peakErr = 0;
  let totalUncert = 0;
  let pntFrames = 0;
  let outageCounter = 0;
  let wasOutage = false;

  for (const f of frames) {
    const rx = f.rover?.x ?? 0;
    const ry = f.rover?.y ?? 0;
    const ex = f.ekf?.est_x ?? rx;
    const ey = f.ekf?.est_y ?? ry;
    const err = Math.hypot(rx - ex, ry - ey);

    totalErr += err;
    if (err > peakErr) peakErr = err;

    totalUncert += f.ekf?.uncertainty_m ?? 0.5;

    const sats = f.satellites || [];
    const hasPnt = f.ekf?.pnt_active || sats.some((s) => s.is_visible && s.pnt_available);
    if (hasPnt) pntFrames++;

    const isOutage = sats.some((s) => s.is_outage) || Boolean(f.ekf?.fallback_active);
    if (isOutage && !wasOutage) {
      outageCounter++;
    }
    wasOutage = isOutage;
  }

  const hazardsAvoided =
    (currentState.terrain_summary?.injected_hazards?.length ?? 0) +
    (currentState.hazard_alert?.detected_count ?? 0);

  return {
    missionDuration_s: currentState.sim_time || 0,
    totalFrames,
    activeMode: currentState.active_mode,
    modeName: currentState.mode_meta?.name || currentState.active_mode,
    terrainPreset: currentState.terrain_preset || 'procedural',
    meanError_m: totalFrames > 0 ? totalErr / totalFrames : 0,
    peakError_m: peakErr,
    meanUncertainty_m: totalFrames > 0 ? totalUncert / totalFrames : 0,
    satAvailability_pct: totalFrames > 0 ? Math.round((pntFrames / totalFrames) * 100) : 100,
    outageEventsCount: outageCounter,
    hazardsAvoided,
    totalDistance_m: currentState.rover?.total_distance || 0,
    batteryRemaining_pct: currentState.rover?.battery_pct ?? 100,
    decisionLogs: (currentState.logs || []).slice(-30),
  };
}

/**
 * Downloads a structured CSV file of the recorded telemetry stream.
 */
export function exportTelemetryCsv(buffer: SimulationFullState[], currentState: SimulationFullState): void {
  const frames = buffer.length > 0 ? buffer : [currentState];

  const headers = [
    'MET_Seconds',
    'MET_Clock',
    'Nav_Mode',
    'Rover_Unit',
    'True_X_m',
    'True_Y_m',
    'Est_X_m',
    'Est_Y_m',
    'Localization_Error_m',
    'Uncertainty_2Sigma_m',
    'Speed_mps',
    'Heading_deg',
    'Battery_pct',
    'Wheel_Slip',
    'Visible_Sats',
    'PNT_Lock_Active',
    'Dust_Storm_Status',
    'Hazards_Avoided_Count',
  ];

  const rows = frames.map((f) => {
    const rx = f.rover?.x ?? 0;
    const ry = f.rover?.y ?? 0;
    const ex = f.ekf?.est_x ?? rx;
    const ey = f.ekf?.est_y ?? ry;
    const err = Math.hypot(rx - ex, ry - ey);

    const simTime = f.sim_time || 0;
    const metMin = Math.floor(simTime / 60);
    const metSec = Math.floor(simTime % 60);
    const metClock = `MET+${String(metMin).padStart(2, '0')}:${String(metSec).padStart(2, '0')}`;

    const sats = f.satellites || [];
    const visSats = sats.filter((s) => s.is_visible && !s.is_outage).length;
    const stormStatus = f.dust_storm?.active
      ? f.dust_storm.rover_in_storm
        ? 'IN_STORM'
        : 'VICINITY'
      : 'NONE';

    const hzCount =
      (f.terrain_summary?.injected_hazards?.length ?? 0) +
      (f.hazard_alert?.detected_count ?? 0);

    return [
      simTime.toFixed(2),
      metClock,
      f.active_mode,
      f.swarm_mode_enabled ? 'SWARM_3X' : 'NAVIS-01',
      rx.toFixed(2),
      ry.toFixed(2),
      ex.toFixed(2),
      ey.toFixed(2),
      err.toFixed(3),
      (f.ekf?.uncertainty_m ?? 0.5).toFixed(3),
      (f.rover?.speed ?? 0).toFixed(2),
      (f.rover?.heading_deg ?? 0).toFixed(1),
      (f.rover?.battery_pct ?? 100).toFixed(1),
      (f.rover?.wheel_slip ?? 0).toFixed(3),
      visSats,
      f.ekf?.pnt_active ? 'TRUE' : 'FALSE',
      stormStatus,
      hzCount,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `navis_mission_telemetry_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
