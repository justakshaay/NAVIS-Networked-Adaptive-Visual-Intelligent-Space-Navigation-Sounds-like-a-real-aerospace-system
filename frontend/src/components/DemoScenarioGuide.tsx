import React from 'react';
import { X } from 'lucide-react';
import { DemoMissionStatus } from '../types/simulation';

interface DemoScenarioGuideProps {
  demoStatus: DemoMissionStatus;
  onStartDemo: () => void;
  onClose?: () => void;
}

export const DemoScenarioGuide: React.FC<DemoScenarioGuideProps> = ({
  demoStatus,
  onClose,
}) => {
  if (!demoStatus.is_active) {
    return null;
  }

  const currentStage = demoStatus.stages[demoStatus.current_stage_idx] || {
    id: '01',
    name: 'Initializing Walkthrough',
    desc: 'Setting up deterministic mission scenario...',
    takeaway: 'Autonomous flight system showcase initializing.',
  };

  const progressPct = ((demoStatus.current_stage_idx + 1) / demoStatus.stages.length) * 100;

  return (
    <div className="w-full bg-[#0C0C0E] border-b border-[#222226] px-4 py-1.5 text-xs select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
            STAGE {currentStage.id}
          </span>
          <span className="font-medium text-[#F4F4F5]">
            {currentStage.name}
          </span>
          <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
            T+{demoStatus.demo_time_s.toFixed(1)}s
          </span>
        </div>

        <div className="flex-1 min-w-[240px] max-w-2xl text-[#A1A1AA] truncate">
          {currentStage.takeaway || currentStage.desc}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 bg-[#1C1C21] h-1 rounded-full overflow-hidden">
            <div
              className="bg-[#F4F4F5] h-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[#A1A1AA] tabular-nums">
            {progressPct.toFixed(0)}%
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#141417] text-[#71717A] hover:text-[#F4F4F5]"
              title="Dismiss walkthrough strip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
