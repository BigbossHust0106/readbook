begin;
create table public.group_book_comments (
 id uuid primary key, group_id uuid not null, book_id uuid not null,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(group_id,book_id) references public.group_books(group_id,book_id) on delete cascade
);
create index group_comments_page on public.group_book_comments(group_id,book_id,created_at desc,id desc);
create table public.group_book_ratings (
 group_id uuid not null, book_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 score smallint not null check(score between 1 and 5), updated_at timestamptz not null default now(),
 primary key(group_id,book_id,user_id),
 foreign key(group_id,book_id) references public.group_books(group_id,book_id) on delete cascade
);
alter table public.group_book_comments enable row level security;
alter table public.group_book_ratings enable row level security;
create policy discussion_read on public.group_book_comments for select to authenticated using(public.is_reading_member(group_id));
create policy rating_read on public.group_book_ratings for select to authenticated using(public.is_reading_member(group_id));
-- All writes go through the scoped RPCs; default Supabase privileges must not allow direct mutation.
revoke all on public.group_book_comments,public.group_book_ratings from anon,authenticated;
grant select on public.group_book_comments,public.group_book_ratings to authenticated;

create function public.save_group_book_comment(gid uuid,bid uuid,comment_id uuid,comment_body text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_reading_member(gid) or not exists(select 1 from public.group_books where group_id=gid and book_id=bid) then raise exception 'Bạn không còn quyền thảo luận về sách này trong nhóm.'; end if;
 if comment_id is null or comment_body is null or char_length(trim(comment_body)) not between 1 and 2000 then raise exception 'Bình luận cần có từ 1 đến 2.000 ký tự.'; end if;
 insert into public.group_book_comments(id,group_id,book_id,author_id,body) values(comment_id,gid,bid,auth.uid(),trim(comment_body))
 on conflict(id) do update set body=excluded.body,updated_at=now()
 where public.group_book_comments.author_id=auth.uid() and public.group_book_comments.group_id=gid and public.group_book_comments.book_id=bid;
 if not found then raise exception 'Bạn chỉ có thể sửa bình luận của mình.'; end if;
 return comment_id;
end $$;
create function public.delete_group_book_comment(gid uuid,bid uuid,comment_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_reading_member(gid) or not exists(select 1 from public.group_books where group_id=gid and book_id=bid) then raise exception 'Bạn không còn quyền thảo luận về sách này trong nhóm.'; end if;
 delete from public.group_book_comments c where c.id=comment_id and c.group_id=gid and c.book_id=bid and
 (c.author_id=auth.uid() or exists(select 1 from public.reading_groups g where g.id=gid and g.owner_id=auth.uid()));
 if not found then raise exception 'Bạn chỉ có thể xóa bình luận của mình; chủ nhóm có thể xóa bình luận trong nhóm.'; end if;
end $$;
create function public.rate_group_book(gid uuid,bid uuid,rating_score integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_reading_member(gid) or not exists(select 1 from public.group_books where group_id=gid and book_id=bid) then raise exception 'Bạn không còn quyền đánh giá sách này trong nhóm.'; end if;
 if rating_score is null then delete from public.group_book_ratings where group_id=gid and book_id=bid and user_id=auth.uid();return;end if;
 if rating_score not between 1 and 5 then raise exception 'Chọn đánh giá từ 1 đến 5 sao.';end if;
 insert into public.group_book_ratings(group_id,book_id,user_id,score) values(gid,bid,auth.uid(),rating_score)
 on conflict(group_id,book_id,user_id) do update set score=excluded.score,updated_at=now();
end $$;
create function public.reading_group_book_ratings(gid uuid) returns table(book_id uuid,average_rating numeric,rating_count bigint,my_rating smallint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_reading_member(gid) then raise exception 'Bạn không còn là thành viên nhóm này.'; end if;
 return query select gb.book_id,round(avg(r.score),1),count(r.user_id),max(r.score) filter(where r.user_id=auth.uid())
 from public.group_books gb left join public.group_book_ratings r on r.group_id=gb.group_id and r.book_id=gb.book_id
 where gb.group_id=gid group by gb.book_id;
end $$;
create function public.group_book_discussion(gid uuid,bid uuid,before_created_at timestamptz default null,before_comment_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare comments jsonb; total_rows integer; rating jsonb;
begin
 if not public.is_reading_member(gid) or not exists(select 1 from public.group_books where group_id=gid and book_id=bid) then raise exception 'Bạn không còn quyền thảo luận về sách này trong nhóm.'; end if;
 if (before_created_at is null)<>(before_comment_id is null) then raise exception 'Vị trí tải bình luận không hợp lệ.';end if;
 with page as (
  select c.*,coalesce(m.nickname,'Thành viên cũ') as nickname from public.group_book_comments c
  left join public.group_members m on m.group_id=c.group_id and m.user_id=c.author_id
  where c.group_id=gid and c.book_id=bid and (before_created_at is null or (c.created_at,c.id)<(before_created_at,before_comment_id))
  order by c.created_at desc,c.id desc limit 31
 ), numbered as (select *,row_number() over(order by created_at desc,id desc) as n from page)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'author_id',author_id,'nickname',nickname,'body',body,'created_at',created_at,'updated_at',updated_at) order by created_at desc,id desc) filter(where n<=30),'[]'),count(*)
 into comments,total_rows from numbered;
 select jsonb_build_object('average_rating',round(avg(score),1),'rating_count',count(*),'my_rating',max(score) filter(where user_id=auth.uid()))
 into rating from public.group_book_ratings r where r.group_id=gid and r.book_id=bid;
 return rating || jsonb_build_object('comments',comments,'has_more',total_rows>30);
end $$;
revoke all on function public.save_group_book_comment(uuid,uuid,uuid,text),public.delete_group_book_comment(uuid,uuid,uuid),public.rate_group_book(uuid,uuid,integer),public.reading_group_book_ratings(uuid),public.group_book_discussion(uuid,uuid,timestamptz,uuid) from public,anon;
grant execute on function public.save_group_book_comment(uuid,uuid,uuid,text),public.delete_group_book_comment(uuid,uuid,uuid),public.rate_group_book(uuid,uuid,integer),public.reading_group_book_ratings(uuid),public.group_book_discussion(uuid,uuid,timestamptz,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
