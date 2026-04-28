
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  wins integer not null default 0,
  games_played integer not null default 0,
  total_score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- GAMES
create table public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  status text not null default 'waiting', -- waiting, active, finished
  board jsonb not null default '[]'::jsonb, -- 15x15 array of {letter,points,player_id} or null
  tile_bag jsonb not null default '[]'::jsonb, -- array of letters remaining
  current_turn_user_id uuid references auth.users(id),
  player1_id uuid not null references auth.users(id) on delete cascade,
  player2_id uuid references auth.users(id) on delete cascade,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  winner_id uuid references auth.users(id),
  passes_in_a_row integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games_select_participants_or_waiting" on public.games for select
  using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
    or status = 'waiting'
  );

create policy "games_insert_as_player1" on public.games for insert
  with check (auth.uid() = player1_id);

create policy "games_update_participants" on public.games for update
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- GAME PLAYERS (rack storage)
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rack jsonb not null default '[]'::jsonb, -- array of letters
  unique(game_id, user_id)
);

alter table public.game_players enable row level security;

create policy "game_players_select_own" on public.game_players for select
  using (auth.uid() = user_id);

create policy "game_players_insert_own" on public.game_players for insert
  with check (auth.uid() = user_id);

create policy "game_players_update_own" on public.game_players for update
  using (auth.uid() = user_id);

-- CHAT MESSAGES
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat_select_participants" on public.chat_messages for select
  using (
    exists (
      select 1 from public.games g
      where g.id = chat_messages.game_id
      and (g.player1_id = auth.uid() or g.player2_id = auth.uid())
    )
  );

create policy "chat_insert_participants" on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.games g
      where g.id = chat_messages.game_id
      and (g.player1_id = auth.uid() or g.player2_id = auth.uid())
    )
  );

-- Realtime
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.game_players;

alter table public.games replica identity full;
alter table public.chat_messages replica identity full;
alter table public.game_players replica identity full;

create index idx_games_join_code on public.games(join_code);
create index idx_games_player1 on public.games(player1_id);
create index idx_games_player2 on public.games(player2_id);
create index idx_chat_game on public.chat_messages(game_id, created_at);
