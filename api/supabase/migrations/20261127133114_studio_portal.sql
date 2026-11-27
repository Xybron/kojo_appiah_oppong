-- Kojo commissions workspace. Apply only to the dedicated Kojo Supabase project.
-- No service-role key is needed: all application access uses a caller JWT + RLS.
begin;
create schema if not exists studio_private;
revoke all on schema studio_private from public;
grant usage on schema studio_private to authenticated;

-- The authenticated role cannot read auth.users. These narrowly scoped helpers
-- inspect only the caller, use no JWT metadata for authorization, and cannot be
-- reached through the public Data API. Current server state revokes access promptly.
create function studio_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id = auth.uid()
    and u.raw_app_meta_data ->> 'role' = 'admin');
$$;
create function studio_private.verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = auth.uid()
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false);
$$;
revoke all on function studio_private.is_admin() from public, anon;
revoke all on function studio_private.verified_email() from public, anon;
grant execute on function studio_private.is_admin(), studio_private.verified_email() to authenticated;

create table public.studio_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254 and email like '%@%'),
  company text not null default '' check (length(company) <= 160),
  created_at timestamptz not null default now(),
  unique (email)
);
create table public.studio_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254 and email like '%@%'),
  interest text not null check (length(btrim(interest)) between 1 and 160),
  message text not null check (length(btrim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);
create index studio_enquiries_email_idx on public.studio_enquiries(email);
create index studio_enquiries_created_idx on public.studio_enquiries(created_at desc);
create table public.studio_enquiry_notes (
  enquiry_id uuid primary key references public.studio_enquiries(id) on delete cascade,
  internal_notes text not null default '' check (length(internal_notes) <= 8000)
);
create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 4000),
  status text not null default 'planning' check (status in ('planning','in_progress','review','completed')),
  next_step text not null default '' check (length(next_step) <= 1000),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studio_projects_client_idx on public.studio_projects(client_id);
create table public.studio_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id),
  name text not null check (length(name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf','application/zip')),
  size bigint not null check (size between 1 and 15728640),
  storage_path text not null unique check (storage_path like project_id::text || '/%'),
  created_at timestamptz not null default now()
);
create index studio_files_project_idx on public.studio_files(project_id);
create table public.studio_works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  discipline text not null check (discipline in ('Fine art','Architecture','Fashion','Advertising')),
  image_url text not null check (length(image_url) <= 2048 and (image_url like 'https://%' or image_url like '/images/%')),
  alt text not null check (length(btrim(alt)) between 1 and 500),
  description text not null default '' check (length(description) <= 4000),
  width integer not null default 1600 check (width between 1 and 20000),
  height integer not null default 1200 check (height between 1 and 20000),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index studio_works_published_order_idx on public.studio_works(sort_order, created_at) where published;

create function studio_private.touch_project() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function studio_private.touch_project() from public;
create trigger studio_project_updated before update on public.studio_projects
for each row execute function studio_private.touch_project();

alter table public.studio_clients enable row level security;
alter table public.studio_enquiries enable row level security;
alter table public.studio_enquiry_notes enable row level security;
alter table public.studio_projects enable row level security;
alter table public.studio_files enable row level security;
alter table public.studio_works enable row level security;

revoke all on public.studio_clients, public.studio_enquiries, public.studio_enquiry_notes,
  public.studio_projects, public.studio_files, public.studio_works from anon, authenticated;
grant select, insert, update on public.studio_clients, public.studio_enquiries, public.studio_enquiry_notes,
  public.studio_projects, public.studio_files, public.studio_works to authenticated;
grant select on public.studio_works to anon;
-- Guests can supply only these four fields; no status, UUID, or timestamps.
grant insert(name,email,interest,message) on public.studio_enquiries to anon;

create policy studio_clients_admin on public.studio_clients for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_clients_own on public.studio_clients for select to authenticated
using (email = (select studio_private.verified_email()));
create policy studio_enquiries_admin on public.studio_enquiries for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_enquiries_guest_insert on public.studio_enquiries for insert to anon
with check (status = 'new');
create policy studio_enquiries_own_insert on public.studio_enquiries for insert to authenticated
with check (status = 'new' and email = (select studio_private.verified_email()));
create policy studio_enquiries_own on public.studio_enquiries for select to authenticated
using (email = (select studio_private.verified_email()));
create policy studio_notes_admin on public.studio_enquiry_notes for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_projects_admin on public.studio_projects for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_projects_own on public.studio_projects for select to authenticated
using (exists(select 1 from public.studio_clients c where c.id = client_id and c.email = (select studio_private.verified_email())));
create policy studio_files_admin on public.studio_files for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_files_own on public.studio_files for select to authenticated
using (exists(select 1 from public.studio_projects p join public.studio_clients c on c.id = p.client_id
  where p.id = project_id and c.email = (select studio_private.verified_email())));
create policy studio_works_admin on public.studio_works for all to authenticated
using ((select studio_private.is_admin())) with check ((select studio_private.is_admin()));
create policy studio_works_published on public.studio_works for select to anon, authenticated using (published);

-- Atomic status/notes updates; runs as caller and retains all table RLS.
create function public.studio_update_enquiry(enquiry_id uuid, new_status text default null, new_notes text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not studio_private.is_admin() then raise insufficient_privilege; end if;
  perform 1 from public.studio_enquiries e where e.id = enquiry_id for update;
  if not found then raise exception 'Enquiry not found' using errcode = 'P0002'; end if;
  if new_status is not null then
    update public.studio_enquiries set status = new_status where id = enquiry_id;
  end if;
  if new_notes is not null then
    insert into public.studio_enquiry_notes(enquiry_id, internal_notes) values (enquiry_id, new_notes)
    on conflict on constraint studio_enquiry_notes_pkey do update set internal_notes = excluded.internal_notes;
  end if;
end;
$$;
revoke all on function public.studio_update_enquiry(uuid,text,text) from public, anon;
grant execute on function public.studio_update_enquiry(uuid,text,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('studio-project-files','studio-project-files',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf','application/zip']),
('studio-portfolio','studio-portfolio',true,15728640,array['image/jpeg','image/png','image/webp']);
create policy studio_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id in ('studio-project-files','studio-portfolio') and (select studio_private.is_admin()));
create policy studio_storage_admin_select on storage.objects for select to authenticated
using (bucket_id in ('studio-project-files','studio-portfolio') and (select studio_private.is_admin()));
create policy studio_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id in ('studio-project-files','studio-portfolio') and (select studio_private.is_admin()));
create policy studio_storage_client_download on storage.objects for select to authenticated
using (bucket_id = 'studio-project-files' and exists (
  select 1 from public.studio_files f where f.storage_path = storage.objects.name
));
commit;
