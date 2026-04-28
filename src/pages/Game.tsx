import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, RotateCcw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Board } from "@/components/Board";
import { Rack } from "@/components/Rack";
import { Chat } from "@/components/Chat";
import { HeadToHead } from "@/components/HeadToHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Board as BoardType, drawTiles, emptyBoard, LETTER_POINTS, RACK_SIZE } from "@/lib/game/constants";
import { PlacedTile, scorePlacement, validatePlacement } from "@/lib/game/scoring";

type GameRow = {
  id: string;
  join_code: string;
  status: string;
  board: unknown;
  tile_bag: unknown;
  current_turn_user_id: string | null;
  player1_id: string;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  passes_in_a_row: number;
};

type PlayerRow = { user_id: string; rack: unknown };

export default function Game() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameRow | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [placed, setPlaced] = useState<(PlacedTile & { rackIndex: number })[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (!gameId) return;
    loadGame();
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => loadGame())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, () => loadGame())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, user]);

  async function loadGame() {
    if (!gameId || !user) return;
    const [{ data: gameData }, { data: playerData }] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
      supabase.from("game_players").select("user_id,rack").eq("game_id", gameId).eq("user_id", user.id).maybeSingle(),
    ]);
    setGame((gameData as GameRow | null) ?? null);
    setPlayer((playerData as PlayerRow | null) ?? null);
  }

  const board = useMemo(() => (Array.isArray(game?.board) ? (game?.board as BoardType) : emptyBoard()), [game?.board]);
  const rack = useMemo(() => (Array.isArray(player?.rack) ? (player?.rack as string[]) : []), [player?.rack]);
  const opponentId = game?.player1_id === user?.id ? game?.player2_id : game?.player1_id;
  const myScore = game?.player1_id === user?.id ? game?.player1_score : game?.player2_score;
  const opponentScore = game?.player1_id === user?.id ? game?.player2_score : game?.player1_score;
  const myTurn = Boolean(game && user && game.current_turn_user_id === user.id && game.status === "active");
  const waiting = game?.status === "waiting";

  function placeTile(row: number, col: number) {
    if (!myTurn || selectedRackIndex === null || board[row][col] || placed.some((tile) => tile.row === row && tile.col === col)) return;
    const letter = rack[selectedRackIndex];
    if (!letter) return;
    setPlaced((items) => [...items, { row, col, letter, points: LETTER_POINTS[letter], rackIndex: selectedRackIndex }]);
    setSelectedRackIndex(null);
  }

  function resetPlaced() {
    setPlaced([]);
    setSelectedRackIndex(null);
  }

  async function submitMove() {
    if (!game || !user || !player || !myTurn) return;
    const validation = validatePlacement(board, placed, board.flat().every((cell) => !cell));
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    setBusy(true);
    const score = scorePlacement(board, placed).totalScore;
    const nextBoard = board.map((row) => row.slice());
    placed.forEach((tile) => {
      nextBoard[tile.row][tile.col] = { letter: tile.letter, points: tile.points, playerId: user.id };
    });
    const remainingRack = rack.filter((_, index) => !placed.some((tile) => tile.rackIndex === index));
    const bag = Array.isArray(game.tile_bag) ? (game.tile_bag as string[]) : [];
    const { drawn, remaining } = drawTiles(bag, RACK_SIZE - remainingRack.length);
    const nextRack = [...remainingRack, ...drawn];
    const isPlayer1 = game.player1_id === user.id;
    const update = {
      board: nextBoard as any,
      tile_bag: remaining as any,
      current_turn_user_id: isPlayer1 ? game.player2_id : game.player1_id,
      player1_score: game.player1_score + (isPlayer1 ? score : 0),
      player2_score: game.player2_score + (!isPlayer1 ? score : 0),
      passes_in_a_row: 0,
    };
    const [{ error: gameError }, { error: rackError }] = await Promise.all([
      supabase.from("games").update(update).eq("id", game.id),
      supabase.from("game_players").update({ rack: nextRack as any }).eq("game_id", game.id).eq("user_id", user.id),
    ]);
    setBusy(false);
    if (gameError || rackError) {
      toast.error(gameError?.message || rackError?.message || "Move failed");
      return;
    }
    toast.success(`Scored ${score} points`);
    resetPlaced();
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
    }).eq("id", game.id);
    resetPlaced();
  }

  if (!game || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-foreground">Loading game…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-hero pb-5">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/lobby"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-xl text-primary">{game.join_code}</h1>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant={myTurn ? "default" : "secondary"}>{waiting ? "Waiting" : myTurn ? "Your turn" : game.status}</Badge>
              <span>{myScore} – {opponentScore}</span>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon"><MessageCircle className="h-4 w-4" /></Button></SheetTrigger>
            <SheetContent className="flex w-[92vw] flex-col sm:max-w-md">
              <SheetHeader><SheetTitle>Live chat</SheetTitle></SheetHeader>
              <Chat gameId={game.id} userId={user.id} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-3 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {waiting && <Card className="p-3 text-center text-sm shadow-soft">Share code <strong className="font-mono text-primary">{game.join_code}</strong> with another player.</Card>}
          {game.status === "finished" && <Card className="p-3 text-center text-sm shadow-soft"><Trophy className="mr-1 inline h-4 w-4 text-primary" /> Game finished.</Card>}
          {opponentId && <HeadToHead meId={user.id} opponentId={opponentId} opponentName="Opponent" />}
          <Board board={board} placed={placed} disabled={!myTurn || busy} onCellClick={placeTile} />
          <Rack rack={rack} selectedIndex={selectedRackIndex} disabled={!myTurn || busy} onSelect={setSelectedRackIndex} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={resetPlaced} disabled={placed.length === 0 || busy}><RotateCcw className="h-4 w-4" />Reset</Button>
            <Button onClick={submitMove} disabled={!myTurn || placed.length === 0 || busy} className="col-span-2">Play word</Button>
            <Button variant="outline" onClick={passTurn} disabled={!myTurn || busy} className="col-span-3">Pass turn</Button>
          </div>
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