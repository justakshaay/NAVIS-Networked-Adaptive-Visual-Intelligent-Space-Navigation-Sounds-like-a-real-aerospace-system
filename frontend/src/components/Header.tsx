import React, { useState, useEffect } from 'react';
import { Radio, ShieldCheck, Activity, Compass, Cpu, AlertTriangle, PlayCircle, Bot, Swords } from 'lucide-react';
import { SimulationFullState } from '../types/simulation';

interface HeaderProps {
  state: SimulationFullState | null;
  connected: boolean;
  onOpenBenchmark: () => void;
  isDemoActive?: boolean;
  onToggleDemoGuide?: () => void;
  onStartDemo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  connected,
  onOpenBenchmark,
  isDemoActive = false,
  onToggleDemoGuide,
  onStartDemo,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const metMinutes = state ? Math.floor(state.sim_time / 60) : 0;
  const metSeconds = state ? Math.floor(state.sim_time % 60) : 0;
  const metString = `MET +${String(metMinutes).padStart(2, '0')}:${String(metSeconds).padStart(2, '0')}`;

  const currentMode = state?.active_mode || 'MODE_C';

  return (
    <header className="h-[44px] w-full bg-[#0F1217] border-b border-[#21262D] px-3 flex items-center justify-between gap-3 select-none shrink-0 z-30 font-mono">
      {/* Brand & Subsystem Ident */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 bg-[#161B22] border border-[#58A6FF]/40 rounded-[2px]">
          <span className="font-mono font-bold text-xs text-[#58A6FF]">NV</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-wider text-[#E6EDF3]">
            NAVIS
          </span>
          <span className="text-[10px] text-[#8B949E] border border-[#21262D] bg-[#161B22] px-1.5 py-0.5 rounded-[2px]">
            GNC-SYS v2.4
          </span>
          <span className="hidden lg:inline-block text-[11px] text-[#8B949E] tracking-tight">
            / MARS AUTONOMOUS FLIGHT CONTROL
          </span>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-2">
        {/* Active Mode Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#161B22] border border-[#21262D] rounded-[2px] text-[11px]">
          <span className="text-[10px] text-[#8B949E]">ARCH:</span>
          <span
            className={`font-bold ${
              currentMode === 'MODE_C'
                ? 'text-[#58A6FF]'
                : currentMode === 'MODE_B'
                ? 'text-[#E6EDF3]'
                : 'text-[#D29922]'
            }`}
          >
            {state?.mode_meta.tag || (currentMode === 'MODE_C' ? 'ADAPTIVE AI' : currentMode)}
          </span>
        </div>

        {/* Autonomous Fallback Warning Flag */}
        {state?.ekf.fallback_active && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#F85149]/15 border border-[#F85149] rounded-[2px] text-[11px] text-[#F85149] animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-bold">AUTONOMOUS FALLBACK</span>
          </div>
        )}

        {/* Shadow Race Active Badge */}
        {state?.shadow_race_enabled && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#F85149]/20 border border-[#F85149] rounded-[2px] text-[11px] text-[#F85149] font-bold">
            <Swords className="w-3.5 h-3.5" />
            <span>RACE: MODE A vs C</span>
          </div>
        )}

        {/* Rover Physical Status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 bg-[#161B22] border border-[#21262D] rounded-[2px] text-[11px]">
          <Compass className="w-3.5 h-3.5 text-[#2EA043]" />
          <span className="text-[#8B949E]">STATUS:</span>
          <span className="text-[#E6EDF3] font-semibold tabular-nums">
            {state?.rover.mission_status || 'INITIALIZING'}
          </span>
        </div>
      </div>

      {/* Right Action Trigger Buttons & Telemetry Clocks */}
      <div className="flex items-center gap-2 text-xs">
        {/* MET Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[#161B22] border border-[#21262D] rounded-[2px]">
          <Activity className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span className="text-[#8B949E] text-[10px]">MET:</span>
          <span className="text-[#E6EDF3] font-semibold tabular-nums">{metString}</span>
        </div>

        {/* UTC Clock */}
        <div className="hidden md:block px-2 py-0.5 bg-[#161B22] border border-[#21262D] rounded-[2px] text-[#8B949E] text-[11px] tabular-nums">
          {utcTime}
        </div>

        {/* Prominent Demo Guide Trigger for Judges */}
        {isDemoActive ? (
          <button
            onClick={onToggleDemoGuide}
            className="btn-control bg-[#58A6FF]/15 border-[#58A6FF] text-[#58A6FF] font-semibold transition-colors duration-150"
            title="Toggle Demo Mission Stage HUD"
          >
            <Bot className="w-3.5 h-3.5 animate-pulse" />
            <span>DEMO HUD</span>
          </button>
        ) : onStartDemo ? (
          <button
            onClick={onStartDemo}
            className="btn-control bg-[#161B22] border-[#58A6FF]/60 text-[#58A6FF] hover:bg-[#58A6FF]/15 font-semibold transition-colors duration-150"
            title="Launch automated 15-stage demonstration mission for judges"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>GUIDED DEMO</span>
          </button>
        ) : null}

        {/* Prominent Benchmark Modes Button for Judges */}
        <button
          onClick={onOpenBenchmark}
          className="btn-control bg-[#BC8CFF]/15 border-[#BC8CFF]/70 text-[#BC8CFF] hover:bg-[#BC8CFF]/25 font-semibold transition-colors duration-150"
          title="Open head-to-head performance benchmark comparing Mode A, B, and C"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#BC8CFF]" />
          <span>COMPARE MODES</span>
        </button>

        {/* Telemetry Stream Heartbeat */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#161B22] border border-[#21262D] rounded-[2px] text-[11px]">
          <span
            className={`w-2 h-2 rounded-[1px] ${
              connected ? 'bg-[#2EA043] animate-pulse' : 'bg-[#F85149]'
            }`}
          />
          <span className="text-[#8B949E] text-[10px] tabular-nums">
            {connected ? 'LINK 20Hz' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
};
