import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Auth() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/lobby", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-hero">
      <div className="text-center mb-8">
        <h1 className="text-5xl mb-3 text-primary">WordPlay</h1>
        <p className="text-muted-foreground">Real-time multiplayer word battles</p>
      </div>
      <Card className="w-full max-w-sm p-8 shadow-soft">
        <h2 className="text-2xl mb-6 text-center">Sign in to play</h2>
        <Button onClick={signInWithGoogle} className="w-full" size="lg">
          <svg className="mr-2" width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.5c-.27 1.49-1.86 4.37-6.5 4.37-3.91 0-7.1-3.24-7.1-7.2s3.19-7.2 7.1-7.2c2.23 0 3.72.94 4.58 1.76l3.13-3C17.95 1.46 15.34.5 12.18.5 6.42.5 1.78 5.16 1.78 11s4.64 10.5 10.4 10.5c6 0 9.98-4.21 9.98-10.13 0-.68-.08-1.2-.18-1.77z"/>
          </svg>
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-6">
          By continuing, you agree to play fair and have fun.
        </p>
      </Card>
    </div>
  );
}