import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Index() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/lobby", { replace: true });
  }, [loading, navigate, user]);

  return (
    <main className="min-h-screen bg-gradient-hero px-5 py-8 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between">
        <div className="pt-6 text-center">
          <div className="mb-5 flex justify-center gap-2" aria-hidden="true">
            {"WORD".split("").map((letter) => (
              <span key={letter} className="tile h-14 w-14 text-3xl animate-float">
                {letter}
              </span>
            ))}
          </div>
          <h1 className="text-5xl text-primary">WordPlay</h1>
          <p className="mt-3 text-base text-muted-foreground">Real-time word battles with friends, live chat, and head-to-head records.</p>
        </div>

        <Card className="mb-4 p-5 shadow-soft">
          <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-muted-foreground">
            <div className="rounded-md bg-secondary p-3"><span className="block text-lg text-primary">15×15</span>Board</div>
            <div className="rounded-md bg-secondary p-3"><span className="block text-lg text-primary">Live</span>Chat</div>
            <div className="rounded-md bg-secondary p-3"><span className="block text-lg text-primary">W/L/D</span>Stats</div>
          </div>
          <Button onClick={signInWithGoogle} disabled={loading} className="h-12 w-full text-base" size="lg">
            <Sparkles className="h-4 w-4" /> Continue with Google
          </Button>
        </Card>
      </section>
    </main>
  );
}