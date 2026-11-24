import React, { useState } from 'react';
import { History, Play, Pause, Radio } from 'lucide-react';
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
    return null;
  }

  const maxIndex = Math.max(0, bufferLength - 1);
  const currentIndex = isReplaying ? replayIndex : maxIndex;

  const currentMetMin = Math.floor(currentTime_s / 60);
  const currentMetSec = Math.floor(currentTime_s % 60);
  const currentMetStr = `+${String(currentMetMin).padStart(2, '0')}:${String(currentMetSec).padStart(2, '0')}`;

  const liveMetMin = Math.floor(liveTime_s / 60);
  const liveMetSec = Math.floor(liveTime_s % 60);
  const liveMetStr = `+${String(liveMetMin).padStart(2, '0')}:${String(liveMetSec).padStart(2, '0')}`;

  return (
    <div className="w-full bg-[#0C0C0E]/95 backdrop-blur-md border-t border-[#222226] px-3 py-1.5 text-xs select-none">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Label + Clock */}
        <div className="flex items-center gap-2 shrink-0">
          <History className="w-3.5 h-3.5 text-[#71717A]" />
          <span className="text-[11px] font-medium text-[#A1A1AA]">Replay</span>
          <span className="font-mono text-[11px] text-[#F4F4F5] tabular-nums">
            {currentMetStr}
          </span>
          {isReplaying && (
            <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
              / {liveMetStr}
            </span>
          )}
        </div>

        {/* Center: Scrubber Track */}
        <div className="relative flex-1 flex items-center py-1">
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={currentIndex}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="w-full h-1 bg-[#222226] rounded-full appearance-none cursor-pointer accent-[#F4F4F5]"
            title="Scrub telemetry history"
          />

          {events.map((evt) => {
            const pct = Math.max(0, Math.min(100, (evt.frameIndex / maxIndex) * 100));
            return (
              <div
                key={evt.id}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{ left: `${pct}%` }}
                onClick={() => onScrub(evt.frameIndex)}
                onMouseEnter={() => setHoveredEvent(evt)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                <div className="w-2 h-2 rounded-full bg-[#F4F4F5] border border-[#09090B] hover:scale-125 transition-transform" />
              </div>
            );
          })}

          {hoveredEvent && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-[#0C0C0E] border border-[#222226] rounded text-[10px] font-mono text-[#F4F4F5] whitespace-nowrap pointer-events-none z-30"
              style={{ left: `${Math.max(5, Math.min(95, (hoveredEvent.frameIndex / maxIndex) * 100))}%` }}
            >
              {hoveredEvent.label} ({hoveredEvent.sim_time.toFixed(1)}s)
            </div>
          )}
        </div>

        {/* Right: Replay Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isReplaying ? (
            <>
              <button
                onClick={onTogglePlay}
                className="btn-control h-6 px-2 text-[11px]"
              >
                {isReplayPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isReplayPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                onClick={onReturnToLive}
                className="btn-control h-6 px-2.5 text-[11px] bg-[#F4F4F5] text-[#09090B] border-[#F4F4F5] hover:bg-white hover:text-[#09090B]"
              >
                <Radio className="w-3 h-3" />
                <span>Live</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] font-mono px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
