import React, { useState, useEffect, useRef } from 'react';
import { Radio, ShieldCheck, Activity, Compass, Cpu, AlertTriangle, PlayCircle, Bot, Swords, FileText, ChevronDown, Download, Printer, HelpCircle } from 'lucide-react';
import { SimulationFullState } from '../types/simulation';

interface HeaderProps {
  state: SimulationFullState | null;
  connected: boolean;
  onOpenBenchmark: () => void;
  isDemoActive?: boolean;
  onToggleDemoGuide?: () => void;
  onStartDemo?: () => void;
  onSetTerrainPreset?: (preset: 'procedural' | 'jezero_crater') => void;
  viewMode?: '2D' | '3D';
  onToggleViewMode?: (mode: '2D' | '3D') => void;
  onOpenDebrief?: () => void;
  onExportCsv?: () => void;
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  connected,
  onOpenBenchmark,
  isDemoActive = false,
  onToggleDemoGuide,
  onStartDemo,
  onSetTerrainPreset,
  viewMode = '2D',
  onToggleViewMode,
  onOpenDebrief,
  onExportCsv,
  onOpenShortcuts,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            {state?.mode_meta?.tag || (currentMode === 'MODE_C' ? 'ADAPTIVE AI' : currentMode)}
          </span>
        </div>

        {/* Terrain Preset Selector Pill */}
        <div className="hidden sm:flex items-center bg-[#161B22] border border-[#21262D] rounded-[2px] p-0.5 text-[10px]">
          <span className="text-[9px] uppercase tracking-wider text-[#8B949E] px-1 font-semibold">
            MAP:
          </span>
          <button
            onClick={() => onSetTerrainPreset?.('procedural')}
            className={`px-1.5 py-0.5 rounded-[1px] transition-colors duration-150 ${
              (state?.terrain_preset || 'procedural') === 'procedural'
                ? 'bg-[#21262D] text-[#E6EDF3] font-bold'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
            title="Switch to Procedural Martian Plains with randomized craters and rock fields"
          >
            PROCEDURAL
          </button>
          <button
            onClick={() => onSetTerrainPreset?.('jezero_crater')}
            className={`px-1.5 py-0.5 rounded-[1px] transition-colors duration-150 ${
              state?.terrain_preset === 'jezero_crater'
                ? 'bg-[#58A6FF]/20 text-[#58A6FF] font-bold border border-[#58A6FF]/40'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
            title="Switch to NASA Jezero Crater Western River Delta & Ancient Lakebed Basin"
          >
            JEZERO CRATER
          </button>
        </div>

        {/* 2D / 3D Viewport Toggle Pill */}
        <div className="flex items-center bg-[#161B22] border border-[#21262D] rounded-[2px] p-0.5 text-[10px]">
          <span className="text-[9px] uppercase tracking-wider text-[#8B949E] px-1 font-semibold hidden md:inline">
            VIEW:
          </span>
          <button
            onClick={() => onToggleViewMode?.('2D')}
            className={`px-2 py-0.5 rounded-[1px] font-bold transition-colors duration-150 ${
              viewMode === '2D'
                ? 'bg-[#58A6FF] text-[#080A0D]'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
            title="Switch to 2D High-Resolution Tactical Top-Down Canvas"
          >
            2D TACTICAL
          </button>
          <button
            onClick={() => onToggleViewMode?.('3D')}
            className={`px-2 py-0.5 rounded-[1px] font-bold transition-colors duration-150 ${
              viewMode === '3D'
                ? 'bg-[#58A6FF] text-[#080A0D]'
                : 'text-[#8B949E] hover:text-[#E6EDF3]'
            }`}
            title="Switch to Interactive 3D Martian Surface & Orbital Constellation View"
          >
            3D ORBITAL
          </button>
        </div>

        {/* Autonomous Fallback Warning Flag */}
        {Boolean(state?.ekf?.fallback_active) && (
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
            {state?.rover?.mission_status || 'INITIALIZING'}
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

        {/* Export Report & Telemetry Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen((o) => !o)}
            className="btn-control bg-[#161B22] border-[#21262D] text-[#E6EDF3] hover:text-[#58A6FF] font-semibold transition-colors duration-150 flex items-center gap-1.5"
            title="Export mission telemetry CSV or print flight debrief report"
          >
            <FileText className="w-3.5 h-3.5 text-[#58A6FF]" />
            <span>EXPORT REPORT</span>
            <ChevronDown className="w-3 h-3 text-[#8B949E]" />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 top-8 z-50 w-56 bg-[#0F1217] border border-[#21262D] rounded-[2px] shadow-2xl p-1 font-mono text-[11px] space-y-0.5">
              <button
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onOpenDebrief?.();
                }}
                className="w-full text-left px-2 py-1.5 rounded-[1px] hover:bg-[#161B22] text-[#E6EDF3] hover:text-[#58A6FF] flex items-center gap-2 transition-colors duration-150"
              >
                <Printer className="w-3.5 h-3.5 text-[#58A6FF]" />
                <div>
                  <div className="font-bold">MISSION DEBRIEF (PDF)</div>
                  <div className="text-[9px] text-[#8B949E]">Formatted print-ready summary</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportCsv?.();
                }}
                className="w-full text-left px-2 py-1.5 rounded-[1px] hover:bg-[#161B22] text-[#E6EDF3] hover:text-[#2EA043] flex items-center gap-2 transition-colors duration-150 border-t border-[#21262D]/60"
              >
                <Download className="w-3.5 h-3.5 text-[#2EA043]" />
                <div>
                  <div className="font-bold">TELEMETRY (.CSV)</div>
                  <div className="text-[9px] text-[#8B949E]">Structured flight recorder data</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Presenter Keyboard Shortcuts Button */}
        <button
          onClick={onOpenShortcuts}
          className="btn-control py-1 px-1.5 bg-[#161B22] border-[#21262D] text-[#8B949E] hover:text-[#58A6FF] rounded-[2px]"
          title="Presenter Keyboard Shortcuts (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
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
