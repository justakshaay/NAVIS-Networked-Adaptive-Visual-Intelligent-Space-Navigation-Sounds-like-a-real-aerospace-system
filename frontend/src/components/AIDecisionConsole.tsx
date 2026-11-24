import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';
import { MissionLogEntry } from '../types/simulation';

interface AIDecisionConsoleProps {
  logs: MissionLogEntry[];
}

export const AIDecisionConsole: React.FC<AIDecisionConsoleProps> = ({ logs }) => {
  const [filter, setFilter] = useState<'ALL' | 'HAZARD' | 'SCHEDULER' | 'PLANNER' | 'OUTAGE'>('ALL');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.category.toUpperCase().includes(filter);
  });

  const getCategoryBadge = (level: string, category: string) => {
    let colorClass = 'text-[#58A6FF] border-[#58A6FF]/40 bg-[#58A6FF]/10';
    if (level === 'danger') {
      colorClass = 'text-[#F85149] border-[#F85149]/40 bg-[#F85149]/10';
    } else if (level === 'warning') {
      colorClass = 'text-[#D29922] border-[#D29922]/40 bg-[#D29922]/10';
    } else if (level === 'success') {
      colorClass = 'text-[#2EA043] border-[#2EA043]/40 bg-[#2EA043]/10';
    }

    return (
      <span className={`px-1 py-0.2 rounded-[1px] text-[9px] font-bold border shrink-0 ${colorClass}`}>
        {category}
      </span>
    );
  };

  return (
    <div className="panel-matte flex flex-col overflow-hidden">
      {/* Console Header & Filters */}
      <div className="panel-header">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#58A6FF]" />
          <span>AI DECISION & RECON LOG</span>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-0.5 font-mono text-[9px]">
          {(['ALL', 'HAZARD', 'SCHEDULER', 'PLANNER', 'OUTAGE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 rounded-[2px] transition-colors duration-150 ${
                filter === f
                  ? 'bg-[#21262D] text-[#58A6FF] font-semibold border border-[#30363D]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollRef}
        className="p-2 flex-1 overflow-y-auto space-y-1.5 font-mono text-xs max-h-[220px] bg-[#080A0D]"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center text-center text-[#6E7681] text-[11px] font-mono border border-dashed border-[#21262D] rounded-[2px] m-1">
            <span className="text-[#8B949E] font-semibold flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#58A6FF] animate-pulse" />
              TELEMETRY STREAM INITIALIZED
            </span>
            <span className="text-[10px]">Awaiting AI constellation decisions & reconnaissance events...</span>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-1.5 leading-tight border-b border-[#21262D]/50 pb-1"
            >
              <span className="text-[#6E7681] text-[10px] shrink-0 tabular-nums">[{log.time}]</span>
              <span className="text-[#8B949E] text-[10px] shrink-0 tabular-nums">{log.met}</span>
              {getCategoryBadge(log.level, log.category)}
              <span
                className={`text-[11px] leading-snug ${
                  log.level === 'danger'
                    ? 'text-[#F85149]'
                    : log.level === 'warning'
                    ? 'text-[#D29922]'
                    : log.level === 'success'
                    ? 'text-[#2EA043]'
                    : 'text-[#E6EDF3]'
                }`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
