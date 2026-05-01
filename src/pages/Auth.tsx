import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthCard from "@/components/AuthCard";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/lobby", { replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen bg-gradient-hero px-4 py-6 sm:px-6 sm:py-10 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center gap-6 sm:gap-8">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl mb-2 text-primary">WordPlay</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Real-time multiplayer word battles</p>
        </div>
        <AuthCard />
      </section>
    </main>
  );
}