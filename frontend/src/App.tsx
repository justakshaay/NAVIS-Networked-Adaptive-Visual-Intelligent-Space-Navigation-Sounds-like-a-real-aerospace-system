import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { MarsCanvas } from './components/MarsCanvas';
import { MissionControls } from './components/MissionControls';
import { ReplayBar } from './components/ReplayBar';
import { DebriefModal } from './components/DebriefModal';
import { SatellitePanel } from './components/SatellitePanel';
import { SensorFusionPanel } from './components/SensorFusionPanel';
import { AIDecisionConsole } from './components/AIDecisionConsole';
import { TelemetryPanel } from './components/TelemetryPanel';
import { RealtimeCharts } from './components/RealtimeCharts';
import { BenchmarkModal } from './components/BenchmarkModal';
import { DemoScenarioGuide } from './components/DemoScenarioGuide';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { generateDebriefData, exportTelemetryCsv } from './utils/exportReport';
import { Layers, Satellite, Terminal } from 'lucide-react';

const Mars3DView = lazy(() => import('./components/Mars3DView'));

export function App() {
  const {
    state,
    liveState,
    connected,
    benchmarkResult,
    isBenchmarking,
    isReplaying,
    replayIndex,
    bufferLength,
    events,
    isReplayPlaying,
    telemetryBuffer,
    scrubTo,
    returnToLive,
    toggleReplayPlay,
    startMission,
    pauseMission,
    resetMission,
    setSpeed,
    setMode,
    simulateOutage,
    restoreSatellite,
    injectHazard,
    runDemo,
    toggleShadowRace,
    toggleSwarmMode,
    setTerrainPreset,
    toggleDustStorm,
    runBenchmark,
  } = useSimulation();

  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);
  const [isDebriefModalOpen, setIsDebriefModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'GNC' | 'ORBITAL' | 'AI'>('GNC');
  const [isDemoGuideVisible, setIsDemoGuideVisible] = useState<boolean>(true);
  const [isHazardMode, setIsHazardMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  const handleOpenBenchmark = () => {
    setIsBenchmarkModalOpen(true);
    if (!benchmarkResult) {
      runBenchmark();
    }
  };

  const handleManualInjectHazard = () => {
    if (!state) return;
    const roverX = state.rover.x;
    const roverY = state.rover.y;
    const offset = 80;
    const hzX = Math.min(state.terrain_summary.width_m - 50, roverX + offset);
    const hzY = Math.min(state.terrain_summary.height_m - 50, roverY + offset);
    injectHazard(hzX, hzY, 28.0, 'ROCK_FIELD');
  };

  // Presenter Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (state?.is_running) {
          pauseMission();
        } else {
          startMission();
        }
      }
      // V / v: Toggle 2D / 3D View
      else if (e.key === 'v' || e.key === 'V') {
        setViewMode((m) => (m === '2D' ? '3D' : '2D'));
      }
      // S / s: Toggle Shadow Race
      else if (e.key === 's' || e.key === 'S') {
        toggleShadowRace(!state?.shadow_race_enabled);
      }
      // M / m: Toggle Swarm Mode
      else if (e.key === 'm' || e.key === 'M') {
        toggleSwarmMode(!state?.swarm_mode_enabled);
      }
      // D / d: Toggle Dust Storm
      else if (e.key === 'd' || e.key === 'D') {
        toggleDustStorm(!state?.dust_storm?.active);
      }
      // O / o: Toggle Outage
      else if (e.key === 'o' || e.key === 'O') {
        const hasOutage = state?.satellites?.some((s) => s.is_outage);
        if (hasOutage) {
          restoreSatellite();
        } else {
          simulateOutage();
        }
      }
      // R / r: Reset Mission
      else if (e.key === 'r' || e.key === 'R') {
        resetMission();
      }
      // ?: Toggle Shortcuts Modal
      else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state?.is_running,
    state?.shadow_race_enabled,
    state?.swarm_mode_enabled,
    state?.dust_storm?.active,
    state?.satellites,
    startMission,
    pauseMission,
    toggleShadowRace,
    toggleSwarmMode,
    toggleDustStorm,
    simulateOutage,
    restoreSatellite,
    resetMission,
  ]);

  const isDemoActive = Boolean(state?.demo_mission?.is_active);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#09090B] text-[#F4F4F5] font-sans antialiased select-none">
      {/* 1. Minimal Top Bar (48px) */}
      <Header
        state={state}
        connected={connected}
        onOpenBenchmark={handleOpenBenchmark}
        isDemoActive={isDemoActive}
        onToggleDemoGuide={() => setIsDemoGuideVisible((v) => !v)}
        onStartDemo={runDemo}
        onSetTerrainPreset={setTerrainPreset}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenDebrief={() => setIsDebriefModalOpen(true)}
        onExportCsv={() => exportTelemetryCsv(telemetryBuffer, (state || liveState)!)}
        onOpenShortcuts={() => setIsShortcutsModalOpen((s) => !s)}
      />

      {/* 2. Main Workspace */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Left/Center Mars Viewport */}
        <div className="flex-1 min-w-0 flex flex-col relative bg-[#09090B]">
          {/* Demo Scenario Milestone Strip (if active and visible) */}
          {state?.demo_mission && isDemoActive && isDemoGuideVisible && (
            <div className="shrink-0 z-20">
              <DemoScenarioGuide
                demoStatus={state.demo_mission}
                onStartDemo={runDemo}
                onClose={() => setIsDemoGuideVisible(false)}
              />
            </div>
          )}

          {/* Full-Height Tactical Mars Viewport (2D Canvas or 3D Orbital Scene) */}
          <div className="flex-1 min-h-0 relative">
            {viewMode === '2D' ? (
              <MarsCanvas
                state={state}
                onInjectHazard={(x, y, rad, type) => {
                  injectHazard(x, y, rad, type);
                  setIsHazardMode(false);
                }}
                isHazardModeActive={isHazardMode}
                onCancelHazardMode={() => setIsHazardMode(false)}
              />
            ) : (
              <Suspense
                fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#09090B] text-[#A1A1AA] font-mono text-xs gap-3">
                    <div className="w-5 h-5 border-2 border-[#F4F4F5] border-t-transparent rounded-full animate-spin" />
                    <span className="tracking-widest uppercase">Initializing 3D View</span>
                  </div>
                }
              >
                <Mars3DView state={state} />
              </Suspense>
            )}

            {/* Minimal Bottom Dock */}
            <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pointer-events-none">
              <div className="pointer-events-auto w-full">
                <ReplayBar
                  isReplaying={isReplaying}
                  replayIndex={replayIndex}
                  bufferLength={bufferLength}
                  currentTime_s={state?.sim_time || 0}
                  liveTime_s={liveState?.sim_time || 0}
                  events={events}
                  isReplayPlaying={isReplayPlaying}
                  onScrub={scrubTo}
                  onTogglePlay={toggleReplayPlay}
                  onReturnToLive={returnToLive}
                />
              </div>
              <div className="pointer-events-auto w-full">
                <MissionControls
                  state={state}
                  onStart={startMission}
                  onPause={pauseMission}
                  onReset={resetMission}
                  onSpeed={setSpeed}
                  onMode={setMode}
                  onOutage={simulateOutage}
                  onRestore={restoreSatellite}
                  onToggleHazardMode={() => setIsHazardMode((h) => !h)}
                  isHazardModeActive={isHazardMode}
                  onToggleShadowRace={() => toggleShadowRace(!state?.shadow_race_enabled)}
                  onToggleSwarmMode={() => toggleSwarmMode(!state?.swarm_mode_enabled)}
                  onToggleDustStorm={() => toggleDustStorm(!state?.dust_storm?.active)}
                  onRunDemo={runDemo}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Inspector (Monochrome Flat) */}
        <aside className="w-[360px] xl:w-[400px] shrink-0 border-l border-[#222226] bg-[#0C0C0E] flex flex-col min-h-0 z-10">
          {/* Tab Selector */}
          <div className="h-10 border-b border-[#222226] bg-[#0C0C0E] flex items-center px-2 gap-1 shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('GNC')}
              className={`flex-1 h-7 rounded-[5px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'GNC'
                  ? 'bg-[#1C1C21] text-[#F4F4F5]'
                  : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#141417]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>GNC & EKF</span>
            </button>

            <button
              onClick={() => setActiveTab('ORBITAL')}
              className={`flex-1 h-7 rounded-[5px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'ORBITAL'
                  ? 'bg-[#1C1C21] text-[#F4F4F5]'
                  : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#141417]'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              <span>Orbital</span>
            </button>

            <button
              onClick={() => setActiveTab('AI')}
              className={`flex-1 h-7 rounded-[5px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'AI'
                  ? 'bg-[#1C1C21] text-[#F4F4F5]'
                  : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#141417]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>AI & Charts</span>
            </button>
          </div>

          {/* Tab Content Pane */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1E1E22]">
            {activeTab === 'GNC' && (
              <>
                <TelemetryPanel
                  rover={state?.rover || null}
                  metrics={state?.metrics || null}
                />
                <SensorFusionPanel
                  ekf={state?.ekf || null}
                  sensors={state?.sensors || null}
                  metrics={state?.metrics || null}
                  truePos={{
                    x: state?.rover.x || 50,
                    y: state?.rover.y || 50,
                    speed: state?.rover.speed || 0,
                    heading_deg: state?.rover.heading_deg || 0,
                  }}
                />
              </>
            )}

            {activeTab === 'ORBITAL' && (
              <SatellitePanel
                satellites={state?.satellites || []}
                aiScheduler={state?.ai_scheduler || {}}
              />
            )}

            {activeTab === 'AI' && (
              <>
                <AIDecisionConsole logs={state?.logs || []} />
                <RealtimeCharts
                  metrics={state?.metrics || null}
                  simTime={state?.sim_time || 0}
                />
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Benchmark Head-to-Head Comparison Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
        benchmarkResult={benchmarkResult}
        isBenchmarking={isBenchmarking}
        onRunBenchmark={() => runBenchmark()}
      />

      {/* Flight Debrief / Print Modal */}
      {isDebriefModalOpen && (state || liveState) && (
        <DebriefModal
          summary={generateDebriefData(telemetryBuffer, (state || liveState)!)}
          rawBuffer={telemetryBuffer}
          currentState={(state || liveState)!}
          onClose={() => setIsDebriefModalOpen(false)}
        />
      )}

      {/* Presenter Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}

export default App;
