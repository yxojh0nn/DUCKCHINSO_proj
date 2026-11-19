-- 활동 지역(시·도): 프로필에 고르고 보이며, 덕친 추천에서 가까운 사람을 앞에 둔다
-- 좌표는 저장하지 않는다. 앱이 기기 위치로 가장 가까운 시·도를 기기 안에서 고르고, 사람이 확인한 지역 이름만 보낸다
-- (위치정보법: 단말기 안에서만 쓰고 사업자 시스템으로 보내지 않으면 위치기반서비스사업 신고 대상이 아니다)

create table public.regions (
  name text primary key,
  lat real not null, -- 시·도 대략 중심. 지역끼리 거리 계산용
  lng real not null
);
insert into public.regions (name, lat, lng) values
  ('서울', 37.5665, 126.9780), ('부산', 35.1796, 129.0756), ('대구', 35.8714, 128.6014), ('인천', 37.4563, 126.7052),
  ('광주', 35.1595, 126.8526), ('대전', 36.3504, 127.3845), ('울산', 35.5384, 129.3114), ('세종', 36.4800, 127.2890),
  ('경기', 37.4138, 127.5183), ('강원', 37.8228, 128.1555), ('충북', 36.8000, 127.7000), ('충남', 36.5184, 126.8000),
  ('전북', 35.7175, 127.1530), ('전남', 34.8679, 126.9910), ('경북', 36.4919, 128.8889), ('경남', 35.4606, 128.2132),
  ('제주', 33.4996, 126.5312);
alter table public.regions enable row level security;
create policy "regions read" on public.regions for select using (true);
grant select on public.regions to authenticated, anon;

alter table public.profiles add column region text references public.regions(name);
create index profiles_region_idx on public.profiles (region);
grant update (region) on public.profiles to authenticated;

-- 두 지역이 얼마나 가까운가: 같은 지역 1, 300km 이상 0 (없으면 0)
create or replace function public.region_near(a text, b text) returns real
language sql stable set search_path = '' as $$
  -- 지역이 없으면 조인 결과가 없어 null 이 된다 → 0 (null 은 내림차순 정렬에서 맨 앞에 온다)
  select coalesce((select greatest(0, 1 - (6371 * 2 * asin(sqrt(
      power(sin(radians(rb.lat - ra.lat) / 2), 2) + cos(radians(ra.lat)) * cos(radians(rb.lat)) * power(sin(radians(rb.lng - ra.lng) / 2), 2)
    ))) / 300)::real
    from public.regions ra, public.regions rb where ra.name = a and rb.name = b), 0)
$$;

-- 덕친 추천: 아티스트 55% + 장르 20% + 지역 가까움 25%. 내 지역이 없으면 예전처럼 취향만으로
drop function public.recommend_friends(int);
create function public.recommend_friends(lim int default 30)
returns table (id uuid, nickname text, bio text, avatar_url text, score real, common_artists int, region text)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid, p.region from public.profiles p where p.id = auth.uid() and public.is_active_member()),
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
    select c.id, c.nickname, c.bio, c.avatar_url, c.last_seen_at, c.region,
      (select count(*) from public.user_artists ua where ua.user_id = c.id and ua.artist_id in (select artist_id from ma))::int as ia,
      (select count(*) from (select artist_id from public.user_artists where user_id = c.id union select artist_id from ma) u)::int as ua,
      (select count(*) from public.user_genres ug where ug.user_id = c.id and ug.genre_id in (select genre_id from mg))::int as ig,
      (select count(*) from (select genre_id from public.user_genres where user_id = c.id union select genre_id from mg) u)::int as ug,
      public.region_near((select region from me), c.region) as near
    from cand c
  )
  select id, nickname, bio, avatar_url,
         (0.55 * coalesce(ia::real / nullif(ua, 0), 0) + 0.2 * coalesce(ig::real / nullif(ug, 0), 0) + 0.25 * near)::real as score,
         ia as common_artists, region
    from scored
   order by score desc, last_seen_at desc
   limit least(greatest(lim, 1), 100)
$$;
revoke execute on function public.recommend_friends(int) from public, anon;
grant execute on function public.recommend_friends(int) to authenticated;

-- 프로필 카드에 지역 표시
drop function public.profile_card(uuid);
create function public.profile_card(target uuid)
returns table (id uuid, nickname text, bio text, avatar_url text, banner_url text, is_guest boolean, profile_setup_done boolean,
               artist_ids uuid[], genre_ids smallint[], favorite_ids uuid[], upcoming_count int, region text)
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
         (select count(*) from fav where fav.upcoming)::int,
         p.region
    from public.profiles p where p.id = target;
end $$;
revoke execute on function public.profile_card(uuid) from public, anon;
grant execute on function public.profile_card(uuid) to authenticated;
