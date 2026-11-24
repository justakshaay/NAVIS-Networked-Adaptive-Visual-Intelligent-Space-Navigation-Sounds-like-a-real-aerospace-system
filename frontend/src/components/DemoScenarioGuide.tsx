import React from 'react';
import { Bot, CheckCircle2, ChevronRight, Play, X, Zap } from 'lucide-react';
import { DemoMissionStatus } from '../types/simulation';

interface DemoScenarioGuideProps {
  demoStatus: DemoMissionStatus;
  onStartDemo: () => void;
  onClose?: () => void;
}

export const DemoScenarioGuide: React.FC<DemoScenarioGuideProps> = ({
  demoStatus,
  onStartDemo,
  onClose,
}) => {
  if (!demoStatus.is_active) {
    return null;
  }

  const currentStage = demoStatus.stages[demoStatus.current_stage_idx] || {
    id: '01',
    name: 'Initializing Demonstration',
    desc: 'Setting up deterministic mission scenario...',
    takeaway: 'Autonomous flight system showcase initializing.',
  };

  const progressPct = ((demoStatus.current_stage_idx + 1) / demoStatus.stages.length) * 100;

  return (
    <div className="w-full bg-[#0F1217] border-b border-[#21262D] px-3 py-1.5 font-mono text-xs select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Stage Counter & Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-1.5 py-0.5 bg-[#161B22] border border-[#21262D] text-[#58A6FF] font-bold text-[11px] rounded-[2px] tabular-nums">
            STAGE {currentStage.id}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#E6EDF3] text-xs">
              {currentStage.name}
            </span>
            <span className="text-[10px] text-[#8B949E] tabular-nums">
              (T+{demoStatus.demo_time_s.toFixed(1)}s)
            </span>
          </div>
        </div>

        {/* Judge Takeaway / Stage Description */}
        <div className="flex-1 min-w-[280px] max-w-2xl flex items-center gap-1.5 px-2 py-0.5 bg-[#161B22]/70 border border-[#21262D]/60 rounded-[2px] truncate">
          <Zap className="w-3 h-3 text-[#D29922] shrink-0" />
          <span className="text-[10px] font-bold text-[#D29922] uppercase shrink-0">TAKEAWAY:</span>
          <span className="text-[#E6EDF3] text-[11px] font-medium truncate">
            {currentStage.takeaway || currentStage.desc}
          </span>
        </div>

        {/* Progress & Close */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-24 bg-[#161B22] h-1.5 rounded-[1px] overflow-hidden border border-[#21262D]">
            <div
              className="bg-[#58A6FF] h-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-[#58A6FF] font-bold tabular-nums">
            {progressPct.toFixed(0)}%
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-[2px] text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#161B22]"
              title="Hide Demo Banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
