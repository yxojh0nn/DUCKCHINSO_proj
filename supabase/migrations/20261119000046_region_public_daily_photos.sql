-- ① 활동 지역 공개 여부: 끄면 프로필에 지역이 안 보이고, 덕친 추천의 '가까운 사람 먼저'도 (나·상대 모두) 빠진다
alter table public.profiles add column region_public boolean not null default true;
grant update (region_public) on public.profiles to authenticated;

-- 덕친 추천: 300km 안쪽 절반(150km, 같은 지역·이웃 지역) 사람을 먼저, 그 안에서는 취향 점수 순
--   점수 = 아티스트 55% + 장르 20% + 지역 가까움 25%. 내 지역이 없거나 비공개면 취향만으로
drop function public.recommend_friends(int);
create function public.recommend_friends(lim int default 30)
returns table (id uuid, nickname text, bio text, avatar_url text, score real, common_artists int, region text)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid, case when p.region_public then p.region end as region
                from public.profiles p where p.id = auth.uid() and public.is_active_member()),
  ma as (select artist_id from public.user_artists, me where user_id = me.uid),
  mg as (select genre_id from public.user_genres, me where user_id = me.uid),
  cand as (
    select p.*, case when p.region_public then p.region end as shown_region from public.profiles p, me
     where p.id <> me.uid and p.status = 'active' and p.profile_setup_done and not p.is_guest
       and not public.is_blocked_between(me.uid, p.id)
       and not exists (select 1 from public.friendships f where f.user_a = least(me.uid, p.id) and f.user_b = greatest(me.uid, p.id))
       and not exists (select 1 from public.friend_requests r where r.status = 'pending' and r.expires_at > now()
                       and least(r.from_user, r.to_user) = least(me.uid, p.id) and greatest(r.from_user, r.to_user) = greatest(me.uid, p.id))
  ),
  scored as (
    select c.id, c.nickname, c.bio, c.avatar_url, c.last_seen_at, c.shown_region,
      (select count(*) from public.user_artists ua where ua.user_id = c.id and ua.artist_id in (select artist_id from ma))::int as ia,
      (select count(*) from (select artist_id from public.user_artists where user_id = c.id union select artist_id from ma) u)::int as ua,
      (select count(*) from public.user_genres ug where ug.user_id = c.id and ug.genre_id in (select genre_id from mg))::int as ig,
      (select count(*) from (select genre_id from public.user_genres where user_id = c.id union select genre_id from mg) u)::int as ug,
      public.region_near((select region from me), c.shown_region) as near
    from cand c
  )
  select id, nickname, bio, avatar_url,
         (0.55 * coalesce(ia::real / nullif(ua, 0), 0) + 0.2 * coalesce(ig::real / nullif(ug, 0), 0) + 0.25 * near)::real as score,
         ia as common_artists, shown_region
    from scored
   order by near >= 0.5 desc, score desc, last_seen_at desc
   limit least(greatest(lim, 1), 100)
$$;
revoke execute on function public.recommend_friends(int) from public, anon;
grant execute on function public.recommend_friends(int) to authenticated;

-- 프로필 카드: 비공개면 본인에게만 지역이 보인다
create or replace function public.profile_card(target uuid)
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
         case when p.region_public or p.id = me then p.region end
    from public.profiles p where p.id = target;
end $$;

-- ② 덕질 캘린더 사진: 하루 여러 장 (하루 최대 10장), 멤버십 회원만 올리고 본인만 본다
-- 파일 = diary-media(비공개) 버킷 {user_id}/파일. 앱은 내려받은 사진을 기기 캐시에 두고 다시 쓴다
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('diary-media', 'diary-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- RLS 안에서 부를 수 있게 '나는 구독 중인가'만 연다 (is_subscriber(uid) 는 남의 것도 물을 수 있어 닫혀 있다)
create or replace function public.am_subscriber() returns boolean
language sql stable security definer set search_path = '' as $$ select public.is_subscriber(auth.uid()) $$;
revoke execute on function public.am_subscriber() from public, anon;
grant execute on function public.am_subscriber() to authenticated;

create table public.daily_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  path text not null unique,
  created_at timestamptz not null default now()
);
create index daily_photos_user_day_idx on public.daily_photos (user_id, day);
alter table public.daily_photos enable row level security;
create policy "daily photos read own" on public.daily_photos for select to authenticated using (user_id = auth.uid());
create policy "daily photos insert own" on public.daily_photos for insert to authenticated
  with check (user_id = auth.uid() and public.am_subscriber()
              and path like auth.uid()::text || '/%'
              and day <= (now() at time zone 'Asia/Seoul')::date
              and (select count(*) from public.daily_photos d where d.user_id = auth.uid() and d.day = daily_photos.day) < 10);
create policy "daily photos delete own" on public.daily_photos for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.daily_photos to authenticated;
grant insert (day, path) on public.daily_photos to authenticated;

create policy "diary media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'diary-media' and (storage.foldername(name))[1] = auth.uid()::text and public.am_subscriber());
create policy "diary media read own" on storage.objects for select to authenticated
  using (bucket_id = 'diary-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "diary media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'diary-media' and (storage.foldername(name))[1] = auth.uid()::text);
