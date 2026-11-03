-- 행 단위 접근 규칙(RLS)과 앱이 호출하는 함수(RPC)
-- 모든 함수는 auth.uid() 로만 "나"를 판단한다. 다른 사용자 ID를 받아 그 사람의 데이터를 바꾸는 함수는 없다.

alter table public.app_settings enable row level security;
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.push_tokens enable row level security;
alter table public.genres enable row level security;
alter table public.artists enable row level security;
alter table public.user_artists enable row level security;
alter table public.user_genres enable row level security;
alter table public.concerts enable row level security;
alter table public.concert_schedules enable row level security;
alter table public.concert_artists enable row level security;
alter table public.ticket_links enable row level security;
alter table public.favorites enable row level security;
alter table public.blocks enable row level security;
alter table public.friend_requests enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.inquiries enable row level security;
-- admins: 정책 없음 → 클라이언트에서 읽기·쓰기 불가 (is_admin() 함수만 조회)

-- 공개 데이터
create policy "settings read" on public.app_settings for select using (true);
create policy "genres read" on public.genres for select using (true);
create policy "artists read" on public.artists for select using (true);
create policy "concerts read" on public.concerts for select using (status = 'published' or public.is_admin());
create policy "schedules read" on public.concert_schedules for select
  using (exists (select 1 from public.concerts c where c.id = concert_id and (c.status = 'published' or public.is_admin())));
create policy "concert artists read" on public.concert_artists for select
  using (exists (select 1 from public.concerts c where c.id = concert_id and (c.status = 'published' or public.is_admin())));
create policy "links read" on public.ticket_links for select
  using (exists (select 1 from public.concerts c where c.id = concert_id and (c.status = 'published' or public.is_admin())));

-- 운영자: 공연·아티스트 관리 (Supabase Studio 또는 관리자 화면)
create policy "admin concerts" on public.concerts for all using (public.is_admin()) with check (public.is_admin());
create policy "admin schedules" on public.concert_schedules for all using (public.is_admin()) with check (public.is_admin());
create policy "admin concert artists" on public.concert_artists for all using (public.is_admin()) with check (public.is_admin());
create policy "admin links" on public.ticket_links for all using (public.is_admin()) with check (public.is_admin());
create policy "admin artists" on public.artists for all using (public.is_admin()) with check (public.is_admin());

-- 프로필: 로그인 사용자는 서로의 공개 프로필을 볼 수 있고, 수정은 본인만.
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or status <> 'banned');
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- 상태·회원 구분은 사용자가 직접 바꿀 수 없게 열 단위로 막는다
revoke update on public.profiles from authenticated, anon;
grant update (nickname, bio, avatar_url, banner_url, profile_setup_done, community_agreed_at, notify_enabled, last_seen_at)
  on public.profiles to authenticated;

create policy "consents own read" on public.consents for select to authenticated using (user_id = auth.uid());
create policy "consents own insert" on public.consents for insert to authenticated with check (user_id = auth.uid());

create policy "push own" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 취향·관심 공연: 프로필에 보이므로 읽기는 로그인 사용자 전체, 쓰기는 본인만
create policy "user artists read" on public.user_artists for select to authenticated using (true);
create policy "user artists insert" on public.user_artists for insert to authenticated with check (user_id = auth.uid());
create policy "user artists delete" on public.user_artists for delete to authenticated using (user_id = auth.uid());
create policy "user genres read" on public.user_genres for select to authenticated using (true);
create policy "user genres insert" on public.user_genres for insert to authenticated with check (user_id = auth.uid());
create policy "user genres delete" on public.user_genres for delete to authenticated using (user_id = auth.uid());
create policy "favorites read" on public.favorites for select to authenticated using (true);
create policy "favorites insert" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "favorites delete" on public.favorites for delete to authenticated using (user_id = auth.uid());

-- 차단: 내가 차단한 목록만 보인다 (상대는 차단 사실을 알 수 없음)
create policy "blocks own" on public.blocks for select to authenticated using (blocker = auth.uid());

create policy "requests mine" on public.friend_requests for select to authenticated
  using (auth.uid() in (from_user, to_user));
