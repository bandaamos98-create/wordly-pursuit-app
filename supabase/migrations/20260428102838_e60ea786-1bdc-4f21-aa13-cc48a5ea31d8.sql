-- Profiles: add avatar, theme preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';

-- Games: add mode, bot flag, turn timer (seconds), turn deadline, last move log
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS turn_seconds integer,
  ADD COLUMN IF NOT EXISTS turn_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS last_move jsonb;

-- Friendships: bidirectional, pending/accepted
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select_involved" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert_self" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update_addressee" ON public.friendships
  FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "friendships_delete_involved" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Game invites by email (only existing users)
CREATE TABLE IF NOT EXISTS public.game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select_involved" ON public.game_invites
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
CREATE POLICY "invites_insert_self" ON public.game_invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "invites_update_involved" ON public.game_invites
  FOR UPDATE USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Helper: lookup user id by email (security definer to access auth.users)
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- Avatar storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow resigning: track resign in games (winner_id is opponent, status finished)
-- Already handled by existing winner_id + status fields.
