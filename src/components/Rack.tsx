import { LETTER_POINTS } from "@/lib/game/constants";
import { cn } from "@/lib/utils";

type RackProps = {
  rack: string[];
  selectedIndex: number | null;
  disabled?: boolean;
  swapMode?: boolean;
  swapSelected?: number[];
  onSelect: (index: number) => void;
};

export function Rack({ rack, selectedIndex, disabled, swapMode, swapSelected = [], onSelect }: RackProps) {
  return (
    <div className={cn(
      "mx-auto grid w-full max-w-md grid-cols-7 gap-2 rounded-2xl p-2 shadow-soft transition",
      swapMode ? "bg-destructive/15 ring-2 ring-destructive/40" : "bg-secondary"
    )}>
      {Array.from({ length: 7 }).map((_, index) => {
        const letter = rack[index];
        const isSwapSel = swapSelected.includes(index);
        return (
          <button
            key={`${letter ?? "empty"}-${index}`}
            type="button"
            disabled={disabled || !letter}
            draggable={!disabled && !!letter && !swapMode}
            onDragStart={(e) => { e.dataTransfer.setData("text/rack-index", String(index)); e.dataTransfer.effectAllowed = "move"; }}
            onClick={() => onSelect(index)}
            className={cn(
              "aspect-square rounded-md transition active:scale-95 disabled:opacity-40",
              selectedIndex === index && "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-secondary",
              isSwapSel && "scale-95 ring-2 ring-destructive ring-offset-2 ring-offset-background opacity-60",
            )}
            aria-label={letter ? `Tile ${letter}` : "Empty rack slot"}
          >
            {letter && (
              <span className="tile h-full w-full text-xl">
                {letter}
                <span className="tile-points">{LETTER_POINTS[letter]}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}