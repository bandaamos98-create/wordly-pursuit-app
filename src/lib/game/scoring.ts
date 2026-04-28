import { Board, BoardCell, BONUS_LAYOUT, BOARD_SIZE } from "./constants";

export type PlacedTile = { row: number; col: number; letter: string; points: number };

/**
 * Validate placement: tiles must be in a single row or column, contiguous (with existing tiles allowed in gaps).
 * First move must cover center (7,7). Subsequent moves must connect to existing tiles.
 */
export function validatePlacement(
  board: Board,
  placed: PlacedTile[],
  isFirstMove: boolean
): { valid: boolean; error?: string } {
  if (placed.length === 0) return { valid: false, error: "Place at least one tile" };

  // Check no overlap with existing
  for (const p of placed) {
    if (board[p.row][p.col]) return { valid: false, error: "Overlapping existing tile" };
  }

  const rows = new Set(placed.map(p => p.row));
  const cols = new Set(placed.map(p => p.col));
  const sameRow = rows.size === 1;
  const sameCol = cols.size === 1;
  if (!sameRow && !sameCol) return { valid: false, error: "Tiles must be in one line" };

  // Build merged board (existing + placed)
  const merged: Board = board.map(r => r.slice());
  for (const p of placed) {
    merged[p.row][p.col] = { letter: p.letter, points: p.points, playerId: "_new" };
  }

  // Check contiguity along the line
  if (sameRow) {
    const r = [...rows][0];
    const sortedCols = [...placed.map(p => p.col)].sort((a, b) => a - b);
    for (let c = sortedCols[0]; c <= sortedCols[sortedCols.length - 1]; c++) {
      if (!merged[r][c]) return { valid: false, error: "Tiles must be contiguous" };
    }
  } else {
    const c = [...cols][0];
    const sortedRows = [...placed.map(p => p.row)].sort((a, b) => a - b);
    for (let r = sortedRows[0]; r <= sortedRows[sortedRows.length - 1]; r++) {
      if (!merged[r][c]) return { valid: false, error: "Tiles must be contiguous" };
    }
  }

  if (isFirstMove) {
    if (!placed.some(p => p.row === 7 && p.col === 7))
      return { valid: false, error: "First word must cover the center star" };
    if (placed.length < 2) return { valid: false, error: "First word must be at least 2 letters" };
  } else {
    // Must connect to at least one existing tile
    const connects = placed.some(p => {
      const adj = [[-1,0],[1,0],[0,-1],[0,1]];
      return adj.some(([dr, dc]) => {
        const nr = p.row + dr, nc = p.col + dc;
        return nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc];
      });
    });
    if (!connects) return { valid: false, error: "New tiles must connect to existing tiles" };
  }

  return { valid: true };
}

/**
 * Extract all words formed by the placement (the main word + cross-words).
 * Returns array of { word, score } using bonus squares (only for newly placed tiles).
 */
export function extractWords(
  board: Board,
  placed: PlacedTile[]
): { word: string; cells: { row: number; col: number; cell: BoardCell; isNew: boolean }[] }[] {
  const merged: Board = board.map(r => r.slice());
  const newSet = new Set(placed.map(p => `${p.row},${p.col}`));
  for (const p of placed) {
    merged[p.row][p.col] = { letter: p.letter, points: p.points, playerId: "_new" };
  }

  const words: { word: string; cells: { row: number; col: number; cell: BoardCell; isNew: boolean }[] }[] = [];
  const seen = new Set<string>();

  const traceWord = (startR: number, startC: number, dr: number, dc: number) => {
    // walk back to start
    let r = startR, c = startC;
    while (r - dr >= 0 && c - dc >= 0 && merged[r - dr][c - dc]) { r -= dr; c -= dc; }
    const cells: { row: number; col: number; cell: BoardCell; isNew: boolean }[] = [];
    let word = "";
    while (r < BOARD_SIZE && c < BOARD_SIZE && merged[r][c]) {
      cells.push({ row: r, col: c, cell: merged[r][c], isNew: newSet.has(`${r},${c}`) });
      word += merged[r][c]!.letter;
      r += dr; c += dc;
    }
    if (word.length >= 2) {
      const key = cells.map(x => `${x.row},${x.col}`).join("|") + (dr === 1 ? "v" : "h");
      if (!seen.has(key)) {
        seen.add(key);
        words.push({ word, cells });
      }
    }
  };

  for (const p of placed) {
    traceWord(p.row, p.col, 0, 1); // horizontal
    traceWord(p.row, p.col, 1, 0); // vertical
  }

  return words;
}

export function scoreWord(cells: { row: number; col: number; cell: BoardCell; isNew: boolean }[]): number {
  let wordMult = 1;
  let total = 0;
  for (const { row, col, cell, isNew } of cells) {
    if (!cell) continue;
    let letterScore = cell.points;
    if (isNew) {
      const bonus = BONUS_LAYOUT[row][col];
      if (bonus === "DL") letterScore *= 2;
      else if (bonus === "TL") letterScore *= 3;
      else if (bonus === "DW" || bonus === "STAR") wordMult *= 2;
      else if (bonus === "TW") wordMult *= 3;
    }
    total += letterScore;
  }
  return total * wordMult;
}

export function scorePlacement(board: Board, placed: PlacedTile[]): { totalScore: number; words: string[] } {
  const words = extractWords(board, placed);
  let total = words.reduce((s, w) => s + scoreWord(w.cells), 0);
  if (placed.length === 7) total += 50; // bingo bonus
  return { totalScore: total, words: words.map(w => w.word) };
}