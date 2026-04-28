import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function HeadToHead({ meId, opponentId, opponentName }: {
  meId: string; opponentId: string; opponentName: string;
}) {
  const [stats, setStats] = useState<{ wins: number; losses: number; draws: number; total: number } | null>(null);

  useEffect(() => {
    if (!meId || !opponentId) return;
    (supabase as any).rpc("get_head_to_head", { _me: meId, _opponent: opponentId })
      .then(({ data }: any) => {
        if (Array.isArray(data) && data[0]) setStats(data[0]);
        else setStats({ wins: 0, losses: 0, draws: 0, total: 0 });
      });
  }, [meId, opponentId]);

  if (!stats) return null;
  return (
    <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md px-3 py-2 flex items-center gap-3">
      <span>vs <strong className="text-foreground">{opponentName}</strong></span>
      <span className="text-primary font-bold">{stats.wins}W</span>
      <span>{stats.losses}L</span>
      <span>{stats.draws}D</span>
    </div>
  );
}