import React from 'react';
import { Play, Pause, RotateCcw, Zap, ZapOff, AlertOctagon, Swords, Wind, Users, History } from 'lucide-react';
import { SimulationFullState } from '../types/simulation';

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
          <button
            onClick={onStart}
            className="btn-control bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]"
            title="Start / Resume (Space)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start</span>
          </button>
        ) : (
          <button
            onClick={onPause}
            className="btn-control bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]"
            title="Pause (Space)"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        )}

        <button
          onClick={() => onReset()}
          className="btn-control"
          title="Reset Simulation (R)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>

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
              { id: 'MODE_A' as const, label: 'Mode A' },
              { id: 'MODE_B' as const, label: 'Mode B' },
              { id: 'MODE_C' as const, label: 'Mode C' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onMode(m.id)}
                className={`px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                  currentMode === m.id
                    ? 'bg-[#F4F4F5] text-[#09090B]'
                    : 'text-[#71717A] hover:text-[#F4F4F5]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {onToggleShadowRace && (
          <button
            onClick={onToggleShadowRace}
            className={`btn-control ${
              isShadowRace
                ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                : ''
            }`}
            title="Shadow Race: Mode A vs Mode C (S)"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Shadow Race</span>
          </button>
        )}

        {onToggleSwarmMode && (
          <button
            onClick={onToggleSwarmMode}
            className={`btn-control ${
              isSwarmMode
                ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                : ''
            }`}
            title="3-Rover Swarm Mode (M)"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Swarm</span>
          </button>
        )}
      </div>

      {/* Right: Fault Injectors */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleHazardMode}
          className={`btn-control ${
            isHazardModeActive
              ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
              : ''
          }`}
          title="Click map to inject hazard"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>{isHazardModeActive ? 'Click Map' : 'Hazard'}</span>
        </button>

        {onToggleDustStorm && (
          <button
            onClick={onToggleDustStorm}
            className={`btn-control ${
              isDustStorm
                ? 'bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]'
                : ''
            }`}
            title="Toggle Dust Storm (D)"
          >
            {isDustStorm && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            <Wind className="w-3.5 h-3.5" />
            <span>Dust Storm</span>
          </button>
        )}

        {!isOutage ? (
          <button
            onClick={onOutage}
            className="btn-control"
            title="Trigger Satellite Outage (O)"
          >
            <ZapOff className="w-3.5 h-3.5" />
            <span>Sat Outage</span>
          </button>
        ) : (
          <button
            onClick={onRestore}
            className="btn-control bg-[#1C1C21] text-[#F4F4F5] border-[#3F3F46]"
            title="Restore Satellite Link (O)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <Zap className="w-3.5 h-3.5" />
            <span>Restore Sat</span>
          </button>
        )}

        {onToggleReplay && (
          <button
            onClick={onToggleReplay}
            className={`btn-control ${
              isReplayOpen || isReplaying
                ? 'bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]'
                : ''
            }`}
            title="Toggle Telemetry Black-Box Replay"
          >
            <History className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>
        )}
      </div>
    </div>
  );
};
