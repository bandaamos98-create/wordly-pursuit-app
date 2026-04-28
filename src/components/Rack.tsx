import { LETTER_POINTS } from "@/lib/game/constants";
import { cn } from "@/lib/utils";

type RackProps = {
  rack: string[];
  selectedIndex: number | null;
  disabled?: boolean;
  onSelect: (index: number) => void;
};

export function Rack({ rack, selectedIndex, disabled, onSelect }: RackProps) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-7 gap-2 rounded-lg bg-secondary p-2 shadow-soft">
      {Array.from({ length: 7 }).map((_, index) => {
        const letter = rack[index];
        return (
          <button
            key={`${letter ?? "empty"}-${index}`}
            type="button"
            disabled={disabled || !letter}
            onClick={() => onSelect(index)}
            className={cn(
              "aspect-square rounded-md transition active:scale-95 disabled:opacity-40",
              selectedIndex === index && "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-secondary",
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