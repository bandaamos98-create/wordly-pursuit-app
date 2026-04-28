import { Board, BOARD_SIZE, LETTER_POINTS } from "./constants";
import { isValidWord } from "./dictionary";
import { PlacedTile, scorePlacement, validatePlacement } from "./scoring";

/**
 * Simple bot: tries random combinations of rack letters in random anchor positions
 * to find any legal scoring play. Returns null if nothing found (bot will pass).
 */
export function findBotMove(
  board: Board,
  rack: string[],
  isFirstMove: boolean,
): PlacedTile[] | null {
  if (rack.length === 0) return null;
  const anchors: { row: number; col: number }[] = [];

  if (isFirstMove) {
    anchors.push({ row: 7, col: 7 });
  } else {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c]) continue;
        const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        if (adj.some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc];
        })) {
          anchors.push({ row: r, col: c });
        }
      }
    }
  }

  // shuffle anchors
  anchors.sort(() => Math.random() - 0.5);

  let best: { placed: PlacedTile[]; score: number } | null = null;

  for (const anchor of anchors.slice(0, 25)) {
    for (const horizontal of [true, false]) {
      for (let len = Math.min(rack.length, 5); len >= 2; len--) {
        // Try the anchor as one of the positions of the word
        for (let offset = 0; offset < len; offset++) {
          // Build candidate placement
          const placed: PlacedTile[] = [];
          const usedRack = new Set<number>();
          let letters = "";
          let ok = true;
          for (let i = 0; i < len; i++) {
            const r = horizontal ? anchor.row : anchor.row - offset + i;
            const c = horizontal ? anchor.col - offset + i : anchor.col;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { ok = false; break; }
            const existing = board[r][c];
            if (existing) {
              letters += existing.letter;
            } else {
              // pick an unused rack letter
              const idx = rack.findIndex((_, k) => !usedRack.has(k));
              if (idx < 0) { ok = false; break; }
              usedRack.add(idx);
              const letter = rack[idx];
              placed.push({ row: r, col: c, letter, points: LETTER_POINTS[letter] });
              letters += letter;
            }
          }
          if (!ok || placed.length === 0) continue;
          if (!isValidWord(letters)) continue;
          const v = validatePlacement(board, placed, isFirstMove);
          if (!v.valid) continue;
          const { totalScore } = scorePlacement(board, placed);
          if (totalScore > 0 && (!best || totalScore > best.score)) {
            best = { placed, score: totalScore };
          }
        }
      }
    }
    if (best) break; // accept first reasonable move
  }

  return best?.placed ?? null;
}