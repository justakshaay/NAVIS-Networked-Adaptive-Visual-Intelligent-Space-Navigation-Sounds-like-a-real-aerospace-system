import React from 'react';
import { Play, Pause, RotateCcw, Zap, ZapOff, AlertOctagon, FastForward, Cpu, Compass, Swords, Wind } from 'lucide-react';
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
  onToggleDustStorm?: () => void;
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
  onToggleDustStorm,
}) => {
  const isRunning = state?.is_running || false;
  const isOutage = state?.satellites.some((s) => s.is_outage) || false;
  const currentSpeed = state?.speed_multiplier || 1.0;
  const currentMode = state?.active_mode || 'MODE_C';
  const isShadowRace = state?.shadow_race_enabled || false;
  const isDustStorm = state?.dust_storm?.active || false;

  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0F1217]/95 backdrop-blur-md border border-[#21262D] rounded-[2px] shadow-panel font-mono text-xs select-none max-w-full">
      {/* 1. PLAYBACK GROUP */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[#8B949E] px-1 font-semibold hidden sm:inline">
          PLAYBACK:
        </span>

        {!isRunning ? (
          <button
            onClick={onStart}
            className="btn-control bg-[#2EA043]/15 text-[#2EA043] border-[#2EA043]/60 hover:bg-[#2EA043]/25 font-bold transition-colors duration-150"
            title="Start / Resume 20Hz Simulation"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>START</span>
          </button>
        ) : (
          <button
            onClick={onPause}
            className="btn-control bg-[#D29922]/15 text-[#D29922] border-[#D29922]/60 hover:bg-[#D29922]/25 font-bold transition-colors duration-150"
            title="Pause Simulation"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>PAUSE</span>
          </button>
        )}

        <button
          onClick={onReset}
          className="btn-control hover:text-[#E6EDF3] transition-colors duration-150"
          title="Reset Simulation State to Origin"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET</span>
        </button>

        {/* Speed Multipliers */}
        <div className="flex items-center bg-[#080A0D] border border-[#21262D] rounded-[2px] p-0.5">
          {[1.0, 2.0, 5.0].map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeed(spd)}
              className={`px-1.5 py-0.5 rounded-[2px] text-[10px] tabular-nums font-semibold transition-colors duration-150 ${
                currentSpeed === spd
                  ? 'bg-[#58A6FF] text-[#080A0D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
              title={`Set Simulation Speed to ${spd}x`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Hairline Divider */}
      <div className="w-[1px] h-6 bg-[#21262D] mx-0.5" />

      {/* 2. NAVIGATION ARCHITECTURE GROUP / SHADOW RACE */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[#8B949E] px-1 font-semibold hidden md:inline">
          NAV MODE:
        </span>

        {isShadowRace ? (
          /* Locked Comparison Badge when Shadow Race is Active */
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F85149]/15 border border-[#F85149] text-[#F85149] rounded-[2px] font-bold text-[10px] tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F85149] animate-pulse" />
            <span>RACE LOCKED: MODE A vs MODE C</span>
          </div>
        ) : (
          /* Normal Mode A/B/C Switcher */
          <div className="flex items-center bg-[#080A0D] border border-[#21262D] rounded-[2px] p-0.5 gap-0.5">
            <button
              onClick={() => onMode('MODE_A')}
              className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold transition-colors duration-150 ${
                currentMode === 'MODE_A'
                  ? 'bg-[#21262D] text-[#D29922] border border-[#D29922]/40'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
              title="Mode A: Pure onboard dead reckoning without satellites (IMU + VO + Wheel Odometry). Demonstrates unbounded drift."
            >
              MODE A: DEAD RECKON
            </button>

            <button
              onClick={() => onMode('MODE_B')}
              className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold transition-colors duration-150 ${
                currentMode === 'MODE_B'
                  ? 'bg-[#21262D] text-[#E6EDF3] border border-[#30363D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
              title="Mode B: Single fixed satellite (SAT-01) PNT. Suffers from periodic orbital blindspots and lacks proactive forward hazard reconnaissance."
            >
              MODE B: FIXED SAT
            </button>

            <button
              onClick={() => onMode('MODE_C')}
              className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold transition-colors duration-150 ${
                currentMode === 'MODE_C'
                  ? 'bg-[#58A6FF] text-[#080A0D]'
                  : 'text-[#58A6FF] hover:bg-[#58A6FF]/10'
              }`}
              title="Mode C: NAVIS Adaptive AI. Full 4-satellite dynamic scheduling + EKF sensor fusion + ML polynomial trajectory projection + A* replanning."
            >
              MODE C: NAVIS AI ★
            </button>
          </div>
        )}

        {/* Shadow Race (A vs C) Toggle Button */}
        {onToggleShadowRace && (
          <button
            onClick={onToggleShadowRace}
            className={`btn-control font-bold transition-colors duration-150 ${
              isShadowRace
                ? 'bg-[#F85149] text-[#080A0D] border-[#F85149]'
                : 'bg-[#161B22] text-[#F85149] border-[#F85149]/60 hover:bg-[#F85149]/15'
            }`}
            title="Launch simultaneous Mode A (Dead Reckon) vs Mode C (NAVIS AI) live race on identical terrain"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>{isShadowRace ? 'EXIT RACE' : 'SHADOW RACE (A vs C)'}</span>
          </button>
        )}
      </div>

      {/* Hairline Divider */}
      <div className="w-[1px] h-6 bg-[#21262D] mx-0.5" />

      {/* 3. FAULT INJECTION GROUP */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[#8B949E] px-1 font-semibold hidden xl:inline">
          FAULTS:
        </span>

        {/* Hazard Crosshair Trigger */}
        <button
          onClick={onToggleHazardMode}
          className={`btn-control transition-colors duration-150 ${
            isHazardModeActive
              ? 'bg-[#D29922] text-[#080A0D] border-[#D29922] font-bold'
              : 'text-[#D29922] border-[#D29922]/50 hover:bg-[#D29922]/15'
          }`}
          title="Toggle interactive map hazard placement mode to test dynamic A* obstacle avoidance"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>{isHazardModeActive ? 'CROSSHAIR ACTIVE' : 'INJECT HAZARD'}</span>
        </button>

        {/* Dust Storm Fault Trigger */}
        {onToggleDustStorm && (
          <button
            onClick={onToggleDustStorm}
            className={`btn-control transition-colors duration-150 ${
              isDustStorm
                ? 'bg-[#D29922] text-[#080A0D] border-[#D29922] font-bold animate-pulse'
                : 'text-[#D29922] border-[#D29922]/50 hover:bg-[#D29922]/15'
            }`}
            title="Inject dynamic moving Martian dust storm fault across the terrain (degrades Visual Odometry)"
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{isDustStorm ? 'STORM ACTIVE' : 'DUST STORM'}</span>
          </button>
        )}

        {/* Satellite Outage / Restore */}
        {!isOutage ? (
          <button
            onClick={onOutage}
            className="btn-control text-[#F85149] border-[#F85149]/50 hover:bg-[#F85149]/15 transition-colors duration-150"
            title="Trigger total constellation communication & PNT blackout to test autonomous fallback"
          >
            <ZapOff className="w-3.5 h-3.5" />
            <span>SAT OUTAGE</span>
          </button>
        ) : (
          <button
            onClick={onRestore}
            className="btn-control bg-[#2EA043]/20 text-[#2EA043] border-[#2EA043] font-bold animate-pulse hover:bg-[#2EA043]/30 transition-colors duration-150"
            title="Restore Satellite Constellation PNT Link"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>RESTORE PNT</span>
          </button>
        )}
      </div>
    </div>
  );
};
