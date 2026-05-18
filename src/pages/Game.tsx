import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, RotateCcw, Trophy, Shuffle, Repeat, Flag, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfiles } from "@/hooks/useProfile";
import { Board } from "@/components/Board";
import { Rack } from "@/components/Rack";
import { Chat } from "@/components/Chat";
import { HeadToHead } from "@/components/HeadToHead";
import { ProfilePic } from "@/components/ProfilePic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Board as BoardType, drawTiles, emptyBoard, LETTER_POINTS, RACK_SIZE } from "@/lib/game/constants";
import { PlacedTile, scorePlacement, validatePlacement } from "@/lib/game/scoring";
import { isValidWord } from "@/lib/game/dictionary";
import { findBotMove } from "@/lib/game/bot";
import { BOT_USER_ID, BOT_NAME } from "@/lib/bot";

type GameRow = {
  id: string; join_code: string; status: string;
  board: unknown; tile_bag: unknown;
  current_turn_user_id: string | null;
  player1_id: string; player2_id: string | null;
  player1_score: number; player2_score: number;
  winner_id: string | null; passes_in_a_row: number;
  is_solo: boolean; mode: string;
  turn_seconds: number | null; turn_deadline: string | null;
  last_move: { user_id: string; word: string; words: string[]; score: number; at: string } | null;
};

type PlayerRow = { user_id: string; rack: unknown };

