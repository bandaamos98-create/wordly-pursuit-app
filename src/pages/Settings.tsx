import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, LogOut, Moon, Sun, Monitor, KeyRound, Info, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfilePic } from "@/components/ProfilePic";
import { toast } from "sonner";

export default function Settings() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, refresh } = useProfile(user?.id);
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/", { replace: true }); }, [user, loading, navigate]);
  useEffect(() => { if (profile) setName(profile.display_name); }, [profile]);

  async function saveName() {
    if (!user) return;
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refresh(); }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    await refresh();
    setUploading(false);
    toast.success("Avatar updated");
  }

  async function setThemePref(t: "light" | "dark" | "system") {
    setTheme(t);
    if (user) await supabase.from("profiles").update({ theme: t }).eq("id", user.id);
  }

  async function updatePassword() {
    if (pw1.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (pw1 !== pw2) { toast.error("Passwords don't match"); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) { toast.error(error.message); return; }
    setPw1(""); setPw2("");
    toast.success("Password updated. You can now sign in with email + password.");
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-foreground">Loading…</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-hero pb-10">
      <header className="sticky top-0 z-10 glass border-b border-border/40 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/lobby"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 animate-fade-in">
        <Card className="p-5 shadow-soft">
          <h2 className="mb-4 text-lg">Profile</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative group"
              aria-label="Change avatar"
              disabled={uploading}
            >
              <ProfilePic url={profile?.avatar_url} name={profile?.display_name || "?"} size="xl" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition">
                <Camera className="h-5 w-5 text-background" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
            />
            <div className="flex-1 text-sm">
              <p className="font-medium">{profile?.display_name}</p>
              <p className="text-muted-foreground text-xs">{user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">{profile?.wins ?? 0} wins · {profile?.games_played ?? 0} games</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="name">Display name</Label>
            <div className="flex gap-2">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              <Button onClick={saveName} disabled={saving}>Save</Button>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">Email is set by your sign-in account.</p>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-4 text-lg">Appearance</h2>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "light" as const, label: "Light", icon: Sun },
              { v: "dark" as const, label: "Dark", icon: Moon },
              { v: "system" as const, label: "System", icon: Monitor },
            ]).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setThemePref(v)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition hover:bg-secondary/60 ${theme === v ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-border"}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-3 text-lg">Account</h2>
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-1 text-lg flex items-center gap-2"><KeyRound className="h-4 w-4" /> Password</h2>
          <p className="mb-4 text-xs text-muted-foreground">Set or change a password so you can also sign in with email + password.</p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pw1">New password</Label>
              <Input id="pw1" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="pw2">Confirm password</Label>
              <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
            </div>
            <Button onClick={updatePassword} disabled={pwBusy || !pw1 || !pw2} className="w-full">
              {pwBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="mb-3 text-lg flex items-center gap-2"><Info className="h-4 w-4" /> About</h2>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              WordPlay is a real-time word battle game. Challenge friends, chat live, and climb the leaderboard.
            </p>
            <div className="rounded-lg border border-border bg-secondary/40 p-3 mt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Developer</p>
              <p className="font-medium">Amos Banda</p>
              <a href="mailto:bandaamod98@gmail.com" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" /> bandaamod98@gmail.com
              </a>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Version 1.0.0</p>
          </div>
        </Card>
      </main>
    </div>
  );
}