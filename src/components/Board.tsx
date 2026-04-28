import { Board as BoardType, BONUS_LAYOUT, LETTER_POINTS } from "@/lib/game/constants";
import { PlacedTile } from "@/lib/game/scoring";
import { cn } from "@/lib/utils";

type BoardProps = {
  board: BoardType;
  placed: (PlacedTile & { rackIndex: number })[];
  disabled?: boolean;
  onCellClick: (row: number, col: number) => void;
};

const bonusLabel: Record<string, string> = {
  TW: "TW",
  DW: "DW",
  TL: "TL",
  DL: "DL",
  STAR: "★",
};

export function Board({ board, placed, disabled, onCellClick }: BoardProps) {
  const placedMap = new Map(placed.map((tile) => [`${tile.row},${tile.col}`, tile]));

  return (
    <div className="w-full max-w-[min(94vw,560px)] mx-auto aspect-square rounded-lg bg-border p-1 shadow-soft">
      <div className="grid grid-cols-15 gap-0.5 h-full w-full">
        {Array.from({ length: 15 }).flatMap((_, row) =>
          Array.from({ length: 15 }).map((__, col) => {
            const existing = board?.[row]?.[col] ?? null;
            const staged = placedMap.get(`${row},${col}`);
            const bonus = BONUS_LAYOUT[row][col];
            const tile = existing || staged;

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                disabled={disabled || Boolean(existing)}
                onClick={() => onCellClick(row, col)}
                className={cn(
                  "relative flex min-h-0 min-w-0 items-center justify-center rounded-sm text-[9px] font-bold leading-none transition active:scale-95 disabled:cursor-default",
                  !tile && "bg-board-cell text-muted-foreground",
                  bonus === "TW" && !tile && "bg-bonus-tw text-primary-foreground",
                  bonus === "DW" && !tile && "bg-bonus-dw text-foreground",
                  bonus === "TL" && !tile && "bg-bonus-tl text-primary-foreground",
                  bonus === "DL" && !tile && "bg-bonus-dl text-foreground",
                  bonus === "STAR" && !tile && "bg-board-center text-primary-foreground",
                  staged && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                aria-label={`Board cell ${row + 1}, ${col + 1}`}
              >
                {tile ? (
                  <span className="tile h-full w-full text-[clamp(0.62rem,2.6vw,1.05rem)]">
                    {tile.letter}
                    <span className="tile-points">{tile.points ?? LETTER_POINTS[tile.letter]}</span>
                  </span>
                ) : (
                  <span>{bonus ? bonusLabel[bonus] : ""}</span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}