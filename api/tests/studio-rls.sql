-- Run ONLY in an empty disposable PostgreSQL database, as its owner/superuser.
-- This models the Supabase auth/storage contract without accounts or network.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false, raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
\ir ../supabase/migrations/20261127133114_studio_portal.sql

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
('00000000-0000-4000-8000-000000000001','admin@example.test',now(),'{"role":"admin"}'),
('00000000-0000-4000-8000-000000000002','alice@example.test',now(),'{}'),
('00000000-0000-4000-8000-000000000003','bob@example.test',now(),'{}'),
('00000000-0000-4000-8000-000000000004','unconfirmed@example.test',null,'{}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.studio_clients(id,name,email) values
('10000000-0000-4000-8000-000000000001','Alice','alice@example.test'),
('10000000-0000-4000-8000-000000000002','Bob','bob@example.test');
insert into public.studio_projects(id,client_id,title) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Alice commission'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Bob commission');
insert into public.studio_enquiries(id,name,email,interest,message) values
('30000000-0000-4000-8000-000000000001','Alice','alice@example.test','Commission','Please photograph a building.');
select public.studio_update_enquiry('30000000-0000-4000-8000-000000000001','in_progress','Private budget notes');
insert into public.studio_files(id,project_id,name,mime_type,size,storage_path) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Alice.pdf','application/pdf',100,'20000000-0000-4000-8000-000000000001/one.pdf'),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Bob.pdf','application/pdf',100,'20000000-0000-4000-8000-000000000002/two.pdf');
insert into storage.objects(bucket_id,name) values
('studio-project-files','20000000-0000-4000-8000-000000000001/one.pdf'),
('studio-project-files','20000000-0000-4000-8000-000000000002/two.pdf');
insert into public.studio_works(title,discipline,image_url,alt,published) values
('Published work','Fine art','https://example.test/photo.jpg','A photograph',true),
('Draft work','Fine art','https://example.test/draft.jpg','A draft',false);

do $$ begin
  if (select count(*) from public.studio_clients) <> 2 then raise exception 'Admin cannot see all clients'; end if;
  if (select count(*) from public.studio_enquiry_notes) <> 1 then raise exception 'Admin notes missing'; end if;
  if (select count(*) from storage.objects) <> 2 then raise exception 'Admin storage read failed'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ declare affected integer; begin
  if (select count(*) from public.studio_clients) <> 1 then raise exception 'Client ownership failed'; end if;
  if (select count(*) from public.studio_projects) <> 1 then raise exception 'Project ownership failed'; end if;
  if (select count(*) from public.studio_files) <> 1 then raise exception 'File ownership failed'; end if;
  if (select count(*) from storage.objects) <> 1 then raise exception 'Private storage ownership failed'; end if;
  if (select count(*) from public.studio_enquiries) <> 1 then raise exception 'Enquiry ownership failed'; end if;
  if (select count(*) from public.studio_enquiry_notes) <> 0 then raise exception 'Private notes leaked'; end if;
  if (select count(*) from public.studio_works) <> 1 then raise exception 'Draft portfolio leaked'; end if;
  update public.studio_projects set title = 'Client edit';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Client changed projects'; end if;
  begin
    insert into public.studio_clients(name,email) values ('Attacker','attacker@example.test');
    raise exception 'Client created client record';
  exception when insufficient_privilege then null; end;
  begin
    perform public.studio_update_enquiry('30000000-0000-4000-8000-000000000001','closed','Leaked');
    raise exception 'Client used admin RPC';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('studio-project-files','malicious.pdf');
    raise exception 'Client uploaded storage';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $$ begin
  if (select count(*) from public.studio_enquiries) <> 0 then raise exception 'Other client read enquiry'; end if;
  if exists(select 1 from public.studio_projects where title='Alice commission') then raise exception 'Other client read project'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$ begin
  if studio_private.verified_email() is not null then raise exception 'Unconfirmed email trusted'; end if;
end $$;
reset role;
-- Revocation uses current auth.users, even if a stale token once claimed admin.
update auth.users set raw_app_meta_data = '{}' where id='00000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin
  if studio_private.is_admin() then raise exception 'Revoked admin still authorized'; end if;
  if (select count(*) from public.studio_projects) <> 0 then raise exception 'Revoked admin read projects'; end if;
end $$;
reset role;
set role anon;
insert into public.studio_enquiries(name,email,interest,message) values ('Guest','guest@example.test','Commission','A new enquiry');
do $$ begin
  if (select count(*) from public.studio_works) <> 1 then raise exception 'Anonymous draft leaked'; end if;
  begin
    perform count(*) from public.studio_enquiries;
    raise exception 'Anonymous read enquiry';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.studio_enquiries(name,email,interest,message,status) values ('Bad','bad@example.test','Commission','Spam','closed');
    raise exception 'Anonymous set status';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Studio RLS checks passed' as result;
