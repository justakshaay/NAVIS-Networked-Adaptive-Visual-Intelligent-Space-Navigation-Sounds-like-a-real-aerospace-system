import React, { useState, Suspense, lazy } from 'react';
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

  const isDemoActive = Boolean(state?.demo_mission?.is_active);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#080A0D] text-[#E6EDF3] font-sans antialiased select-none">
      {/* 1. Slim Aerospace Status Header (44px) */}
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
      />

      {/* 2. Main Cockpit Workspace */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Left/Center Tactical Workspace (~68% width) */}
        <div className="flex-1 min-w-0 flex flex-col relative bg-[#080A0D]">
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#080A0D] text-[#58A6FF] font-mono text-xs gap-3">
                    <div className="w-6 h-6 border-2 border-[#58A6FF] border-t-transparent rounded-full animate-spin" />
                    <span className="tracking-widest uppercase">INITIALIZING 3D ORBITAL VIEWPORT...</span>
                  </div>
                }
              >
                <Mars3DView state={state} />
              </Suspense>
            )}

            {/* Sleek Minimal Floating Command Dock */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[95%] w-full flex flex-col items-center gap-1.5 pointer-events-none">
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
              <div className="pointer-events-auto">
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

        {/* Right Inspector (~32% width, fixed min 380px) */}
        <aside className="w-[380px] xl:w-[420px] shrink-0 border-l border-[#21262D] bg-[#0F1217] flex flex-col min-h-0 z-10">
          {/* Tab Selector */}
          <div className="h-9 border-b border-[#21262D] bg-[#161B22] flex items-center px-1 gap-1 shrink-0 font-mono text-[11px]">
            <button
              onClick={() => setActiveTab('GNC')}
              className={`flex-1 h-7 rounded-[2px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 ${
                activeTab === 'GNC'
                  ? 'bg-[#0F1217] text-[#58A6FF] border border-[#21262D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>GNC & EKF</span>
            </button>

            <button
              onClick={() => setActiveTab('ORBITAL')}
              className={`flex-1 h-7 rounded-[2px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 ${
                activeTab === 'ORBITAL'
                  ? 'bg-[#0F1217] text-[#58A6FF] border border-[#21262D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]/40'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              <span>ORBITAL</span>
            </button>

            <button
              onClick={() => setActiveTab('AI')}
              className={`flex-1 h-7 rounded-[2px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 ${
                activeTab === 'AI'
                  ? 'bg-[#0F1217] text-[#58A6FF] border border-[#21262D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]/40'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>AI & CHARTS</span>
            </button>
          </div>

          {/* Tab Content Pane */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
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
    </div>
  );
}

export default App;
