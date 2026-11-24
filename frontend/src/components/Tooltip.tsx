import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  title: string;
  description: string;
  position?: 'top' | 'bottom';
  align?: 'left' | 'center' | 'right';
  disabled?: boolean;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  description,
  position = 'top',
  align = 'center',
  disabled = false,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setVisible(false);
  };

  const posClass =
    position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseLeave}
    >
      {children}
      {visible && !disabled && (
        <div
          role="tooltip"
          className={`pointer-events-none z-50 absolute ${posClass} ${alignClass} w-max max-w-[220px] whitespace-normal rounded-md bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-xs text-zinc-200 shadow-xl`}
        >
          <div className="font-semibold text-[#F4F4F5] leading-snug">{title}</div>
          <div className="mt-0.5 text-[11px] text-[#A1A1AA] leading-relaxed font-normal">
            {description}
          </div>
        </div>
      )}
    </div>
  );
};
