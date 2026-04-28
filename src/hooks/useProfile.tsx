import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  theme: string;
  wins: number;
  games_played: number;
  total_score: number;
};

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let mounted = true;
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      .then(({ data }) => { if (mounted) { setProfile(data as Profile | null); setLoading(false); } });
    return () => { mounted = false; };
  }, [userId]);

  async function refresh() {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
  }

  return { profile, loading, refresh, setProfile };
}

export function useProfiles(ids: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, Profile>>({});
  const key = ids.filter(Boolean).join(",");
  useEffect(() => {
    const clean = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
    if (clean.length === 0) return;
    supabase.from("profiles").select("*").in("id", clean).then(({ data }) => {
      const next: Record<string, Profile> = {};
      (data as Profile[] | null)?.forEach((p) => { next[p.id] = p; });
      setMap(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}