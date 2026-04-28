import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { freshTileBag, drawTiles, emptyBoard, generateJoinCode, RACK_SIZE } from "@/lib/game/constants";
import { LogOut, Plus, Users, Trophy } from "lucide-react";

type GameRow = {
  id: string;
  join_code: string;
  status: string;
  player1_id: string;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  updated_at: string;
  winner_id: string | null;
};

export default function Lobby() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [myGames, setMyGames] = useState<GameRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) { navigate("/", { replace: true }); return; }
    loadGames();
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => data && setDisplayName(data.display_name));

    const ch = supabase.channel("lobby-games")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => loadGames())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function loadGames() {
    if (!user) return;
    const { data } = await supabase
      .from("games")
      .select("*")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(20);
    setMyGames((data ?? []) as GameRow[]);
  }

  async function createGame() {
    if (!user) return;
    setCreating(true);
    try {
      const bag = freshTileBag();
      const { drawn, remaining } = drawTiles(bag, RACK_SIZE);
      const join_code = generateJoinCode();
      const { data: g, error } = await supabase.from("games").insert({
        join_code,
        player1_id: user.id,
        status: "waiting",
        board: emptyBoard() as any,
        tile_bag: remaining as any,
        current_turn_user_id: user.id,
      }).select().single();
      if (error) throw error;
      const { error: pErr } = await supabase.from("game_players").insert({
        game_id: g.id, user_id: user.id, rack: drawn as any,
      });
      if (pErr) throw pErr;
      navigate(`/game/${g.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create game");
    } finally {
      setCreating(false);
    }
  }

  async function joinGame() {
    if (!user) return;
    const c = code.trim().toUpperCase();
    if (c.length !== 5) { toast.error("Enter a 5-character code"); return; }
    const { data: g, error } = await supabase
      .from("games").select("*").eq("join_code", c).maybeSingle();
    if (error || !g) { toast.error("Game not found"); return; }
    if (g.player1_id === user.id) { navigate(`/game/${g.id}`); return; }
    if (g.player2_id) { toast.error("Game is full"); return; }
    if (g.status !== "waiting") { toast.error("Game already started"); return; }

    const bagArr = (g.tile_bag as unknown as string[]) ?? [];
    const { drawn, remaining } = drawTiles(bagArr, RACK_SIZE);
    const { error: uErr } = await supabase.from("games").update({
      player2_id: user.id, status: "active", tile_bag: remaining as any,
    }).eq("id", g.id);
    if (uErr) { toast.error(uErr.message); return; }
    await supabase.from("game_players").insert({
      game_id: g.id, user_id: user.id, rack: drawn as any,
    });
    navigate(`/game/${g.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h1 className="text-2xl text-primary">WordPlay</h1>
          <p className="text-xs text-muted-foreground">Hi, {displayName || "Player"}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Card className="p-5 shadow-soft">
          <h2 className="text-xl mb-3 flex items-center gap-2"><Plus className="w-5 h-5" /> New Game</h2>
          <Button onClick={createGame} disabled={creating} className="w-full" size="lg">
            {creating ? "Creating..." : "Create Game"}
          </Button>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="text-xl mb-3 flex items-center gap-2"><Users className="w-5 h-5" /> Join with Code</h2>
          <div className="flex gap-2">
            <Input
              placeholder="ABCDE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              className="uppercase tracking-widest text-center font-mono text-lg"
            />
            <Button onClick={joinGame}>Join</Button>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="text-xl mb-3 flex items-center gap-2"><Trophy className="w-5 h-5" /> Your Games</h2>
          {myGames.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games yet. Create or join one above.</p>
          ) : (
            <ul className="space-y-2">
              {myGames.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => navigate(`/game/${g.id}`)}
                    className="w-full text-left p-3 rounded-md bg-secondary hover:bg-secondary/70 transition flex justify-between items-center"
                  >
                    <div>
                      <div className="font-mono font-bold">{g.join_code}</div>
                      <div className="text-xs text-muted-foreground capitalize">{g.status}</div>
                    </div>
                    <div className="text-sm font-bold">
                      {g.player1_id === user?.id ? g.player1_score : g.player2_score}
                      <span className="text-muted-foreground"> – </span>
                      {g.player1_id === user?.id ? g.player2_score : g.player1_score}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}