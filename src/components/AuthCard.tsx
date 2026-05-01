import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

type Mode = "signin" | "signup";

export default function AuthCard() {
  const { signInWithGoogle, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em.includes("@")) { toast.error("Enter a valid email"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: em, password,
          options: {
            emailRedirectTo: `${window.location.origin}/lobby`,
            data: { display_name: name.trim() || em.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6 shadow-soft">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
        <button
          onClick={() => setMode("signin")}
          className={`rounded-md py-2 text-sm font-medium transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >Sign in</button>
        <button
          onClick={() => setMode("signup")}
          className={`rounded-md py-2 text-sm font-medium transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >Sign up</button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} />
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full text-base">
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button onClick={signInWithGoogle} disabled={loading} variant="outline" className="h-11 w-full text-base">
        <Sparkles className="h-4 w-4" /> Continue with Google
      </Button>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        By continuing, you agree to play fair and have fun.
      </p>
    </Card>
  );
}