
create table public.match_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid,
  player1_id uuid not null,
  player2_id uuid not null,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  winner_id uuid,
  is_draw boolean not null default false,
  finished_at timestamptz not null default now()
);

create index idx_match_history_players on public.match_history (player1_id, player2_id);
create index idx_match_history_p2 on public.match_history (player2_id, player1_id);

alter table public.match_history enable row level security;

create policy "match_history_select_auth"
  on public.match_history for select
  to authenticated
  using (true);

create or replace function public.get_head_to_head(_me uuid, _opponent uuid)
returns table (wins integer, losses integer, draws integer, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when is_draw = false and winner_id = _me then 1 else 0 end), 0)::int as wins,
    coalesce(sum(case when is_draw = false and winner_id = _opponent then 1 else 0 end), 0)::int as losses,
    coalesce(sum(case when is_draw = true then 1 else 0 end), 0)::int as draws,
    count(*)::int as total
  from public.match_history
  where (player1_id = _me and player2_id = _opponent)
     or (player1_id = _opponent and player2_id = _me);
$$;

create or replace function public.record_finished_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished') and new.player2_id is not null then
    insert into public.match_history (
      game_id, player1_id, player2_id, player1_score, player2_score, winner_id, is_draw, finished_at
    ) values (
      new.id, new.player1_id, new.player2_id, new.player1_score, new.player2_score, new.winner_id,
      (new.winner_id is null), now()
    );

    update public.profiles set
      games_played = games_played + 1,
      total_score = total_score + new.player1_score,
      wins = wins + case when new.winner_id = new.player1_id then 1 else 0 end
    where id = new.player1_id;

    update public.profiles set
      games_played = games_played + 1,
      total_score = total_score + new.player2_score,
      wins = wins + case when new.winner_id = new.player2_id then 1 else 0 end
    where id = new.player2_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_finished_game on public.games;
create trigger trg_record_finished_game
after update on public.games
for each row execute function public.record_finished_game();

create or replace function public.cleanup_old_finished_games()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages
  where game_id in (
    select id from public.games
    where status = 'finished' and updated_at < now() - interval '72 hours'
  );
  delete from public.game_players
  where game_id in (
    select id from public.games
    where status = 'finished' and updated_at < now() - interval '72 hours'
  );
  delete from public.games
  where status = 'finished' and updated_at < now() - interval '72 hours';
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-finished-games-hourly',
  '0 * * * *',
  $$ select public.cleanup_old_finished_games(); $$
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at
before update on public.games
for each row execute function public.update_updated_at_column();

alter table public.game_players replica identity full;
alter table public.chat_messages replica identity full;

do $$ begin
  begin
    execute 'alter publication supabase_realtime add table public.game_players';
  exception when duplicate_object then null; end;
  begin
    execute 'alter publication supabase_realtime add table public.chat_messages';
  exception when duplicate_object then null; end;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
