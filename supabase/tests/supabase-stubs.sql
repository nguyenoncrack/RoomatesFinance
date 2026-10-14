-- Minimal stand-ins for the Supabase-managed schemas (auth, storage, extensions, roles) so the
-- migration can be smoke-tested on plain Postgres. Not needed when running against Supabase.
create role anon nologin; create role authenticated nologin;
create schema extensions; create schema auth; create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create publication supabase_realtime;
grant select on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
