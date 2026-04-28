import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Check, X, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProfilePic } from "@/components/ProfilePic";
import { toast } from "sonner";

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Friendship[]>([]);

  useEffect(() => { if (!user) navigate("/", { replace: true }); }, [user, navigate]);
  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("friendships").select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    setRows((data ?? []) as Friendship[]);
  }

  const otherIds = rows.map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id));
  const profiles = useProfiles(otherIds);

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user?.id);

  async function sendRequest() {
    if (!user) return;
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    const { data: foundId, error: lookErr } = await supabase.rpc("find_user_id_by_email", { _email: e });
    if (lookErr) { setBusy(false); toast.error(lookErr.message); return; }
    if (!foundId) { setBusy(false); toast.error("No player with that email"); return; }
    if (foundId === user.id) { setBusy(false); toast.error("That's you!"); return; }
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id, addressee_id: foundId, status: "pending",
    });
    setBusy(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Friendship already exists" : error.message); return; }
    toast.success("Friend request sent");
    setEmail("");
    load();
  }

  async function respond(id: string, accept: boolean) {
    if (accept) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    } else {
      await supabase.from("friendships").delete().eq("id", id);
    }
    load();
  }

  async function remove(id: string) {
    await supabase.from("friendships").delete().eq("id", id);
    load();
  }

  if (!user) return null;

  function FriendRow({ r }: { r: Friendship }) {
    const otherId = r.requester_id === user!.id ? r.addressee_id : r.requester_id;
    const p = profiles[otherId];
    return (
      <li className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <ProfilePic url={p?.avatar_url} name={p?.display_name || "?"} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p?.display_name ?? "Player"}</p>
            <p className="truncate text-xs text-muted-foreground">{p?.wins ?? 0}W · {p?.games_played ?? 0} games</p>
          </div>
        </div>
        <div className="flex gap-1">
          {r.status === "pending" && r.addressee_id === user!.id && (
            <>
              <Button size="icon" variant="ghost" onClick={() => respond(r.id, true)} aria-label="Accept"><Check className="h-4 w-4 text-primary" /></Button>
              <Button size="icon" variant="ghost" onClick={() => respond(r.id, false)} aria-label="Decline"><X className="h-4 w-4" /></Button>
            </>
          )}
          {r.status === "accepted" && (
            <Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
          )}
          {r.status === "pending" && r.requester_id === user!.id && (
            <span className="text-xs text-muted-foreground self-center pr-2">Pending</span>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero pb-10">
      <header className="sticky top-0 z-10 glass border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/lobby"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl">Friends</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 animate-fade-in">
        <Card className="p-5 shadow-soft">
          <h2 className="mb-3 text-lg flex items-center gap-2"><UserPlus className="h-5 w-5" /> Add a friend</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                type="email"
              />
            </div>
            <Button onClick={sendRequest} disabled={busy}>Send</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The player must already have a WordPlay account.</p>
        </Card>

        {incoming.length > 0 && (
          <Card className="p-5 shadow-soft animate-scale-in">
            <h2 className="mb-3 text-lg">Friend requests · {incoming.length}</h2>
            <ul className="space-y-2">{incoming.map((r) => <FriendRow key={r.id} r={r} />)}</ul>
          </Card>
        )}

        <Card className="p-5 shadow-soft">
          <h2 className="mb-3 text-lg">Friends · {accepted.length}</h2>
          {accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet. Add one above.</p>
          ) : (
            <ul className="space-y-2">{accepted.map((r) => <FriendRow key={r.id} r={r} />)}</ul>
          )}
        </Card>

        {outgoing.length > 0 && (
          <Card className="p-5 shadow-soft">
            <h2 className="mb-3 text-lg text-muted-foreground">Sent · {outgoing.length}</h2>
            <ul className="space-y-2">{outgoing.map((r) => <FriendRow key={r.id} r={r} />)}</ul>
          </Card>
        )}
      </main>
    </div>
  );
}