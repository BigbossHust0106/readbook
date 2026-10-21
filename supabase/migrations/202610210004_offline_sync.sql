begin;
-- Compare personal fields only: progress updates must never cause annotation conflicts.
create function public.sync_personal_book_state(bid uuid, expected_state jsonb, next_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_state jsonb;
begin
 if auth.uid() is null or not public.can_read_book(bid) then raise exception 'Not allowed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':reading:' || bid::text,0));
 select jsonb_build_object('shelf',s.shelf,'overrides',s.overrides,'approved_children',s.approved_children) into current_state
 from public.reading_states s where s.owner_id=auth.uid() and s.book_id=bid for update;
 current_state:=coalesce(current_state,'{"shelf":"reading","overrides":{},"approved_children":[]}');
 if current_state is not distinct from next_state then return jsonb_build_object('applied',true,'document',current_state);end if;
 if current_state is distinct from expected_state then return jsonb_build_object('applied',false,'document',current_state);end if;
 if jsonb_typeof(next_state)<>'object' or not(next_state ?& array['shelf','overrides','approved_children']) then raise exception 'Invalid state';end if;
 insert into public.reading_states(owner_id,book_id,shelf,overrides,approved_children)
 values(auth.uid(),bid,next_state->>'shelf',next_state->'overrides',next_state->'approved_children')
 on conflict(owner_id,book_id) do update set shelf=excluded.shelf,overrides=excluded.overrides,approved_children=excluded.approved_children,updated_at=now();
 return jsonb_build_object('applied',true,'document',next_state);
end $$;

create function public.sync_collection_document(collection_name text, item_id uuid, expected_document jsonb, next_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_doc jsonb; affected bigint;
begin
 expected_document:=coalesce(expected_document,'null');next_document:=coalesce(next_document,'null');
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if collection_name not in ('vocabulary','children') then raise exception 'Invalid collection';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || collection_name || ':' || item_id::text,0));
 execute format('select document from public.%I where id=$1 and owner_id=$2 for update',collection_name) into current_doc using item_id,auth.uid();
 current_doc:=coalesce(current_doc,'null');
 if current_doc is not distinct from next_document then return jsonb_build_object('applied',true,'document',current_doc);end if;
 if current_doc is distinct from expected_document then return jsonb_build_object('applied',false,'document',current_doc);end if;
 if next_document is null or next_document='null' then
  execute format('delete from public.%I where id=$1 and owner_id=$2',collection_name) using item_id,auth.uid();
 else
  if jsonb_typeof(next_document)<>'object' or next_document->>'id' is distinct from item_id::text then raise exception 'Invalid document';end if;
  execute format('insert into public.%I(id,owner_id,document)values($1,$2,$3) on conflict(id) do update set document=excluded.document where %I.owner_id=$2',collection_name,collection_name) using item_id,auth.uid(),next_document;
  get diagnostics affected = row_count;
  if affected=0 then raise exception 'Not allowed';end if;
 end if;
 return jsonb_build_object('applied',true,'document',coalesce(next_document,'null'));
end $$;
revoke all on function public.sync_personal_book_state(uuid,jsonb,jsonb) from public;
revoke all on function public.sync_collection_document(text,uuid,jsonb,jsonb) from public;
grant execute on function public.sync_personal_book_state(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.sync_collection_document(text,uuid,jsonb,jsonb) to authenticated;
commit;
