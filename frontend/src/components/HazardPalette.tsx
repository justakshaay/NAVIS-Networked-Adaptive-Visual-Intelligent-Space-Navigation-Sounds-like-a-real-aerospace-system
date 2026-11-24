import React from 'react';

export type HazardType = 'ROCK_FIELD' | 'CRATER' | 'SAND_TRAP';

interface HazardPaletteProps {
  selectedType: HazardType;
  onSelectType: (type: HazardType) => void;
  onClearAll?: () => void;
  onDone?: () => void;
}

const TYPES: Array<{ id: HazardType; label: string }> = [
  { id: 'ROCK_FIELD', label: 'Rock Field' },
  { id: 'CRATER', label: 'Crater' },
  { id: 'SAND_TRAP', label: 'Sand Trap' },
];

export const HazardPalette: React.FC<HazardPaletteProps> = ({
  selectedType,
  onSelectType,
  onClearAll,
  onDone,
}) => {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0C0C0E]/95 backdrop-blur-md border border-[#222226] text-xs shadow-xl select-none">
      <div className="flex items-center bg-[#09090B] border border-[#222226] rounded-[5px] p-0.5">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectType(t.id);
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
              selectedType === t.id
                ? 'bg-[#F4F4F5] text-[#09090B]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {onClearAll && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClearAll();
          }}
          className="px-2 py-1 rounded-[5px] text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#141417] border border-[#222226] transition-colors"
        >
          Clear All
        </button>
      )}

      {onDone && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          className="px-2.5 py-1 rounded-[5px] text-[11px] font-medium bg-[#1C1C21] text-[#F4F4F5] border border-[#3F3F46] hover:bg-[#27272A] transition-colors"
        >
          Done
        </button>
      )}
    </div>
  );
};
