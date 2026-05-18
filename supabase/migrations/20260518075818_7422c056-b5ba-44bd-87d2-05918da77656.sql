CREATE OR REPLACE FUNCTION public.accept_game_invite(_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
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

REVOKE ALL ON FUNCTION public.accept_game_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_game_invite(uuid) TO authenticated;