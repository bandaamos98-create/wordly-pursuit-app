import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProfilePic } from "@/components/ProfilePic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { freshTileBag, drawTiles, emptyBoard, generateJoinCode, RACK_SIZE } from "@/lib/game/constants";
import { BOT_USER_ID } from "@/lib/bot";
import { Bot, Plus, Users, Trophy, Settings as SettingsIcon, UsersRound, Mail, Sparkles, Zap, Crown } from "lucide-react";

type GameRow = {
  id: string; join_code: string; status: string;
  player1_id: string; player2_id: string | null;
  player1_score: number; player2_score: number;
  updated_at: string; winner_id: string | null;
  is_solo: boolean; mode: string;
};

type GameMode = "classic" | "blitz" | "marathon";
const MODES: { id: GameMode; name: string; desc: string; icon: typeof Sparkles }[] = [
  { id: "classic", name: "Classic", desc: "Standard rules, no time limit", icon: Sparkles },
  { id: "blitz", name: "Blitz", desc: "Fast-paced, 60s per turn", icon: Zap },
  { id: "marathon", name: "Marathon", desc: "Two-bag draw, 200+ pts to win", icon: Crown },
];

export default function Lobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useProfile(user?.id);
  const [code, setCode] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<GameMode>("classic");

  useEffect(() => {
    if (!user) { navigate("/", { replace: true }); return; }
    loadGames();
    const ch = supabase.channel(`lobby-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => loadGames())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function loadGames() {
    if (!user) return;
    const { data } = await supabase.from("games").select("*")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false }).limit(30);
    setGames((data ?? []) as GameRow[]);
  }

  const ongoing = games.filter((g) => g.status !== "finished");
  const finished = games.filter((g) => g.status === "finished");
  const opponentIds = games.map((g) => (g.player1_id === user?.id ? g.player2_id : g.player1_id));
  const profiles = useProfiles(opponentIds);

  async function createMultiplayer(turnSeconds: number | null = null) {
    if (!user) return;
    setCreating(true);
    try {
      const bag = freshTileBag();
      const { drawn, remaining } = drawTiles(bag, RACK_SIZE);
      const { data: g, error } = await supabase.from("games").insert({
        join_code: generateJoinCode(),
        player1_id: user.id, status: "waiting",
        board: emptyBoard() as any, tile_bag: remaining as any,
        current_turn_user_id: user.id,
        mode, is_solo: false,
        turn_seconds: turnSeconds,
      }).select().single();
      if (error) throw error;
      await supabase.from("game_players").insert({ game_id: g.id, user_id: user.id, rack: drawn as any });
      navigate(`/game/${g.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create game");
    } finally { setCreating(false); }
  }

  async function createSolo() {
    if (!user) return;
    setCreating(true);
    try {
      const bag = freshTileBag();
      const p1 = drawTiles(bag, RACK_SIZE);
      const p2 = drawTiles(p1.remaining, RACK_SIZE);
      const { data: g, error } = await supabase.from("games").insert({
        join_code: generateJoinCode(),
        player1_id: user.id, player2_id: BOT_USER_ID,
        status: "active",
        board: emptyBoard() as any, tile_bag: p2.remaining as any,
        current_turn_user_id: user.id,
        mode, is_solo: true,
      }).select().single();
      if (error) throw error;
      await supabase.from("game_players").insert([
        { game_id: g.id, user_id: user.id, rack: p1.drawn as any },
        { game_id: g.id, user_id: BOT_USER_ID, rack: p2.drawn as any },
      ]);
      navigate(`/game/${g.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create solo game");
    } finally { setCreating(false); }
  }

  async function joinGame() {
    if (!user) return;
    const c = code.trim().toUpperCase();
    if (c.length !== 5) { toast.error("Enter a 5-character code"); return; }
    const { data: g, error } = await supabase.from("games").select("*").eq("join_code", c).maybeSingle();
    if (error || !g) { toast.error("Game not found"); return; }
    if (g.player1_id === user.id) { navigate(`/game/${g.id}`); return; }
    if (g.player2_id) { toast.error("Game is full"); return; }
    if (g.status !== "waiting") { toast.error("Game already started"); return; }
    const bagArr = (g.tile_bag as unknown as string[]) ?? [];
    const { drawn, remaining } = drawTiles(bagArr, RACK_SIZE);
    await supabase.from("games").update({ player2_id: user.id, status: "active", tile_bag: remaining as any }).eq("id", g.id);
    await supabase.from("game_players").insert({ game_id: g.id, user_id: user.id, rack: drawn as any });
    navigate(`/game/${g.id}`);
  }

  function GameItem({ g }: { g: GameRow }) {
    const oppId = g.player1_id === user?.id ? g.player2_id : g.player1_id;
    const oppP = oppId ? profiles[oppId] : null;
    const oppName = g.is_solo && oppId === BOT_USER_ID ? "WordBot" : (oppP?.display_name ?? "Waiting…");
    const myScore = g.player1_id === user?.id ? g.player1_score : g.player2_score;
    const oppScore = g.player1_id === user?.id ? g.player2_score : g.player1_score;
    const won = g.winner_id === user?.id;
    const draw = g.status === "finished" && !g.winner_id;
    return (
      <button
        onClick={() => navigate(`/game/${g.id}`)}
        className="w-full rounded-xl bg-card hover:bg-secondary/60 transition border border-border p-3 flex items-center gap-3 text-left animate-fade-in"
      >
        <ProfilePic url={oppP?.avatar_url} name={oppName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-sm">{oppName}</p>
            {g.is_solo && <Badge variant="secondary" className="text-[10px] h-4 px-1"><Bot className="h-2.5 w-2.5 mr-0.5" />Bot</Badge>}
            {g.mode !== "classic" && <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{g.mode}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {g.status === "finished" ? (draw ? "Draw" : won ? "You won" : "Lost") : g.status}
            {" · "}<span className="font-mono">{g.join_code}</span>
          </p>
        </div>
        <div className="text-right tabular-nums">
          <div className={`text-lg font-bold ${won ? "text-primary" : ""}`}>{myScore}</div>
          <div className="text-xs text-muted-foreground">vs {oppScore}</div>
        </div>
      </button>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-hero pb-10">
      <header className="sticky top-0 z-10 glass border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/settings" className="flex items-center gap-3 min-w-0">
            <ProfilePic url={profile?.avatar_url} name={profile?.display_name} size="md" />
            <div className="min-w-0">
              <h1 className="text-base font-display truncate">{profile?.display_name ?? "Player"}</h1>
              <p className="text-xs text-muted-foreground">{profile?.wins ?? 0} wins · {profile?.games_played ?? 0} games</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild><Link to="/friends" aria-label="Friends"><UsersRound className="h-5 w-5" /></Link></Button>
            <Button variant="ghost" size="icon" asChild><Link to="/settings" aria-label="Settings"><SettingsIcon className="h-5 w-5" /></Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 animate-fade-in">
        {/* Game mode picker */}
        <Card className="p-4 shadow-soft">
          <h2 className="mb-3 text-base font-display">Game mode</h2>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition text-center ${active ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-secondary/60"}`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium">{m.name}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{MODES.find((m) => m.id === mode)?.desc}</p>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 shadow-soft hover:shadow-elev transition cursor-pointer" onClick={createSolo}>
            <Bot className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-medium">Solo vs Bot</h3>
            <p className="text-xs text-muted-foreground mt-1">Play instantly</p>
          </Card>
          <Card className="p-4 shadow-soft hover:shadow-elev transition cursor-pointer" onClick={() => createMultiplayer()}>
            <Plus className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-medium">New Match</h3>
            <p className="text-xs text-muted-foreground mt-1">Share code with anyone</p>
          </Card>
        </div>

        {/* Invite friend */}
        <Card className="p-4 shadow-soft">
          <InviteFriend mode={mode} />
        </Card>

        {/* Join with code */}
        <Card className="p-4 shadow-soft">
          <h2 className="mb-3 text-base font-display flex items-center gap-2"><Users className="h-4 w-4" /> Join with code</h2>
          <div className="flex gap-2">
            <Input placeholder="ABCDE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5}
              className="uppercase tracking-[0.4em] text-center font-mono text-lg h-12" />
            <Button onClick={joinGame} size="lg">Join</Button>
          </div>
        </Card>

        {/* Ongoing */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground uppercase tracking-wider">Ongoing · {ongoing.length}</h2>
          {ongoing.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground text-center shadow-soft">No active games</Card>
          ) : (
            <ul className="space-y-2">{ongoing.map((g) => <li key={g.id}><GameItem g={g} /></li>)}</ul>
          )}
        </section>

        {/* Previous */}
        {finished.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5" /> Previous · {finished.length}
            </h2>
            <ul className="space-y-2">{finished.map((g) => <li key={g.id}><GameItem g={g} /></li>)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}

function InviteFriend({ mode }: { mode: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [timer, setTimer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!user) return;
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    const { data: foundId, error: lookErr } = await supabase.rpc("find_user_id_by_email", { _email: e });
    if (lookErr) { setBusy(false); toast.error(lookErr.message); return; }
    if (!foundId) { setBusy(false); toast.error("No player with that email"); return; }
    if (foundId === user.id) { setBusy(false); toast.error("That's you!"); return; }

    const bag = freshTileBag();
    const { drawn, remaining } = drawTiles(bag, RACK_SIZE);
    const { data: g, error } = await supabase.from("games").insert({
      join_code: generateJoinCode(),
      player1_id: user.id, status: "waiting",
      board: emptyBoard() as any, tile_bag: remaining as any,
      current_turn_user_id: user.id,
      mode, is_solo: false, turn_seconds: timer,
    }).select().single();
    if (error || !g) { setBusy(false); toast.error(error?.message ?? "Failed"); return; }
    await supabase.from("game_players").insert({ game_id: g.id, user_id: user.id, rack: drawn as any });
    await supabase.from("game_invites").insert({ game_id: g.id, inviter_id: user.id, invitee_id: foundId, status: "pending" });
    setBusy(false);
    setOpen(false);
    toast.success("Invite sent");
    navigate(`/game/${g.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center justify-between w-full text-left">
          <div>
            <h2 className="text-base font-display flex items-center gap-2"><Mail className="h-4 w-4" /> Invite by email</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Challenge a friend with optional timer</p>
          </div>
          <span className="text-primary text-sm font-medium">Open →</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a player</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Their email</Label>
            <Input type="email" placeholder="player@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Turn timer (optional)</Label>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              <button onClick={() => setTimer(null)} className={`rounded-md border p-2 text-xs ${timer === null ? "border-primary bg-primary/10" : "border-border"}`}>Off</button>
              {[1, 2, 3, 4, 5].map((m) => (
                <button key={m} onClick={() => setTimer(m * 60)}
                  className={`rounded-md border p-2 text-xs ${timer === m * 60 ? "border-primary bg-primary/10" : "border-border"}`}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <Button onClick={send} disabled={busy} className="w-full">{busy ? "Sending…" : "Send invite & open game"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}