import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfilePic } from "@/components/ProfilePic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { freshTileBag, drawTiles, emptyBoard, generateJoinCode, RACK_SIZE } from "@/lib/game/constants";
import { Plus, Trophy, Settings as SettingsIcon, UsersRound, Check, X, Send, Swords } from "lucide-react";

type GameRow = {
  id: string; join_code: string; status: string;
  player1_id: string; player2_id: string | null;
  player1_score: number; player2_score: number;
  updated_at: string; winner_id: string | null;
};

type Friendship = { id: string; requester_id: string; addressee_id: string; status: string };
type Invite = { id: string; game_id: string; inviter_id: string; invitee_id: string; status: string; created_at: string };

export default function Lobby() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { profile } = useProfile(user?.id);
  const [games, setGames] = useState<GameRow[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/", { replace: true }); return; }
    loadAll();
    const ch = supabase.channel(`lobby-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => loadGames())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, () => loadInvites())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => loadFriends())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loading]);

  async function loadAll() { await Promise.all([loadGames(), loadFriends(), loadInvites()]); }
  async function loadGames() {
    if (!user) return;
    const { data } = await supabase.from("games").select("*")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false }).limit(30);
    setGames((data ?? []) as GameRow[]);
  }
  async function loadFriends() {
    if (!user) return;
    const { data } = await supabase.from("friendships").select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq("status", "accepted");
    setFriends((data ?? []) as Friendship[]);
  }
  async function loadInvites() {
    if (!user) return;
    const { data } = await supabase.from("game_invites").select("*")
      .eq("invitee_id", user.id).eq("status", "pending")
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  }

  const ongoing = games.filter((g) => g.status !== "finished");
  const finished = games.filter((g) => g.status === "finished");
  const opponentIds = games.map((g) => (g.player1_id === user?.id ? g.player2_id : g.player1_id));
  const friendIds = friends.map((f) => f.requester_id === user?.id ? f.addressee_id : f.requester_id);
  const inviterIds = invites.map((i) => i.inviter_id);
  const profiles = useProfiles([...opponentIds, ...friendIds, ...inviterIds]);

  // Stats
  const stats = useMemo(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const g of finished) {
      if (!g.winner_id) draws++;
      else if (g.winner_id === user?.id) wins++;
      else losses++;
    }
    return { wins, losses, draws };
  }, [finished, user?.id]);

  async function sendInviteToFriend(friendId: string) {
    if (!user) return;
    try {
      const bag = freshTileBag();
      const { drawn, remaining } = drawTiles(bag, RACK_SIZE);
      const { data: g, error } = await supabase.from("games").insert({
        join_code: generateJoinCode(),
        player1_id: user.id, status: "waiting",
        board: emptyBoard() as any, tile_bag: remaining as any,
        current_turn_user_id: user.id,
      }).select().single();
      if (error || !g) throw error;
      await supabase.from("game_players").insert({ game_id: g.id, user_id: user.id, rack: drawn as any });
      const { error: invErr } = await supabase.from("game_invites").insert({
        game_id: g.id, inviter_id: user.id, invitee_id: friendId, status: "pending",
      });
      if (invErr) throw invErr;
      setPickerOpen(false);
      toast.success("Invite sent — waiting for them to accept");
      navigate(`/game/${g.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send invite");
    }
  }

  async function acceptInvite(inv: Invite) {
    if (!user) return;
    const { data: acceptedGameId, error: acceptError } = await supabase.rpc("accept_game_invite" as any, { _invite_id: inv.id });
    if (acceptError || !acceptedGameId) { toast.error(acceptError?.message ?? "Could not accept invite"); return; }

    const { data: g, error } = await supabase.from("games").select("*").eq("id", acceptedGameId as string).maybeSingle();
    if (error || !g) { toast.error("Game accepted, but game details could not load"); navigate(`/game/${acceptedGameId}`); return; }
    const bagArr = Array.isArray(g.tile_bag) ? (g.tile_bag as unknown as string[]) : [];
    const { drawn, remaining } = drawTiles(bagArr, RACK_SIZE);
    await Promise.all([
      supabase.from("games").update({ tile_bag: remaining as any }).eq("id", acceptedGameId as string),
      supabase.from("game_players").upsert({ game_id: acceptedGameId as string, user_id: user.id, rack: drawn as any }, { onConflict: "game_id,user_id" }),
    ]);
    navigate(`/game/${acceptedGameId}`);
  }

  async function declineInvite(inv: Invite) {
    await supabase.from("game_invites").update({ status: "declined" }).eq("id", inv.id);
    loadInvites();
  }

  function GameItem({ g }: { g: GameRow }) {
    const oppId = g.player1_id === user?.id ? g.player2_id : g.player1_id;
    const oppP = oppId ? profiles[oppId] : null;
    const oppName = oppP?.display_name ?? "Waiting…";
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-foreground">Loading…</div>;
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
        {/* Stats: W / L / D */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile label="Wins" value={stats.wins} accent="text-primary" />
          <StatTile label="Losses" value={stats.losses} accent="text-destructive" />
          <StatTile label="Draws" value={stats.draws} accent="text-foreground" />
        </div>

        {/* New Match */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Card className="p-5 shadow-soft hover:shadow-elev transition cursor-pointer flex items-center gap-4">
              <div className="rounded-xl bg-primary/15 p-3">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg">New Match</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Pick a friend and send a play request</p>
              </div>
              <Swords className="h-5 w-5 text-muted-foreground" />
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Choose a friend to play</DialogTitle></DialogHeader>
            {friends.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-6">
                <UsersRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>You don't have any friends yet.</p>
                <Button asChild variant="link" className="mt-1"><Link to="/friends">Add friends →</Link></Button>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {friends.map((f) => {
                  const fid = f.requester_id === user!.id ? f.addressee_id : f.requester_id;
                  const p = profiles[fid];
                  return (
                    <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <ProfilePic url={p?.avatar_url} name={p?.display_name || "?"} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">{p?.display_name ?? "Player"}</p>
                        <p className="text-xs text-muted-foreground">{p?.wins ?? 0}W · {p?.games_played ?? 0} games</p>
                      </div>
                      <Button size="sm" onClick={() => sendInviteToFriend(fid)}>
                        <Send className="h-3.5 w-3.5" /> Invite
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DialogContent>
        </Dialog>

        {/* Friends shortcut */}
        <Card className="p-4 shadow-soft hover:shadow-elev transition cursor-pointer" onClick={() => navigate("/friends")}>
          <div className="flex items-center gap-3">
            <UsersRound className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="font-medium text-sm">My Friends</h3>
              <p className="text-xs text-muted-foreground">{friends.length} friend{friends.length === 1 ? "" : "s"} · manage requests</p>
            </div>
            <span className="text-primary text-sm">→</span>
          </div>
        </Card>

        {/* Incoming game invites */}
        {invites.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground uppercase tracking-wider">Game requests · {invites.length}</h2>
            <ul className="space-y-2">
              {invites.map((inv) => {
                const p = profiles[inv.inviter_id];
                return (
                  <li key={inv.id} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 animate-fade-in">
                    <ProfilePic url={p?.avatar_url} name={p?.display_name || "?"} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{p?.display_name ?? "Player"} invited you</p>
                      <p className="text-xs text-muted-foreground">Tap accept to start playing</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => declineInvite(inv)} aria-label="Decline"><X className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={() => acceptInvite(inv)}><Check className="h-3.5 w-3.5" /> Accept</Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="p-4 shadow-soft text-center">
      <div className={`text-3xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}