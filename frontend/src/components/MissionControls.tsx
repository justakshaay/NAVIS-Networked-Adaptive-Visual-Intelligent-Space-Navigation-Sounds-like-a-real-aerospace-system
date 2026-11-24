import React from 'react';
import { Play, Pause, RotateCcw, Zap, ZapOff, AlertOctagon, Swords, Wind, Users, History } from 'lucide-react';
import { SimulationFullState } from '../types/simulation';
import { Tooltip } from './Tooltip';

interface MissionControlsProps {
  state: SimulationFullState | null;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeed: (multiplier: number) => void;
  onMode: (mode: 'MODE_A' | 'MODE_B' | 'MODE_C') => void;
  onOutage: () => void;
  onRestore: () => void;
  onToggleHazardMode: () => void;
  isHazardModeActive: boolean;
  onToggleShadowRace?: () => void;
  onToggleSwarmMode?: () => void;
  onToggleDustStorm?: () => void;
  isReplayOpen?: boolean;
  isReplaying?: boolean;
  onToggleReplay?: () => void;
  onRunDemo: () => void;
}

export const MissionControls: React.FC<MissionControlsProps> = ({
  state,
  onStart,
  onPause,
  onReset,
  onSpeed,
  onMode,
  onOutage,
  onRestore,
  onToggleHazardMode,
  isHazardModeActive,
  onToggleShadowRace,
  onToggleSwarmMode,
  onToggleDustStorm,
  isReplayOpen = false,
  isReplaying = false,
  onToggleReplay,
}) => {
  const isRunning = state?.is_running || false;
  const isOutage = state?.satellites.some((s) => s.is_outage) || false;
  const currentSpeed = state?.speed_multiplier || 1.0;
  const currentMode = state?.active_mode || 'MODE_C';
  const isShadowRace = state?.shadow_race_enabled || false;
  const isSwarmMode = state?.swarm_mode_enabled || false;
  const isDustStorm = state?.dust_storm?.active || false;

  return (
    <div className="w-full bg-[#0C0C0E] border-t border-[#222226] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
      {/* Left: Playback & Speed */}
      <div className="flex items-center gap-1.5">
        {!isRunning ? (
          <Tooltip
            title="Start Simulation (Space)"
            description="Begins or resumes the 20Hz rover physics, EKF, and orbital simulation loop."
            position="top"
            align="left"
          >
            <button
              onClick={onStart}
              className="btn-control bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start</span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            title="Pause Simulation (Space)"
            description="Freezes the simulation clock while keeping telemetry and map inspection interactive."
            position="top"
            align="left"
          >
            <button
              onClick={onPause}
              className="btn-control bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </button>
          </Tooltip>
        )}

        <Tooltip
          title="Reset Mission (R)"
          description="Returns the rover to origin, clears injected faults, and resets MET to 00:00."
          position="top"
          align="left"
        >
          <button
            onClick={() => onReset()}
            className="btn-control"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </Tooltip>

        {/* Speed Segmented Control */}
        <div className="flex items-center bg-[#09090B] border border-[#222226] rounded-md p-0.5 ml-1">
          {[1.0, 2.0, 5.0].map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeed(spd)}
              className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] tabular-nums transition-colors ${
                currentSpeed === spd
                  ? 'bg-[#F4F4F5] text-[#09090B] font-medium'
                  : 'text-[#71717A] hover:text-[#F4F4F5]'
              }`}
              title={`Set speed to ${spd}x`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Center: Mode & Multi-Agent Toggles */}
      <div className="flex items-center gap-1.5">
        {!isShadowRace && !isSwarmMode && (
          <div className="flex items-center bg-[#09090B] border border-[#222226] rounded-md p-0.5">
            {[
              {
                id: 'MODE_A' as const,
                label: 'Mode A: DR',
                title: 'Mode A: Dead Reckoning',
                desc: 'Dead Reckoning only — relies on wheel odometry and IMU, accumulating drift over distance.',
              },
              {
                id: 'MODE_B' as const,
                label: 'Mode B: EKF',
                title: 'Mode B: Fixed Satellite EKF',
                desc: 'Extended Kalman Filter fusing odometry, IMU, and periodic single-satellite fixes.',
              },
              {
                id: 'MODE_C' as const,
                label: 'Mode C: NAVIS AI',
                title: 'Mode C: NAVIS Autonomous AI',
                desc: 'Full autonomous stack: EKF sensor fusion + AI satellite scheduler + predictive A* hazard avoidance.',
              },
            ].map((m) => (
              <Tooltip
                key={m.id}
                title={m.title}
                description={m.desc}
                position="top"
                align="center"
              >
                <button
                  onClick={() => onMode(m.id)}
                  className={`px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                    currentMode === m.id
                      ? 'bg-[#F4F4F5] text-[#09090B]'
                      : 'text-[#71717A] hover:text-[#F4F4F5]'
                  }`}
                >
                  {m.label}
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {onToggleShadowRace && (
          <Tooltip
            title="Shadow Race (S)"
            description="Spawns a Mode A (Dead Reckoning) ghost rover alongside NAVIS to compare drift and path accuracy in real time."
            position="top"
            align="center"
          >
            <button
              onClick={onToggleShadowRace}
              className={`btn-control ${
                isShadowRace
                  ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                  : ''
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Shadow Race</span>
            </button>
          </Tooltip>
        )}

        {onToggleSwarmMode && (
          <Tooltip
            title="Multi-Rover Swarm (M)"
            description="Deploys a multi-rover fleet sharing hazard detections and coordinated pathfinding across the sector."
            position="top"
            align="center"
          >
            <button
              onClick={onToggleSwarmMode}
              className={`btn-control ${
                isSwarmMode
                  ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                  : ''
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Swarm</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Right: Fault Injectors */}
      <div className="flex items-center gap-1.5">
        <Tooltip
          title="Inject Hazard"
          description="Click anywhere on the 2D or 3D map to drop a rock-field obstacle and trigger live A* replanning."
          position="top"
          align="right"
        >
          <button
            onClick={onToggleHazardMode}
            className={`btn-control ${
              isHazardModeActive
                ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                : ''
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{isHazardModeActive ? 'Click Map' : 'Hazard'}</span>
          </button>
        </Tooltip>

        {onToggleDustStorm && (
          <Tooltip
            title="Dust Storm (D)"
            description="Simulates a Martian dust storm that degrades visual odometry and increases sensor noise."
            position="top"
            align="right"
          >
            <button
              onClick={onToggleDustStorm}
              className={`btn-control ${
                isDustStorm
                  ? 'bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]'
                  : ''
              }`}
            >
              {isDustStorm && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              <Wind className="w-3.5 h-3.5" />
              <span>Dust Storm</span>
            </button>
          </Tooltip>
        )}

        {!isOutage ? (
          <Tooltip
            title="Satellite Outage (O)"
            description="Cuts orbital satellite locks to test EKF dead-reckoning resilience and recovery."
            position="top"
            align="right"
          >
            <button
              onClick={onOutage}
              className="btn-control"
            >
              <ZapOff className="w-3.5 h-3.5" />
              <span>Sat Outage</span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            title="Restore Satellite Link (O)"
            description="Re-establishes orbital PNT lock to collapse accumulated EKF covariance uncertainty."
            position="top"
            align="right"
          >
            <button
              onClick={onRestore}
              className="btn-control bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <Zap className="w-3.5 h-3.5" />
              <span>Restore Sat</span>
            </button>
          </Tooltip>
        )}

        {onToggleReplay && (
          <Tooltip
            title="Black-Box Replay"
            description="Toggle the black-box telemetry timeline to scrub through past mission frames."
            position="top"
            align="right"
          >
            <button
              onClick={onToggleReplay}
              className={`btn-control ${
                isReplayOpen || isReplaying
                  ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                  : ''
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Replay</span>
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
