import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthCard from "@/components/AuthCard";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/lobby", { replace: true });
  }, [loading, navigate, user]);

  return (
    <main className="min-h-screen bg-gradient-hero px-4 py-6 sm:px-6 sm:py-10 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center gap-6 sm:gap-8">
        <div className="text-center">
          <div className="mb-5 flex justify-center gap-1.5 sm:gap-2" aria-hidden="true">
            {"WORD".split("").map((letter) => (
              <span key={letter} className="tile h-12 w-12 sm:h-14 sm:w-14 text-2xl sm:text-3xl animate-float">
                {letter}
              </span>
            ))}
          </div>
          <h1 className="text-4xl sm:text-5xl text-primary">WordPlay</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground px-2">
            Real-time word battles with friends, live chat, and head-to-head records.
          </p>
        </div>
        <AuthCard />
      </section>
    </main>
  );
}