create policy "friendships mine" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "rooms member" on public.chat_rooms for select to authenticated
  using (public.is_room_member(id) or (kind = 'support' and public.is_admin()));
create policy "members of my rooms" on public.chat_members for select to authenticated
  using (public.is_room_member(room_id));
create policy "messages read" on public.messages for select to authenticated
  using (public.is_room_member(room_id)
         or (public.is_admin() and exists (select 1 from public.chat_rooms r where r.id = room_id and r.kind = 'support')));
create policy "messages send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text', 'image') and public.can_send(room_id));

-- 커뮤니티: 차단 관계인 사람의 글·댓글은 서로 보이지 않는다
create policy "posts read" on public.posts for select to authenticated
  using (author_id = auth.uid() or (status = 'visible' and not public.is_blocked_between(auth.uid(), author_id)));
create policy "posts insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from public.profiles p where p.id = auth.uid()
                          and p.status = 'active' and p.community_agreed_at is not null));
create policy "posts delete own" on public.posts for delete to authenticated using (author_id = auth.uid());
create policy "admin posts" on public.posts for update using (public.is_admin()) with check (public.is_admin());

create policy "likes read" on public.post_likes for select to authenticated using (true);

create policy "comments read" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id)
         and not public.is_blocked_between(auth.uid(), author_id));
create policy "comments insert" on public.comments for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from public.profiles p where p.id = auth.uid()
                          and p.status = 'active' and p.community_agreed_at is not null));
create policy "comments delete own" on public.comments for delete to authenticated using (author_id = auth.uid());

create policy "reports insert" on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "admin reports" on public.reports for all using (public.is_admin()) with check (public.is_admin());

create policy "sanctions own" on public.sanctions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin sanctions" on public.sanctions for insert with check (public.is_admin());

create policy "inquiries own" on public.inquiries for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "inquiries insert" on public.inquiries for insert to authenticated with check (user_id = auth.uid());

-- ─────────────────────────── 함수 ───────────────────────────

create or replace function public.require_uid() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'account_restricted';
  end if;
  return me;
end $$;