export default function Game() {
  const { gameId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameRow | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [placed, setPlaced] = useState<(PlacedTile & { rackIndex: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const [rackOrder, setRackOrder] = useState<string[] | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSel, setSwapSel] = useState<number[]>([]);
  const [moveBanner, setMoveBanner] = useState<{ name: string; word: string; score: number; key: number } | null>(null);
  const lastMoveAt = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadGame = useCallback(async () => {
    if (!gameId || !user) return;
    const [{ data: gameData }, { data: playerData }] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
      supabase.from("game_players").select("user_id,rack").eq("game_id", gameId).eq("user_id", user.id).maybeSingle(),
    ]);
    setGame(((gameData as unknown) as GameRow | null) ?? null);
    setPlayer((playerData as PlayerRow | null) ?? null);
  }, [gameId, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/", { replace: true }); return; }
    if (!gameId) return;
    loadGame();
    const channel = supabase
      .channel(`game-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => loadGame())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, () => loadGame())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId, user, loading, loadGame]);

  // tick for timer
  useEffect(() => {
    if (!game?.turn_deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [game?.turn_deadline]);

  const board = useMemo(() => (Array.isArray(game?.board) ? (game?.board as BoardType) : emptyBoard()), [game?.board]);
  const baseRack = useMemo(() => (Array.isArray(player?.rack) ? (player?.rack as string[]) : []), [player?.rack]);
  const rack = rackOrder && rackOrder.length === baseRack.length && rackOrder.every((l) => baseRack.includes(l)) ? rackOrder : baseRack;

  // reset rackOrder when base rack changes
  useEffect(() => { setRackOrder(null); }, [baseRack.join(",")]);

  const opponentId = game?.player1_id === user?.id ? game?.player2_id : game?.player1_id;
  const myScore = game?.player1_id === user?.id ? game?.player1_score : game?.player2_score;
  const opponentScore = game?.player1_id === user?.id ? game?.player2_score : game?.player1_score;
  const myTurn = Boolean(game && user && game.current_turn_user_id === user.id && game.status === "active");
  const waiting = game?.status === "waiting";
  const isFirstMove = useMemo(() => board.flat().every((c) => !c), [board]);
  const profiles = useProfiles([game?.player1_id, game?.player2_id]);
  const meName = profiles[user?.id ?? ""]?.display_name ?? "You";
  const oppName = game?.is_solo && opponentId === BOT_USER_ID ? BOT_NAME : (opponentId ? profiles[opponentId]?.display_name ?? "Opponent" : "Waiting…");
  const oppAvatar = game?.is_solo && opponentId === BOT_USER_ID ? null : (opponentId ? profiles[opponentId]?.avatar_url : null);
  const meAvatar = profiles[user?.id ?? ""]?.avatar_url;
  const tilesRemaining = Array.isArray(game?.tile_bag) ? (game!.tile_bag as string[]).length : 0;

  // Show last-move banner (slide from right + blur)
  useEffect(() => {
    if (!game?.last_move) return;
    if (lastMoveAt.current === game.last_move.at) return;
    lastMoveAt.current = game.last_move.at;
    const moverId = game.last_move.user_id;
    const moverName = moverId === user?.id ? meName : (moverId === BOT_USER_ID ? BOT_NAME : oppName);
    setMoveBanner({ name: moverName, word: game.last_move.word, score: game.last_move.score, key: Date.now() });
    const t = setTimeout(() => setMoveBanner(null), 2800);
    return () => clearTimeout(t);
  }, [game?.last_move?.at, game?.last_move, user?.id, meName, oppName]);

  // Bot turn handling
  useEffect(() => {
    if (!game || !user) return;
    if (!game.is_solo) return;
    if (game.status !== "active") return;
    if (game.current_turn_user_id !== BOT_USER_ID) return;
    const t = setTimeout(() => playBotMove(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current_turn_user_id, game?.status, game?.is_solo]);

  async function playBotMove() {
    if (!game || !user) return;
    const { data: botPlayer } = await supabase.from("game_players").select("rack").eq("game_id", game.id).eq("user_id", BOT_USER_ID).maybeSingle();
    const botRack = Array.isArray(botPlayer?.rack) ? (botPlayer!.rack as string[]) : [];
    const move = findBotMove(board, botRack, isFirstMove);
    if (!move) {
      // bot passes
      await supabase.from("games").update({
        passes_in_a_row: game.passes_in_a_row + 1,
        current_turn_user_id: user.id,
      }).eq("id", game.id);
      return;
    }
    await commitMove({ asUser: BOT_USER_ID, asRack: botRack, placedTiles: move });
  }

  function placeTile(row: number, col: number) {
    if (!myTurn || swapMode) return;
    if (selectedRackIndex === null) return;
    if (board[row][col] || placed.some((t) => t.row === row && t.col === col)) return;
    const letter = rack[selectedRackIndex];
    if (!letter) return;
    // map back to baseRack index (rackOrder may reorder)
    const baseIdx = findFirstUnusedBaseIndex(letter);
    if (baseIdx < 0) return;
    setPlaced((items) => [...items, { row, col, letter, points: LETTER_POINTS[letter], rackIndex: baseIdx }]);
    setSelectedRackIndex(null);
  }

  function findFirstUnusedBaseIndex(letter: string) {
    const usedBase = new Set(placed.map((p) => p.rackIndex));
    for (let i = 0; i < baseRack.length; i++) {
      if (baseRack[i] === letter && !usedBase.has(i)) return i;
    }
    return -1;
  }

  function dropTileOnCell(row: number, col: number, displayIndex: number) {
    if (!myTurn || swapMode) return;
    if (board[row][col] || placed.some((t) => t.row === row && t.col === col)) return;
    const letter = rack[displayIndex];
    if (!letter) return;
    const baseIdx = findFirstUnusedBaseIndex(letter);
    if (baseIdx < 0) return;
    setPlaced((items) => [...items, { row, col, letter, points: LETTER_POINTS[letter], rackIndex: baseIdx }]);
    setSelectedRackIndex(null);
  }

  function recallTile(row: number, col: number) {
    setPlaced((items) => items.filter((t) => !(t.row === row && t.col === col)));
  }

  function rackClick(displayIndex: number) {
    if (swapMode) {
      setSwapSel((arr) => arr.includes(displayIndex) ? arr.filter((x) => x !== displayIndex) : [...arr, displayIndex]);
      return;
    }
    setSelectedRackIndex((idx) => idx === displayIndex ? null : displayIndex);
  }

  function shuffleRack() {
    const order = [...rack];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setRackOrder(order);
    setSelectedRackIndex(null);
  }

  function resetPlaced() { setPlaced([]); setSelectedRackIndex(null); }

  async function commitMove({ asUser, asRack, placedTiles }: { asUser: string; asRack: string[]; placedTiles: PlacedTile[] }) {
    if (!game) return;
    const validation = validatePlacement(board, placedTiles, isFirstMove);
    if (!validation.valid) { toast.error(validation.error); return; }
    const { totalScore: score, words } = scorePlacement(board, placedTiles);
    const invalid = words.filter((w) => !isValidWord(w));
    if (invalid.length) { toast.error(`Not a word: ${invalid.join(", ")}`); return; }

    setBusy(true);
    const nextBoard = board.map((r) => r.slice());
    placedTiles.forEach((tile) => {
      nextBoard[tile.row][tile.col] = { letter: tile.letter, points: tile.points, playerId: asUser };
    });
    // For human, placed has rackIndex; for bot we removed letters by reference
    let remainingRack: string[];
    if (asUser === user?.id) {
      const usedBase = new Set((placedTiles as (PlacedTile & { rackIndex?: number })[]).map((t) => t.rackIndex!));
      remainingRack = baseRack.filter((_, idx) => !usedBase.has(idx));
    } else {
      // bot: remove one occurrence per placed letter
      remainingRack = [...asRack];
      for (const t of placedTiles) {
        const idx = remainingRack.indexOf(t.letter);
        if (idx >= 0) remainingRack.splice(idx, 1);
      }
    }
    const bag = Array.isArray(game.tile_bag) ? (game.tile_bag as string[]) : [];
    const { drawn, remaining } = drawTiles(bag, RACK_SIZE - remainingRack.length);
    const nextRack = [...remainingRack, ...drawn];
    const isPlayer1 = game.player1_id === asUser;
    const nextTurnUser = isPlayer1 ? game.player2_id : game.player1_id;
    const turnDeadline = game.turn_seconds ? new Date(Date.now() + game.turn_seconds * 1000).toISOString() : null;
    const update: any = {
      board: nextBoard,
      tile_bag: remaining,
      current_turn_user_id: nextTurnUser,
      player1_score: game.player1_score + (isPlayer1 ? score : 0),
      player2_score: game.player2_score + (!isPlayer1 ? score : 0),
      passes_in_a_row: 0,
      turn_deadline: turnDeadline,
      last_move: { user_id: asUser, word: words[0] ?? "", words, score, at: new Date().toISOString() },
    };
    const [{ error: gameError }, { error: rackError }] = await Promise.all([
      supabase.from("games").update(update).eq("id", game.id),
      supabase.from("game_players").update({ rack: nextRack as any }).eq("game_id", game.id).eq("user_id", asUser),
    ]);
    setBusy(false);
    if (gameError || rackError) { toast.error(gameError?.message || rackError?.message || "Move failed"); return; }
    if (asUser === user?.id) { resetPlaced(); }
  }

  async function submitMove() {
    if (!user || !player) return;
    await commitMove({ asUser: user.id, asRack: baseRack, placedTiles: placed });
  }

  async function passTurn() {
    if (!game || !user || !myTurn) return;
    const nextPasses = game.passes_in_a_row + 1;
    const shouldFinish = nextPasses >= 4;
    const winnerId = game.player1_score === game.player2_score ? null : game.player1_score > game.player2_score ? game.player1_id : game.player2_id;
    await supabase.from("games").update({
      passes_in_a_row: nextPasses,
      current_turn_user_id: game.player1_id === user.id ? game.player2_id : game.player1_id,
      status: shouldFinish ? "finished" : game.status,
      winner_id: shouldFinish ? winnerId : game.winner_id,
      turn_deadline: game.turn_seconds ? new Date(Date.now() + game.turn_seconds * 1000).toISOString() : null,
    }).eq("id", game.id);
    resetPlaced();
  }

  async function doSwap() {
    if (!game || !user || !myTurn || swapSel.length === 0) return;
    const bag = Array.isArray(game.tile_bag) ? (game.tile_bag as string[]) : [];
    if (bag.length < swapSel.length) { toast.error("Not enough tiles in the bag"); return; }
    const lettersToSwap = swapSel.map((i) => rack[i]);
    const usedDisplay = new Set(swapSel);
    const keptDisplay = rack.filter((_, i) => !usedDisplay.has(i));
    const newBag = [...bag, ...lettersToSwap];
    // shuffle
    for (let i = newBag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newBag[i], newBag[j]] = [newBag[j], newBag[i]]; }
    const { drawn, remaining } = drawTiles(newBag, swapSel.length);
    const nextRack = [...keptDisplay, ...drawn];
    await Promise.all([
      supabase.from("games").update({
        tile_bag: remaining as any,
        current_turn_user_id: game.player1_id === user.id ? game.player2_id : game.player1_id,
        passes_in_a_row: 0,
        turn_deadline: game.turn_seconds ? new Date(Date.now() + game.turn_seconds * 1000).toISOString() : null,
      }).eq("id", game.id),
      supabase.from("game_players").update({ rack: nextRack as any }).eq("game_id", game.id).eq("user_id", user.id),
    ]);
    setSwapMode(false); setSwapSel([]); setRackOrder(null);
    toast.success(`Swapped ${swapSel.length} tile${swapSel.length > 1 ? "s" : ""}`);
  }

  async function resign() {
    if (!game || !user) return;
    const winner = opponentId ?? null;
    await supabase.from("games").update({ status: "finished", winner_id: winner }).eq("id", game.id);
    toast.error("You resigned");
  }

  if (!game || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-foreground">Loading…</div>;
  }

  // Timer remaining
  const remainingMs = game.turn_deadline ? Math.max(0, new Date(game.turn_deadline).getTime() - now) : null;
  const remainingS = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  return (
    <div className="min-h-screen bg-gradient-hero pb-24">
      {/* Modern header with player vs player */}
      <header className="sticky top-0 z-20 glass border-b border-border/40 px-3 py-2.5">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/lobby"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="flex-1 flex items-center justify-center gap-3">
            <PlayerCard name={meName} avatar={meAvatar} score={myScore ?? 0} active={myTurn} />
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground font-mono">{game.join_code}</div>
              <Badge variant={waiting ? "secondary" : myTurn ? "default" : "secondary"} className="text-[10px]">
                {waiting ? "Waiting" : game.status === "finished" ? "Done" : myTurn ? "Your turn" : "Their turn"}
              </Badge>
            </div>
            <PlayerCard name={oppName} avatar={oppAvatar} score={opponentScore ?? 0} active={!myTurn && game.status === "active"} reverse />
          </div>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Chat"><MessageCircle className="h-4 w-4" /></Button></SheetTrigger>
            <SheetContent className="flex w-[92vw] flex-col sm:max-w-md">
              <SheetHeader><SheetTitle>Live chat</SheetTitle></SheetHeader>
              <Chat gameId={game.id} userId={user.id} />
            </SheetContent>
          </Sheet>
        </div>
        {remainingS !== null && game.status === "active" && (
          <div className="mx-auto max-w-5xl mt-2 flex items-center justify-center gap-2 text-xs">
            <Clock className="h-3 w-3" />
            <span className={remainingS <= 10 ? "text-destructive font-bold tabular-nums" : "text-muted-foreground tabular-nums"}>
              {Math.floor(remainingS / 60)}:{String(remainingS % 60).padStart(2, "0")}
            </span>
          </div>
        )}
      </header>

      {/* Live move banner — slides from right with blur */}
      {moveBanner && (
        <>
          <div className="fixed inset-0 z-30 pointer-events-none animate-fade-in" style={{ backdropFilter: "blur(6px)", background: "hsl(var(--background) / 0.4)" }} />
          <div key={moveBanner.key} className="fixed top-1/2 right-0 z-40 -translate-y-1/2 pointer-events-none">
            <div className="animate-slide-in-right bg-card border border-border shadow-elev rounded-l-2xl pl-5 pr-6 py-4 max-w-[88vw]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">{moveBanner.name} played</div>
                  <div className="text-xl font-display tracking-wider">{moveBanner.word}</div>
                  <div className="text-sm font-bold text-primary">+{moveBanner.score} pts</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <main className="mx-auto grid max-w-5xl gap-4 p-3 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          {waiting && (
            <Card className="p-3 text-center text-sm shadow-soft animate-fade-in">
              Share code <strong className="font-mono text-primary">{game.join_code}</strong> with another player.
            </Card>
          )}
          {game.status === "finished" && (
            <Card className="p-4 text-center shadow-soft animate-scale-in">
              <Trophy className="mx-auto h-8 w-8 text-primary mb-1" />
              <p className="font-display text-lg">
                {!game.winner_id ? "It's a draw!" : game.winner_id === user.id ? "You won! 🎉" : `${oppName} won`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{myScore} – {opponentScore}</p>
            </Card>
          )}
          {opponentId && opponentId !== BOT_USER_ID && <HeadToHead meId={user.id} opponentId={opponentId} opponentName={oppName} />}

          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
            <span>Tiles in bag: <strong className="text-foreground tabular-nums">{tilesRemaining}</strong></span>
            {placed.length > 0 && <span className="animate-fade-in">+{scorePlacement(board, placed).totalScore} potential pts</span>}
          </div>

          <Board
            board={board}
            placed={placed}
            disabled={!myTurn || busy || swapMode}
            onCellClick={placeTile}
            onCellDrop={dropTileOnCell}
            onPlacedTileClick={recallTile}
          />

          <Rack
            rack={rack}
            selectedIndex={selectedRackIndex}
            disabled={!myTurn || busy}
            swapMode={swapMode}
            swapSelected={swapSel}
            onSelect={rackClick}
          />

          {/* Action bar */}
          {!swapMode ? (
            <div className="grid grid-cols-4 gap-2">
              <Button variant="secondary" onClick={shuffleRack} disabled={busy} title="Shuffle"><Shuffle className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => setSwapMode(true)} disabled={!myTurn || busy || tilesRemaining < 1} title="Swap tiles"><Repeat className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={resetPlaced} disabled={placed.length === 0 || busy} title="Recall"><RotateCcw className="h-4 w-4" /></Button>
              <Button onClick={submitMove} disabled={!myTurn || placed.length === 0 || busy}>Play</Button>
              <Button variant="outline" onClick={passTurn} disabled={!myTurn || busy} className="col-span-2">Pass</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy || game.status !== "active"} className="col-span-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Flag className="h-4 w-4" /> Resign
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resign this game?</AlertDialogTitle>
                    <AlertDialogDescription>You'll lose this match. This counts as a loss in your stats.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Resign</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 animate-fade-in">
              <Button variant="ghost" onClick={() => { setSwapMode(false); setSwapSel([]); }}>Cancel</Button>
              <Button onClick={doSwap} disabled={swapSel.length === 0} className="col-span-2">
                Swap {swapSel.length} tile{swapSel.length === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <Card className="h-[620px] p-4 shadow-soft">
            <h2 className="mb-3 text-xl">Live chat</h2>
            <Chat gameId={game.id} userId={user.id} />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function PlayerCard({ name, avatar, score, active, reverse }: { name: string; avatar?: string | null; score: number; active: boolean; reverse?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`}>
      <div className={`relative ${active ? "ring-2 ring-primary rounded-full ring-offset-2 ring-offset-background" : ""}`}>
        <ProfilePic url={avatar} name={name} size="sm" />
        {active && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />}
      </div>
      <div className={reverse ? "text-right" : ""}>
        <div className="text-[11px] font-medium leading-tight max-w-[80px] truncate">{name}</div>
        <div className="text-base font-bold tabular-nums leading-tight">{score}</div>
      </div>
    </div>
  );
}