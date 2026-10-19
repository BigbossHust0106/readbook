-- Phase 1: books are atomic versioned aggregates to keep paragraph alignment and edits together.
-- UUIDs and original paragraph IDs remain stable across reload, backup and cloud access.
begin;
create table public.books (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 1000),
 language text not null check(language in ('vi','zh','en')),
 content_hash text not null,
 document jsonb not null check(jsonb_typeof(document)='object'),
 revision bigint not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,content_hash,language),
 check(document->>'id'=id::text),
 check(document->>'language'=language)
);
create index books_owner_updated on public.books(owner_id,updated_at desc);
create table public.children (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object'),
 created_at timestamptz not null default now(),
 check(document->>'id'=id::text)
);
create table public.vocabulary (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object'),
 created_at timestamptz not null default now(),
 check(document->>'id'=id::text)
);
create index vocabulary_owner on public.vocabulary(owner_id);
create index children_owner on public.children(owner_id);
-- Durable future-worker jobs. No external service performs work merely by inserting here.
create table public.translation_jobs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 book_id uuid not null references public.books(id) on delete cascade,
 target_language text not null check(target_language in ('vi','zh','en')),
 state text not null default 'paused' check(state in ('queued','running','paused','completed','failed','cancelled')),
 cursor jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index translation_jobs_owner on public.translation_jobs(owner_id);
create table public.integration_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('csv_import','csv_export','translation_usage')),
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index integration_events_owner on public.integration_events(owner_id);
create function public.touch_book() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at=now(); new.revision=old.revision+1; return new;
end $$;
create trigger books_updated before update on public.books for each row execute function public.touch_book();

alter table public.books enable row level security;
alter table public.children enable row level security;
alter table public.vocabulary enable row level security;
alter table public.translation_jobs enable row level security;
alter table public.integration_events enable row level security;

-- Separate policies for each verb, including WITH CHECK to block owner reassignment.
do $$
declare t text;
begin
 foreach t in array array['books','children','vocabulary','integration_events'] loop
  execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid())=owner_id)',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=owner_id)',t);
  execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=owner_id)',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
create policy own_select on public.translation_jobs for select to authenticated using ((select auth.uid())=owner_id);
create policy own_insert on public.translation_jobs for insert to authenticated with check ((select auth.uid())=owner_id and exists(select 1 from public.books b where b.id=book_id and b.owner_id=(select auth.uid())));
create policy own_update on public.translation_jobs for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id and exists(select 1 from public.books b where b.id=book_id and b.owner_id=(select auth.uid())));
create policy own_delete on public.translation_jobs for delete to authenticated using ((select auth.uid())=owner_id);
grant select,insert,update,delete on public.translation_jobs to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
 ('originals','originals',false,20971520,array['application/octet-stream']);
create policy originals_select on storage.objects for select to authenticated using(bucket_id='originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy originals_insert on storage.objects for insert to authenticated with check(bucket_id='originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy originals_update on storage.objects for update to authenticated using(bucket_id='originals' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy originals_delete on storage.objects for delete to authenticated using(bucket_id='originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
