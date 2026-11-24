import React, { useEffect } from 'react';
import { Command, X, Play, Layers, Swords, Users, Wind, Zap, RotateCcw, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      key: 'Space',
      label: 'Play / Pause Simulation',
      desc: 'Toggle the 20Hz continuous physics and EKF engine',
      icon: <Play className="w-3.5 h-3.5 text-[#2EA043]" />,
    },
    {
      key: 'V',
      label: 'Toggle 2D Tactical / 3D Orbital',
      desc: 'Switch between 2D high-contrast radar and 3D Three.js orbital scene',
      icon: <Layers className="w-3.5 h-3.5 text-[#58A6FF]" />,
    },
    {
      key: 'S',
      label: 'Toggle Shadow Race (A vs C)',
      desc: 'Race Dead-Reckoning rover against NAVIS adaptive AI rover in real-time',
      icon: <Swords className="w-3.5 h-3.5 text-[#F85149]" />,
    },
    {
      key: 'M',
      label: 'Toggle Swarm Mode (3 Rovers)',
      desc: 'Deploy 3 rovers competing for 4 satellites via AI contention scheduling',
      icon: <Users className="w-3.5 h-3.5 text-[#BC8CFF]" />,
    },
    {
      key: 'D',
      label: 'Toggle Dynamic Dust Storm',
      desc: 'Inject moving particle storm that degrades Visual Odometry by 5x',
      icon: <Wind className="w-3.5 h-3.5 text-[#D29922]" />,
    },
    {
      key: 'O',
      label: 'Toggle Satellite Outage',
      desc: 'Cut all orbital PNT lock signals to trigger EKF sensor fusion fallback',
      icon: <Zap className="w-3.5 h-3.5 text-[#F85149]" />,
    },
    {
      key: 'R',
      label: 'Reset Simulation',
      desc: 'Return all rovers, telemetry, and time to mission origin',
      icon: <RotateCcw className="w-3.5 h-3.5 text-[#8B949E]" />,
    },
    {
      key: '?',
      label: 'Toggle Shortcuts Overlay',
      desc: 'Open or dismiss this quick reference modal during a live pitch',
      icon: <HelpCircle className="w-3.5 h-3.5 text-[#58A6FF]" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
      <div className="bg-[#0F1217] border border-[#21262D] rounded-[2px] shadow-2xl max-w-lg w-full overflow-hidden text-[#E6EDF3] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-10 px-3 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#58A6FF]">
            <Command className="w-4 h-4" />
            <span>PRESENTER KEYBOARD SHORTCUTS</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[2px] text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 divide-y divide-[#21262D]/60 max-h-[75vh] overflow-y-auto">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="py-2 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-[2px] bg-[#161B22] border border-[#21262D] flex items-center justify-center shrink-0">
                  {sc.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#E6EDF3]">{sc.label}</div>
                  <div className="text-[10px] text-[#8B949E] truncate">{sc.desc}</div>
                </div>
              </div>

              <kbd className="px-2 py-0.5 bg-[#161B22] border border-[#30363D] rounded-[2px] text-[#58A6FF] font-bold text-xs shadow-sm shrink-0 min-w-[28px] text-center">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="px-3 py-2 bg-[#161B22]/70 border-t border-[#21262D] flex items-center justify-between text-[10px] text-[#8B949E]">
          <span>Optimized for hands-free live stage demoing</span>
          <span>Press <strong className="text-[#E6EDF3]">Esc</strong> or <strong className="text-[#E6EDF3]">?</strong> to dismiss</span>
        </div>
      </div>
    </div>
  );
};
