-- 보안 점검(2026-11-10) 1단계 조치 — docs/보안_취약점_보완_계획.md 3-1·3-6
--   비회원(익명 로그인)도 authenticated 라서 생긴 구멍을 막는다 (M1·M3·M4·M6·L2·L3·L5)
--   결정: 비회원은 매칭·DM·문의·댓글·추천 불가(D1·D2), 남의 취향은 모두 열람하되 다가오는 관심 공연은 친구만(D3),
--         마지막 접속 시각 비공개(D4)

-- ① 회원 여부. submit_ticket_tip 과 같은 기준(profiles.is_guest = 익명 로그인 여부, 가입 트리거가 채운다)
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_guest)
$$;

create or replace function public.require_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if not public.is_member() then raise exception 'members_only'; end if;
  return me;
end $$;

-- L2: 운영자 판정에서 비회원 토큰을 따로 거른다 (방어 심층화)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ② M4·D1: 소셜 함수는 회원만. 받는 쪽도 회원이어야 한다 (비회원은 응답할 수 없으므로)
create or replace function public.send_friend_request(target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_member();
  rid uuid;
begin
  if target = me then raise exception 'self'; end if;
  if public.is_blocked_between(me, target)
     or not exists (select 1 from public.profiles where id = target and status = 'active' and not is_guest) then
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

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_member();
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

create or replace function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_member();
begin
  if other = me then raise exception 'self'; end if;
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
  delete from public.friendships where user_a = least(me, other) and user_b = greatest(me, other);
  update public.friend_requests set status = 'declined', responded_at = now()
   where status = 'pending' and ((from_user = me and to_user = other) or (from_user = other and to_user = me));
end $$;

-- D2: 추천(좋아요)도 회원만
create or replace function public.toggle_post_like(p uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_member();
begin
  if not exists (select 1 from public.posts where id = p and status = 'visible') then raise exception 'not_found'; end if;
  delete from public.post_likes where post_id = p and user_id = me;
  if found then return false; end if;
  insert into public.post_likes (post_id, user_id) values (p, me);
  return true;
end $$;

-- 문의(운영팀 대화방)도 회원만. 운영자 제재 알림은 admin_sanction 이 따로 방을 만든다
create or replace function public.ensure_support_room() returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_member(); rid uuid;
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

-- ③ M3: 사용자 검색·추천은 회원만 부를 수 있고, 회원만 결과에 나온다
create or replace function public.recommend_friends(lim int default 30)
returns table (id uuid, nickname text, bio text, avatar_url text, score real, common_artists int)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid where public.is_member()),
  ma as (select artist_id from public.user_artists, me where user_id = me.uid),
  mg as (select genre_id from public.user_genres, me where user_id = me.uid),
  cand as (
    select p.* from public.profiles p, me
     where p.id <> me.uid and p.status = 'active' and p.profile_setup_done and not p.is_guest
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

create or replace function public.search_users(q text default '', genre int default null, artist uuid default null)
returns table (id uuid, nickname text, bio text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nickname, p.bio, p.avatar_url
    from public.profiles p
   where public.is_member()
     and p.id <> auth.uid() and p.status = 'active' and p.profile_setup_done and not p.is_guest
     and not public.is_blocked_between(auth.uid(), p.id)
     and (coalesce(q, '') = '' or p.nickname ilike '%' || q || '%' or p.bio ilike '%' || q || '%')
     and (genre is null or exists (select 1 from public.user_genres g where g.user_id = p.id and g.genre_id = genre))
     and (artist is null or exists (select 1 from public.user_artists a where a.user_id = p.id and a.artist_id = artist))
   order by p.last_seen_at desc
   limit 50
$$;

-- ④ M4·D2: 표 정책도 함수와 같은 기준
drop policy "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text', 'image') and public.can_send(room_id) and public.is_member());
drop policy "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_member()
              and exists (select 1 from public.profiles p where p.id = auth.uid()
                          and p.status = 'active' and p.community_agreed_at is not null));
drop policy "inquiries insert" on public.inquiries;
create policy "inquiries insert" on public.inquiries for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

-- ⑤ M1·D4: 남의 프로필은 공개 칸만. 마지막 접속·가입일·알림 설정은 비공개, 앞으로 추가하는 칸도 기본 비공개
--   (community_agreed_at·profile_setup_done 은 글·댓글 정책 안의 하위 조회가 읽어야 해서 남긴다)
revoke select on public.profiles from authenticated;
grant select (id, nickname, bio, avatar_url, banner_url, is_guest, status, profile_setup_done, community_agreed_at)
  on public.profiles to authenticated;

-- 내 프로필 전체 칸
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = auth.uid()
$$;

-- ⑥ L3·D3: 취향·관심 공연 표는 본인 것만 직접 읽는다 (전체를 한 번에 내려받는 대량 수집 차단)
drop policy "user artists read" on public.user_artists;
create policy "user artists read" on public.user_artists for select to authenticated using (user_id = auth.uid());
drop policy "user genres read" on public.user_genres;
create policy "user genres read" on public.user_genres for select to authenticated using (user_id = auth.uid());
drop policy "favorites read" on public.favorites;
create policy "favorites read" on public.favorites for select to authenticated using (user_id = auth.uid());

-- 남의 프로필은 한 사람씩. 관심 아티스트·장르·지난 관심 공연은 누구나,
-- 다가오는 관심 공연(오늘 이후 회차가 남은 공연)은 미래 동선이라 본인·친구만 목록, 나머지는 개수만
create or replace function public.profile_card(target uuid)
returns table (id uuid, nickname text, bio text, avatar_url text, banner_url text, is_guest boolean, profile_setup_done boolean,
               artist_ids uuid[], genre_ids smallint[], favorite_ids uuid[], upcoming_count int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me uuid := public.require_uid();
  close boolean;
begin
  if not exists (select 1 from public.profiles p where p.id = target and (p.id = me or p.status <> 'banned'))
     or public.is_blocked_between(me, target) then
    raise exception 'not_found';
  end if;
  close := target = me or exists (select 1 from public.friendships f
                                   where f.user_a = least(me, target) and f.user_b = greatest(me, target));
  return query
  with fav as (
    select f.concert_id, exists (select 1 from public.concert_schedules s where s.concert_id = f.concert_id
                                  and (s.starts_at at time zone 'Asia/Seoul')::date >= (now() at time zone 'Asia/Seoul')::date) as upcoming
      from public.favorites f join public.concerts c on c.id = f.concert_id and c.status = 'published'
     where f.user_id = target
  )
  select p.id, p.nickname, p.bio, p.avatar_url, p.banner_url, p.is_guest, p.profile_setup_done,
         coalesce((select array_agg(a.artist_id) from public.user_artists a where a.user_id = target), '{}'),
         coalesce((select array_agg(g.genre_id) from public.user_genres g where g.user_id = target), '{}'),
         coalesce((select array_agg(fav.concert_id) from fav where close or not fav.upcoming), '{}'),
         (select count(*) from fav where fav.upcoming)::int
    from public.profiles p where p.id = target;
end $$;

-- ⑦ M6: 사진 올리기는 회원만. 본인 경로 읽기 정책이 없어서 삭제(먼저 대상을 조회한다)가 실패하던 것을 고친다
drop policy "public media upload own" on storage.objects;
create policy "public media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy "public media read own" on storage.objects for select to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy "chat media upload" on storage.objects;
create policy "chat media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_send(((storage.foldername(name))[1])::uuid)
              and public.is_member());

-- ⑧ L5: 닉네임 허용 문자 (한글·일본어·영문·숫자·공백 _ . -). 기존 행은 운영자가 정리한 뒤 validate
alter table public.profiles add constraint profiles_nickname_chars
  check (nickname ~ '^[가-힣ㄱ-ㅎㅏ-ㅣぁ-ゖァ-ヺー一-龯A-Za-z0-9 _.\-]+$') not valid;

grant execute on function public.is_member(), public.require_member(), public.my_profile(), public.profile_card(uuid) to authenticated;