-- 친구 요청 보내기
create or replace function public.send_friend_request(target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_uid();
  rid uuid;
begin
  if target = me then raise exception 'self'; end if;
  -- 차단 관계는 "보낼 수 없음"으로만 알린다 (차단 사실 비노출)
  if public.is_blocked_between(me, target)
     or not exists (select 1 from public.profiles where id = target and status = 'active') then
    raise exception 'unavailable';
  end if;
  if exists (select 1 from public.friendships where user_a = least(me, target) and user_b = greatest(me, target)) then
    raise exception 'already_friends';
  end if;
  update public.friend_requests set status = 'expired'
   where status = 'pending' and expires_at <= now()
     and least(from_user, to_user) = least(me, target) and greatest(from_user, to_user) = greatest(me, target);
  if exists (select 1 from public.friend_requests where status = 'pending'
             and least(from_user, to_user) = least(me, target) and greatest(from_user, to_user) = greatest(me, target)) then
    raise exception 'duplicate';
  end if;
  if (select count(*) from public.friend_requests where from_user = me
      and created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
     >= public.setting_int('daily_friend_request_limit') then
    raise exception 'daily_limit';
  end if;
  insert into public.friend_requests (from_user, to_user, expires_at)
  values (me, target, now() + make_interval(days => public.setting_int('friend_request_expire_days')))
  returning id into rid;
  return rid;
end $$;

-- 요청 수락/거절. 수락하면 친구 관계와 1:1 대화방을 한 트랜잭션으로 만든다.
-- 거절은 상대에게 알리지 않는다 (상대의 보낸 요청 목록에서 조용히 사라짐)
create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_uid();
  req public.friend_requests;
  rid uuid;
begin
  select * into req from public.friend_requests
   where id = request_id and to_user = me and status = 'pending' and expires_at > now()
   for update;
  if not found then raise exception 'not_found'; end if;

  if not accept or public.is_blocked_between(me, req.from_user) then
    update public.friend_requests set status = 'declined', responded_at = now() where id = request_id;
    return null;
  end if;

  update public.friend_requests set status = 'accepted', responded_at = now() where id = request_id;
  -- 예전에 친구였다가 끊긴 사이면 그때 방을 다시 쓴다
  select m1.room_id into rid from public.chat_members m1
    join public.chat_members m2 on m2.room_id = m1.room_id and m2.user_id = req.from_user
    join public.chat_rooms r on r.id = m1.room_id and r.kind = 'dm'
   where m1.user_id = me limit 1;
  if rid is null then
    insert into public.chat_rooms (kind) values ('dm') returning id into rid;
    insert into public.chat_members (room_id, user_id) values (rid, me), (rid, req.from_user);
  end if;
  insert into public.friendships (user_a, user_b, room_id)
  values (least(me, req.from_user), greatest(me, req.from_user), rid)
  on conflict do nothing;
  insert into public.messages (room_id, kind, body) values (rid, 'system', '친구가 되었어요. 가볍게 인사를 건네 보세요.');
  return rid;
end $$;

create or replace function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  delete from public.friendships where user_a = least(me, other) and user_b = greatest(me, other);
end $$;

-- 차단: 친구 관계·대기 요청을 정리한다. 상대에게 알리지 않는다
create or replace function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if other = me then raise exception 'self'; end if;
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
  delete from public.friendships where user_a = least(me, other) and user_b = greatest(me, other);
  update public.friend_requests set status = 'declined', responded_at = now()
   where status = 'pending' and ((from_user = me and to_user = other) or (from_user = other and to_user = me));
end $$;

create or replace function public.unblock_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.blocks where blocker = auth.uid() and blocked = other;
end $$;

-- 추천 덕친: 관심 아티스트(70%)·장르(30%) 자카드 유사도 순
create or replace function public.recommend_friends(lim int default 30)
returns table (id uuid, nickname text, bio text, avatar_url text, score real, common_artists int)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  ma as (select artist_id from public.user_artists, me where user_id = me.uid),
  mg as (select genre_id from public.user_genres, me where user_id = me.uid),
  cand as (
    select p.* from public.profiles p, me
     where p.id <> me.uid and p.status = 'active' and p.profile_setup_done
       and not public.is_blocked_between(me.uid, p.id)
       and not exists (select 1 from public.friendships f where f.user_a = least(me.uid, p.id) and f.user_b = greatest(me.uid, p.id))
       and not exists (select 1 from public.friend_requests r where r.status = 'pending' and r.expires_at > now()
                       and least(r.from_user, r.to_user) = least(me.uid, p.id) and greatest(r.from_user, r.to_user) = greatest(me.uid, p.id))
  ),
  scored as (
    select c.id, c.nickname, c.bio, c.avatar_url, c.last_seen_at,
      (select count(*) from public.user_artists ua where ua.user_id = c.id and ua.artist_id in (select artist_id from ma))::int as ia,
      (select count(*) from (select artist_id from public.user_artists where user_id = c.id union select artist_id from ma) u)::int as ua,
      (select count(*) from public.user_genres ug where ug.user_id = c.id and ug.genre_id in (select genre_id from mg))::int as ig,
      (select count(*) from (select genre_id from public.user_genres where user_id = c.id union select genre_id from mg) u)::int as ug
    from cand c
  )
  select id, nickname, bio, avatar_url,
         (0.7 * coalesce(ia::real / nullif(ua, 0), 0) + 0.3 * coalesce(ig::real / nullif(ug, 0), 0))::real as score,
         ia as common_artists
    from scored
   order by score desc, last_seen_at desc
   limit least(greatest(lim, 1), 100)
$$;

-- 닉네임·소개글 검색 + 장르/아티스트 범주 필터
create or replace function public.search_users(q text default '', genre int default null, artist uuid default null)
returns table (id uuid, nickname text, bio text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nickname, p.bio, p.avatar_url
    from public.profiles p
   where p.id <> auth.uid() and p.status = 'active' and p.profile_setup_done
     and not public.is_blocked_between(auth.uid(), p.id)
     and (coalesce(q, '') = '' or p.nickname ilike '%' || q || '%' or p.bio ilike '%' || q || '%')
     and (genre is null or exists (select 1 from public.user_genres g where g.user_id = p.id and g.genre_id = genre))
     and (artist is null or exists (select 1 from public.user_artists a where a.user_id = p.id and a.artist_id = artist))
   order by p.last_seen_at desc
   limit 50
$$;

-- 채팅 목록: 상대·마지막 메시지·안 읽은 수
create or replace function public.list_my_rooms()
returns table (room_id uuid, kind text, partner_id uuid, partner_nickname text, partner_avatar text,
               last_body text, last_kind text, last_at timestamptz, unread int, can_send boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, p.id, coalesce(p.nickname, case when r.kind = 'support' then '덕친소 운영팀' else '알 수 없음' end),
         p.avatar_url, lm.body, lm.kind, coalesce(lm.created_at, r.created_at),
         (select count(*) from public.messages x
           where x.room_id = r.id and x.created_at > me.last_read_at
             and x.sender_id is distinct from auth.uid() and x.kind <> 'system')::int,
         public.can_send(r.id)
    from public.chat_members me
    join public.chat_rooms r on r.id = me.room_id
    left join public.chat_members other on other.room_id = r.id and other.user_id <> me.user_id
    left join public.profiles p on p.id = other.user_id
    left join lateral (select body, kind, created_at from public.messages m where m.room_id = r.id
                       order by created_at desc limit 1) lm on true
   where me.user_id = auth.uid()
     and (p.id is null or not exists (select 1 from public.blocks b where b.blocker = auth.uid() and b.blocked = p.id))
   order by coalesce(lm.created_at, r.created_at) desc
$$;

create or replace function public.mark_room_read(r uuid) returns void
language sql security definer set search_path = '' as $$
  update public.chat_members set last_read_at = now() where room_id = r and user_id = auth.uid()
$$;

create or replace function public.toggle_post_like(p uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if not exists (select 1 from public.posts where id = p and status = 'visible') then raise exception 'not_found'; end if;
  delete from public.post_likes where post_id = p and user_id = me;
  if found then return false; end if;
  insert into public.post_likes (post_id, user_id) values (p, me);
  return true;
end $$;

-- 문의 접수 시 운영팀 대화방을 연다 (답변은 이 방으로 온다)
create or replace function public.ensure_support_room() returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid(); rid uuid;
begin
  select m.room_id into rid from public.chat_members m join public.chat_rooms r on r.id = m.room_id
   where m.user_id = me and r.kind = 'support' limit 1;
  if rid is null then
    insert into public.chat_rooms (kind) values ('support') returning id into rid;
    insert into public.chat_members (room_id, user_id) values (rid, me);
    insert into public.messages (room_id, kind, body) values (rid, 'system', '문의 답변이 이 대화방으로 도착해요.');
  end if;
  return rid;
end $$;

-- 클라이언트에서 직접 부를 함수만 열어 둔다
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_admin(), public.is_room_member(uuid), public.can_send(uuid), public.is_blocked_between(uuid, uuid), public.setting_int(text),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.recommend_friends(int), public.search_users(text, int, uuid),
  public.list_my_rooms(), public.mark_room_read(uuid), public.toggle_post_like(uuid), public.ensure_support_room(),
  public.require_uid()
  to authenticated;

-- 비로그인 요청도 공연 읽기 정책에서 is_admin() 을 평가한다
grant execute on function public.is_admin() to anon;

-- ─────────────────────────── 실시간 ───────────────────────────
alter publication supabase_realtime add table public.messages, public.friend_requests;

-- ─────────────────────────── 파일 저장소 ───────────────────────────
-- public-media: 프로필·배너·게시글 사진. 경로 첫 폴더가 내 ID일 때만 올리고 지울 수 있다
-- chat-media: 채팅 사진(비공개). 경로 = {room_id}/{user_id}/파일, 대화방 참여자만 열람
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('chat-media', 'chat-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "public media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_send(((storage.foldername(name))[1])::uuid));
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_room_member(((storage.foldername(name))[1])::uuid));
