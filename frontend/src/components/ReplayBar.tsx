import React, { useState } from 'react';
import { History, Play, Pause, Radio, AlertOctagon, Zap, Wind, Users, ArrowRight } from 'lucide-react';
import { TimelineEventMarker } from '../hooks/useSimulation';

interface ReplayBarProps {
  isReplaying: boolean;
  replayIndex: number;
  bufferLength: number;
  currentTime_s: number;
  liveTime_s: number;
  events: TimelineEventMarker[];
  isReplayPlaying: boolean;
  onScrub: (index: number) => void;
  onTogglePlay: () => void;
  onReturnToLive: () => void;
}

export const ReplayBar: React.FC<ReplayBarProps> = ({
  isReplaying,
  replayIndex,
  bufferLength,
  currentTime_s,
  liveTime_s,
  events,
  isReplayPlaying,
  onScrub,
  onTogglePlay,
  onReturnToLive,
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEventMarker | null>(null);

  if (bufferLength < 10) {
    return null; // Telemetry buffer initializing
  }

  const maxIndex = Math.max(0, bufferLength - 1);
  const currentIndex = isReplaying ? replayIndex : maxIndex;

  const currentMetMin = Math.floor(currentTime_s / 60);
  const currentMetSec = Math.floor(currentTime_s % 60);
  const currentMetStr = `+${String(currentMetMin).padStart(2, '0')}:${String(currentMetSec).padStart(2, '0')}`;

  const liveMetMin = Math.floor(liveTime_s / 60);
  const liveMetSec = Math.floor(liveTime_s % 60);
  const liveMetStr = `+${String(liveMetMin).padStart(2, '0')}:${String(liveMetSec).padStart(2, '0')}`;

  const getMarkerIcon = (type: TimelineEventMarker['type']) => {
    switch (type) {
      case 'HAZARD':
        return <AlertOctagon className="w-2.5 h-2.5" />;
      case 'OUTAGE':
        return <Zap className="w-2.5 h-2.5" />;
      case 'STORM':
        return <Wind className="w-2.5 h-2.5" />;
      case 'SWARM':
        return <Users className="w-2.5 h-2.5" />;
      default:
        return <Radio className="w-2.5 h-2.5" />;
    }
  };

  return (
    <div className="w-full bg-[#0F1217]/95 backdrop-blur-md border border-[#21262D] rounded-[2px] shadow-panel p-2 font-mono text-xs select-none">
      {/* Top Status & Controls Row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {/* Left: Black-Box Title & Clock */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#58A6FF] font-semibold text-[11px]">
            <History className="w-3.5 h-3.5" />
            <span>BLACK-BOX RECORDER</span>
          </div>
          <span className="text-[#8B949E] text-[10px]">
            [{bufferLength} FRAMES]
          </span>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-[#8B949E]">MET:</span>
            <span className={`font-bold tabular-nums ${isReplaying ? 'text-[#D29922]' : 'text-[#2EA043]'}`}>
              {currentMetStr}
            </span>
            {isReplaying && (
              <span className="text-[#8B949E] tabular-nums">
                (LIVE: {liveMetStr})
              </span>
            )}
          </div>
        </div>

        {/* Right: Replay Controls & Return to Live */}
        <div className="flex items-center gap-2">
          {isReplaying ? (
            <>
              {/* Play / Pause Replay */}
              <button
                onClick={onTogglePlay}
                className="btn-control py-0.5 px-2 bg-[#161B22] text-[#E6EDF3] hover:text-[#58A6FF] flex items-center gap-1 text-[10px]"
                title={isReplayPlaying ? 'Pause Replay' : 'Play Replay (1x)'}
              >
                {isReplayPlaying ? (
                  <>
                    <Pause className="w-3 h-3 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>PLAY REPLAY</span>
                  </>
                )}
              </button>

              {/* Return to Live Button */}
              <button
                onClick={onReturnToLive}
                className="btn-control py-0.5 px-2 bg-[#2EA043]/20 border-[#2EA043] text-[#2EA043] hover:bg-[#2EA043]/30 font-bold flex items-center gap-1.5 text-[10px] animate-pulse"
                title="Exit historical scrub and return to real-time live telemetry stream"
              >
                <Radio className="w-3 h-3" />
                <span>RETURN TO LIVE</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2EA043]/10 border border-[#2EA043]/40 rounded-[2px] text-[10px] text-[#2EA043]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2EA043] animate-ping" />
              <span className="font-semibold">REC LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Scrubber Track with Interactive Event Marker Flags */}
      <div className="relative w-full flex items-center pt-1 pb-1">
        {/* Range Slider */}
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={currentIndex}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="w-full h-1.5 bg-[#161B22] rounded-[1px] appearance-none cursor-pointer accent-[#58A6FF] border border-[#21262D]"
          title="Drag to scrub through historical black-box telemetry frames"
        />

        {/* Event Markers Overlay */}
        {events.map((evt) => {
          const pct = Math.max(0, Math.min(100, (evt.frameIndex / maxIndex) * 100));
          return (
            <div
              key={evt.id}
              className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
              style={{ left: `${pct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onScrub(evt.frameIndex);
              }}
              onMouseEnter={() => setHoveredEvent(evt)}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full border border-[#080A0D] flex items-center justify-center -translate-x-1/2 transition-transform hover:scale-150"
                style={{ backgroundColor: evt.color }}
              />
            </div>
          );
        })}

        {/* Hovered Event Tooltip */}
        {hoveredEvent && (
          <div
            className="absolute -top-7 -translate-x-1/2 z-30 pointer-events-none bg-[#161B22] border border-[#21262D] rounded-[2px] px-2 py-0.5 text-[9px] whitespace-nowrap shadow-panel flex items-center gap-1"
            style={{
              left: `${Math.max(10, Math.min(90, (hoveredEvent.frameIndex / maxIndex) * 100))}%`,
              color: hoveredEvent.color,
            }}
          >
            {getMarkerIcon(hoveredEvent.type)}
            <span className="font-bold">{hoveredEvent.label}</span>
            <span className="text-[#8B949E] tabular-nums">
              (MET +{Math.floor(hoveredEvent.sim_time / 60)}:{String(Math.floor(hoveredEvent.sim_time % 60)).padStart(2, '0')})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
