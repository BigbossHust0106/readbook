begin;
create table public.reading_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 100), created_at timestamptz not null default now()
);
create table public.group_members (
 group_id uuid references public.reading_groups(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 1 and 60), joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create index group_members_user on public.group_members(user_id);
create table public.group_books (
 group_id uuid references public.reading_groups(id) on delete cascade, book_id uuid not null references public.books(id) on delete cascade,
 content_hash text not null, language text not null, added_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(group_id,book_id), unique(group_id,content_hash,language)
);
create index group_books_book on public.group_books(book_id);
create table public.group_invites (
 code uuid primary key default gen_random_uuid(), group_id uuid not null references public.reading_groups(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '7 days', uses int not null default 0, max_uses int not null default 50,
 revoked boolean not null default false
);
create table public.reading_states (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 book_id uuid not null references public.books(id) on delete cascade,
 "position" jsonb not null default '{"chapter":0,"paragraph":0,"offset":0}', shelf text not null default 'reading' check(shelf in ('reading','later','favorite','done')),
 overrides jsonb not null default '{}', approved_children jsonb not null default '[]', last_opened_at timestamptz, position_updated_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(owner_id,book_id), check(jsonb_typeof("position")='object'), check(jsonb_typeof(overrides)='object'), check(jsonb_typeof(approved_children)='array')
);
create function public.is_reading_member(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members m where m.group_id=gid and m.user_id=(select auth.uid()))
$$;
create function public.can_read_book(bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.books b where b.id=bid and (b.owner_id=(select auth.uid()) or exists(
  select 1 from public.group_books gb join public.group_members gm on gm.group_id=gb.group_id where gb.book_id=b.id and gm.user_id=(select auth.uid())
 )))
$$;
create function public.can_read_original(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.books b where b.id::text=split_part(path,'/',2) and b.owner_id::text=split_part(path,'/',1) and public.can_read_book(b.id))
$$;
alter table public.reading_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_books enable row level security;
alter table public.group_invites enable row level security;
alter table public.reading_states enable row level security;
create policy groups_select on public.reading_groups for select to authenticated using(public.is_reading_member(id));
create policy members_select on public.group_members for select to authenticated using(public.is_reading_member(group_id));
create policy group_books_select on public.group_books for select to authenticated using(public.is_reading_member(group_id));
create policy invites_select on public.group_invites for select to authenticated using(exists(select 1 from public.reading_groups g where g.id=group_id and g.owner_id=(select auth.uid())));
create policy shared_books_select on public.books for select to authenticated using(public.can_read_book(id));
create policy shared_originals_select on storage.objects for select to authenticated using(bucket_id='originals' and public.can_read_original(name));
create policy state_select on public.reading_states for select to authenticated using(owner_id=(select auth.uid()) and public.can_read_book(book_id));
create policy state_insert on public.reading_states for insert to authenticated with check(owner_id=(select auth.uid()) and public.can_read_book(book_id));
create policy state_update on public.reading_states for update to authenticated using(owner_id=(select auth.uid()) and public.can_read_book(book_id)) with check(owner_id=(select auth.uid()) and public.can_read_book(book_id));
create policy state_delete on public.reading_states for delete to authenticated using(owner_id=(select auth.uid()));
grant select on public.reading_groups,public.group_members,public.group_books,public.group_invites to authenticated;
grant select,insert,update,delete on public.reading_states to authenticated;

create function public.create_reading_group(group_name text, display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare gid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.reading_groups(owner_id,name) values(auth.uid(),trim(group_name)) returning id into gid;
 insert into public.group_members(group_id,user_id,nickname) values(gid,auth.uid(),trim(display_name)); return gid;
end $$;
create function public.create_reading_invite(gid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from public.reading_groups where id=gid and owner_id=auth.uid()) then raise exception 'Only group owner can invite'; end if;
 insert into public.group_invites(group_id) values(gid) returning code into result; return result;
end $$;
create function public.join_reading_group(invite_code uuid, display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.group_invites;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into inv from public.group_invites where code=invite_code for update;
 if not found or inv.revoked or inv.expires_at < now() then raise exception 'Invite expired or invalid'; end if;
 if not exists(select 1 from public.group_members where group_id=inv.group_id and user_id=auth.uid()) then
  if inv.uses>=inv.max_uses then raise exception 'Invite exhausted'; end if;
  insert into public.group_members(group_id,user_id,nickname) values(inv.group_id,auth.uid(),trim(display_name));
  update public.group_invites set uses=uses+1 where code=invite_code;
 end if;
 return inv.group_id;
end $$;
create function public.find_group_book(gid uuid, book_hash text, book_language text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare bid uuid;
begin
 if not public.is_reading_member(gid) then raise exception 'Not a group member'; end if;
 select book_id into bid from public.group_books where group_id=gid and content_hash=book_hash and language=book_language; return bid;
end $$;
create function public.add_group_book(gid uuid, bid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.books; result uuid;
begin
 if not public.is_reading_member(gid) then raise exception 'Not a group member'; end if;
 select * into b from public.books where id=bid and owner_id=auth.uid();
 if not found then raise exception 'Only upload your own book'; end if;
 insert into public.group_books(group_id,book_id,content_hash,language,added_by) values(gid,b.id,b.content_hash,b.language,auth.uid()) on conflict(group_id,content_hash,language) do nothing;
 select book_id into result from public.group_books where group_id=gid and content_hash=b.content_hash and language=b.language; return result;
end $$;
create function public.reading_group_progress(gid uuid, bid uuid) returns table(user_id uuid,nickname text,"position" jsonb,updated_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_reading_member(gid) or not exists(select 1 from public.group_books where group_id=gid and book_id=bid) then raise exception 'Not allowed'; end if;
 return query select m.user_id,m.nickname,jsonb_build_object('chapter',coalesce(s."position"->'chapter','0'),'paragraph',coalesce(s."position"->'paragraph','0'),'offset',coalesce(s."position"->'offset','0')),s.position_updated_at from public.group_members m left join public.reading_states s on s.owner_id=m.user_id and s.book_id=bid where m.group_id=gid;
end $$;
create function public.remove_reading_member(gid uuid, member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.reading_groups where id=gid and owner_id=auth.uid() and owner_id<>member_id) then raise exception 'Only group owner can remove another member'; end if;
 delete from public.group_members where group_id=gid and user_id=member_id;
end $$;
create function public.leave_reading_group(gid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.reading_groups where id=gid and owner_id=auth.uid()) then raise exception 'Group owner must delete the group instead'; end if;
 delete from public.group_members where group_id=gid and user_id=auth.uid();
end $$;
create function public.delete_reading_group(gid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.reading_groups where id=gid and owner_id=auth.uid()) then raise exception 'Only group owner can delete'; end if;
 delete from public.reading_groups where id=gid;
end $$;
create function public.remove_group_book(gid uuid,bid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.reading_groups where id=gid and owner_id=auth.uid()) and not exists(select 1 from public.group_books where group_id=gid and book_id=bid and added_by=auth.uid()) then raise exception 'Not allowed'; end if;
 delete from public.group_books where group_id=gid and book_id=bid;
end $$;
create function public.revoke_reading_invite(invite_code uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.group_invites i set revoked=true where code=invite_code and exists(select 1 from public.reading_groups g where g.id=i.group_id and g.owner_id=auth.uid());
end $$;

create function public.save_reading_position(bid uuid, reading_position jsonb, recorded_at timestamptz default now()) returns boolean language plpgsql security definer set search_path='' as $$
declare stamp timestamptz := least(coalesce(recorded_at,now()),now());
begin
 if auth.uid() is null or not public.can_read_book(bid) then raise exception 'Not allowed'; end if;
 if jsonb_typeof(reading_position)<>'object' or not (reading_position ? 'chapter' and reading_position ? 'paragraph') then raise exception 'Invalid position'; end if;
 reading_position := jsonb_build_object('chapter',greatest(0,(reading_position->>'chapter')::int),'paragraph',greatest(0,(reading_position->>'paragraph')::int),'offset',greatest(0,coalesce((reading_position->>'offset')::int,0)));
 insert into public.reading_states(owner_id,book_id,"position",position_updated_at,last_opened_at) values(auth.uid(),bid,reading_position,stamp,now())
 on conflict(owner_id,book_id) do update set "position"=excluded."position", position_updated_at=excluded.position_updated_at, last_opened_at=now(), updated_at=now()
 where public.reading_states.position_updated_at<=excluded.position_updated_at;
 return found;
end $$;
create function public.save_personal_book_state(bid uuid, book_shelf text, paragraph_overrides jsonb, child_ids jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_read_book(bid) then raise exception 'Not allowed'; end if;
 insert into public.reading_states(owner_id,book_id,shelf,overrides,approved_children) values(auth.uid(),bid,book_shelf,paragraph_overrides,child_ids)
 on conflict(owner_id,book_id) do update set shelf=excluded.shelf, overrides=excluded.overrides, approved_children=excluded.approved_children, updated_at=now();
end $$;

-- Preserve existing private data before making the shared book representation readable.
insert into public.reading_states(owner_id,book_id,"position",shelf,overrides,approved_children)
select b.owner_id,b.id,coalesce(b.document->'position','{"chapter":0,"paragraph":0}'),coalesce(b.document->>'shelf','reading'),
 coalesce((select jsonb_object_agg(p->>'id',jsonb_strip_nulls(jsonb_build_object('note',p->'note','highlight',p->'highlight','translations',p->'translations'))) from jsonb_array_elements(b.document->'chapters') c cross join lateral jsonb_array_elements(c->'paragraphs') p where p ? 'note' or p ? 'highlight' or coalesce(p->'translations','{}')<>'{}'), '{}'),
 coalesce(b.document->'approvedChildren','[]') from public.books b;
update public.books b set document=jsonb_set(jsonb_set(jsonb_set(jsonb_set(b.document,'{position}','{"chapter":0,"paragraph":0}'),'{shelf}','"reading"'),'{approvedChildren}','[]'),'{chapters}',
 (select jsonb_agg(c || jsonb_build_object('paragraphs',(select jsonb_agg((p-'note'-'highlight') || '{"translations":{}}') from jsonb_array_elements(c->'paragraphs') p))) from jsonb_array_elements(b.document->'chapters') c));

do $$ declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_reading_member','can_read_book','can_read_original','create_reading_group','create_reading_invite','join_reading_group','find_group_book','add_group_book','reading_group_progress','remove_reading_member','leave_reading_group','delete_reading_group','remove_group_book','revoke_reading_invite','save_reading_position','save_personal_book_state') loop
  execute format('revoke all on function %s from public',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
