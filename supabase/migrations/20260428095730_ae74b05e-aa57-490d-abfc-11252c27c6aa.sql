
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_finished_game() from public, anon, authenticated;
revoke execute on function public.cleanup_old_finished_games() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;

revoke execute on function public.get_head_to_head(uuid, uuid) from public, anon;
grant execute on function public.get_head_to_head(uuid, uuid) to authenticated;
