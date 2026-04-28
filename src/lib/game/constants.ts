// Standard Scrabble letter distribution & point values
export const LETTER_POINTS: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
  K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
  U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export const LETTER_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
  K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
  U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;

export type BonusType = "TW" | "DW" | "TL" | "DL" | "STAR" | null;

// Standard 15x15 Scrabble bonus layout
export const BONUS_LAYOUT: BonusType[][] = (() => {
  const b: BonusType[][] = Array.from({ length: 15 }, () => Array(15).fill(null));
  const set = (positions: [number, number][], type: BonusType) => {
    positions.forEach(([r, c]) => { b[r][c] = type; });
  };
  // Triple Word
  set([[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]], "TW");
  // Double Word (diagonals)
  set([[1,1],[2,2],[3,3],[4,4],[10,10],[11,11],[12,12],[13,13],
       [1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1]], "DW");
  // Triple Letter
  set([[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]], "TL");
  // Double Letter
  set([[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],
       [7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],
       [12,6],[12,8],[14,3],[14,11]], "DL");
  b[7][7] = "STAR";
  return b;
})();

export type BoardCell = { letter: string; points: number; playerId: string } | null;
export type Board = BoardCell[][];

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function freshTileBag(): string[] {
  const bag: string[] = [];
  for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function drawTiles(bag: string[], n: number): { drawn: string[]; remaining: string[] } {
  const drawn = bag.slice(0, n);
  const remaining = bag.slice(n);
  return { drawn, remaining };
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}