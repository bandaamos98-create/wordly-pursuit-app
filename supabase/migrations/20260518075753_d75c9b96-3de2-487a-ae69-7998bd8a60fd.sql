-- Let invited players accept a game request without opening games to everyone
CREATE OR REPLACE FUNCTION public.accept_game_invite(_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.game_invites%ROWTYPE;
  game_row public.games%ROWTYPE;
BEGIN
  SELECT * INTO invite_row
  FROM public.game_invites
  WHERE id = _invite_id
    AND invitee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT * INTO game_row
  FROM public.games
  WHERE id = invite_row.game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF game_row.player2_id IS NOT NULL AND game_row.player2_id <> auth.uid() THEN
    RAISE EXCEPTION 'Game is already full';
  END IF;

  UPDATE public.games
  SET player2_id = auth.uid(),
      status = 'active',
      updated_at = now()
  WHERE id = game_row.id;

  UPDATE public.game_invites
  SET status = 'accepted'
  WHERE id = invite_row.id;

  RETURN game_row.id;
END;
$$;

DROP POLICY IF EXISTS "games_update_participants" ON public.games;
CREATE POLICY "games_update_participants_or_invited"
ON public.games
FOR UPDATE
USING (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
  OR EXISTS (
    SELECT 1 FROM public.game_invites gi
    WHERE gi.game_id = games.id
      AND gi.invitee_id = auth.uid()
      AND gi.status = 'pending'
  )
)
WITH CHECK (
  auth.uid() = player1_id
  OR auth.uid() = player2_id
  OR EXISTS (
    SELECT 1 FROM public.game_invites gi
    WHERE gi.game_id = games.id
      AND gi.invitee_id = auth.uid()
      AND gi.status = 'pending'
  )
);

ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.game_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;