begin;
-- Kojo-only ownership; do not change shared Auth metadata or other applications.
-- Read the current, verified identity so email changes revoke access immediately.
create or replace function studio_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(btrim(u.email)) = 'ronaldnettey360@gmail.com'
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
  );
$$;
revoke all on function studio_private.is_admin() from public, anon;
grant execute on function studio_private.is_admin() to authenticated;
commit;
