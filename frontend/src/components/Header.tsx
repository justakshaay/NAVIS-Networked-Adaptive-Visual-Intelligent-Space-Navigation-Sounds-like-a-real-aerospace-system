import React, { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, Download, Printer, HelpCircle, Shuffle } from 'lucide-react';
import { SimulationFullState } from '../types/simulation';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  state: SimulationFullState | null;
  connected: boolean;
  onOpenBenchmark: () => void;
  isDemoActive?: boolean;
  onToggleDemoGuide?: () => void;
  onStartDemo?: () => void;
  onSetTerrainPreset?: (preset: 'procedural' | 'jezero_crater') => void;
  onGenerateNewMap?: () => void;
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
  onGenerateNewMap,
  viewMode = '2D',
  onToggleViewMode,
  onOpenDebrief,
  onExportCsv,
  onOpenShortcuts,
}) => {
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

  const metMinutes = state ? Math.floor(state.sim_time / 60) : 0;
  const metSeconds = state ? Math.floor(state.sim_time % 60) : 0;
  const metString = `MET +${String(metMinutes).padStart(2, '0')}:${String(metSeconds).padStart(2, '0')}`;

  const isFallback = Boolean(state?.ekf?.fallback_active);
  const statusLabel = isFallback
    ? 'Fallback'
    : state?.rover?.mission_status === 'TARGET_REACHED'
    ? 'Arrived'
    : state?.is_running
    ? 'Navigating'
    : 'Standby';

  return (
    <header className="h-12 w-full bg-[#0C0C0E] border-b border-[#222226] px-4 flex items-center justify-between gap-4 select-none shrink-0 z-30">
      {/* Left: NAVIS Wordmark + Map & View Segmented Toggles */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tracking-wider text-[#F4F4F5]">
            NAVIS
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`}
            title={connected ? 'Telemetry connected' : 'Connecting...'}
          />
        </div>

        <div className="h-4 w-px bg-[#222226]" />

        {/* Map Preset Segmented Toggle */}
        <Tooltip
          title="Terrain Preset"
          description="Switch between Procedural Sector 7 and real Jezero Crater elevation data."
          position="bottom"
          align="left"
        >
          <div className="hidden sm:flex items-center bg-[#09090B] border border-[#222226] rounded-md p-0.5 text-xs">
            <button
              onClick={() => onSetTerrainPreset?.('procedural')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                (state?.terrain_preset || 'procedural') === 'procedural'
                  ? 'bg-[#F4F4F5] text-[#09090B]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              Procedural
            </button>
            <button
              onClick={() => onSetTerrainPreset?.('jezero_crater')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                state?.terrain_preset === 'jezero_crater'
                  ? 'bg-[#F4F4F5] text-[#09090B]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              Jezero Crater
            </button>
          </div>
        </Tooltip>

        {onGenerateNewMap && (
          <Tooltip
            title="Generate New Map"
            description="Synthesizes a fresh procedural Martian elevation map with a new random seed."
            position="bottom"
            align="left"
          >
            <button
              onClick={onGenerateNewMap}
              className="btn-control hidden sm:inline-flex text-xs px-2.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>New Map</span>
            </button>
          </Tooltip>
        )}

        {/* 2D / 3D View Segmented Toggle */}
        <Tooltip
          title="Viewport Mode (V)"
          description="Toggle between the 2D tactical grid map and interactive 3D Mars orbital scene."
          position="bottom"
          align="left"
        >
          <div className="flex items-center bg-[#09090B] border border-[#222226] rounded-md p-0.5 text-xs">
            <button
              onClick={() => onToggleViewMode?.('2D')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                viewMode === '2D'
                  ? 'bg-[#F4F4F5] text-[#09090B]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              2D
            </button>
            <button
              onClick={() => onToggleViewMode?.('3D')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                viewMode === '3D'
                  ? 'bg-[#F4F4F5] text-[#09090B]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              3D
            </button>
          </div>
        </Tooltip>
      </div>

      {/* Center: Minimal Inline Status + MET Timer */}
      <div className="hidden md:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 text-[#A1A1AA]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isFallback
                ? 'bg-red-500'
                : state?.is_running
                ? 'bg-emerald-500'
                : 'bg-zinc-500'
            }`}
          />
          <span className="text-[#F4F4F5] font-medium">{statusLabel}</span>
          {state?.shadow_race_enabled && (
            <span className="text-[#71717A] font-mono">· Race A vs C</span>
          )}
          {state?.swarm_mode_enabled && (
            <span className="text-[#71717A] font-mono">· Swarm (3)</span>
          )}
        </div>
        <span className="text-[#222226]">|</span>
        <span className="font-mono text-[#71717A] tabular-nums">{metString}</span>
      </div>

      {/* Right: Core Engineering Tools & Subordinate Optional Pitch Demo */}
      <div className="flex items-center gap-2">
        <Tooltip
          title="Benchmark Modes"
          description="Run head-to-head comparison metrics across Mode A (DR), Mode B (EKF), and Mode C (NAVIS AI)."
          position="bottom"
          align="right"
        >
          <button onClick={onOpenBenchmark} className="btn-control text-[#F4F4F5]">
            <span>Benchmark</span>
          </button>
        </Tooltip>

        {/* Export Report Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <Tooltip
            title="Export Report"
            description="Generate a printable flight debrief summary or download raw mission telemetry CSV."
            position="bottom"
            align="right"
            disabled={isExportMenuOpen}
          >
            <button
              onClick={() => setIsExportMenuOpen((o) => !o)}
              className="btn-control text-[#F4F4F5]"
            >
              <span>Export Report</span>
              <ChevronDown className="w-3 h-3 text-[#71717A]" />
            </button>
          </Tooltip>

          {isExportMenuOpen && (
            <div className="absolute right-0 top-9 z-50 w-52 bg-[#0C0C0E] border border-[#222226] rounded-md shadow-2xl p-1 text-xs space-y-0.5">
              <button
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onOpenDebrief?.();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[4px] hover:bg-[#141417] text-[#F4F4F5] flex items-center gap-2 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>Mission Debrief Report</span>
              </button>
              <button
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportCsv?.();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[4px] hover:bg-[#141417] text-[#F4F4F5] flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>Download CSV Log</span>
              </button>
              <div className="px-2.5 py-1 text-[10px] text-[#71717A] border-t border-[#222226] flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                <span>Includes EKF & events</span>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-[#222226] hidden sm:block" />

        {/* Subordinate Optional Presenter Demo Trigger */}
        {isDemoActive ? (
          <Tooltip
            title="Pitch Demo Active"
            description="Toggle the optional automated walkthrough banner for presenters."
            position="bottom"
            align="right"
          >
            <button
              onClick={onToggleDemoGuide}
              className="h-7 px-2 rounded-md text-[11px] font-medium text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#141417] flex items-center gap-1.5 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Pitch Demo</span>
            </button>
          </Tooltip>
        ) : onStartDemo ? (
          <Tooltip
            title="Pitch Demo"
            description="Optional scripted walkthrough cycling through Jezero, outages, storms, and swarm mode."
            position="bottom"
            align="right"
          >
            <button
              onClick={onStartDemo}
              className="h-7 px-2 rounded-md text-[11px] font-medium text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#141417] transition-colors"
            >
              <span>Pitch Demo</span>
            </button>
          </Tooltip>
        ) : null}

        <Tooltip
          title="Keyboard Shortcuts (?)"
          description="View hotkeys for playback, camera toggle, faults, and reset."
          position="bottom"
          align="right"
        >
          <button
            onClick={onOpenShortcuts}
            className="h-7 px-2 rounded-md text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#141417] flex items-center justify-center transition-colors"
            aria-label="Keyboard Shortcuts"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
