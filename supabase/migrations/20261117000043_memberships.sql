-- 멤버십 1단계 (2026-11-17) — 결제 연동 전. 운영자가 시험으로 넣어 주고, 결제가 붙으면 결제 확인 함수가 같은 칸을 채운다
--   월 구독(subscriber): 관심 아티스트·장르 20개 + 구독 개월 수 뱃지. 그 밖은 무료(free)
--   구독이 끝나 한도를 넘으면 지우지 않는다. 먼저 담은 것부터 한도만큼만 유효하고, 앱이 나머지를 옅게 보여 준다
--   그래서 담은 순서가 필요하다 → 저장을 "전부 지우고 다시 넣기"에서 "바뀐 것만" 함수로 바꾸고, 장르에도 담은 시각을 둔다

insert into public.app_settings (key, value) values
  ('max_artists_subscriber', '20'),
  ('max_genres_subscriber', '20')
on conflict (key) do nothing;

create table public.memberships (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sub_started_at timestamptz, -- 지금 이어지는 구독이 시작된 때 (끊겼다 다시 하면 새로 센다)
  sub_until timestamptz,      -- 구독 만료 시각
  auto_renew boolean not null default true, -- false = 해지 예약 (sub_until 까지만 이용하고 다음 결제 안 함)
  updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
revoke all on public.memberships from anon, authenticated;

-- 후원(구독) 중인지: 이 판정의 유일한 출처. 결제 실패 유예 기간도 sub_until 에 들어 있어 여기서 같이 본다
--   혜택을 거는 DB 쪽은 모두 이 함수를 부른다 (앱은 my_membership().tier, 남은 member_badge 가 null 이 아닌지)
create or replace function public.is_subscriber(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.sub_until > now() from public.memberships m where m.user_id = uid), false)
$$;

-- 구독 중이면 결제(시작)일부터 꽉 채운 달 수. 첫 달은 0, 같은 날짜가 돌아올 때마다 1씩 는다. 아니면 null
create or replace function public.sub_months(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (extract(year from age(now(), m.sub_started_at)) * 12 + extract(month from age(now(), m.sub_started_at)))::int
    from public.memberships m
   where m.user_id = uid and public.is_subscriber(uid) and m.sub_started_at is not null
$$;

-- 그 사람의 관심 아티스트(kind='user_artists')·장르(kind='user_genres') 한도
create or replace function public.pref_limit(uid uuid, kind text) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_subscriber(uid) then
    return public.setting_int(case kind when 'user_artists' then 'max_artists_subscriber' else 'max_genres_subscriber' end);
  end if;
  return public.setting_int(case kind when 'user_artists' then 'max_artists' else 'max_genres' end);
end $$;
revoke execute on function public.is_subscriber(uuid), public.sub_months(uuid), public.pref_limit(uuid, text) from public, anon, authenticated;

create or replace function public.check_pref_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'user_artists'
     and (select count(*) from public.user_artists where user_id = new.user_id) >= public.pref_limit(new.user_id, 'user_artists') then
    raise exception 'limit_reached';
  end if;
  if tg_table_name = 'user_genres'
     and (select count(*) from public.user_genres where user_id = new.user_id) >= public.pref_limit(new.user_id, 'user_genres') then
    raise exception 'limit_reached';
  end if;
  return new;
end $$;

-- 장르도 담은 순서를 남긴다 (이미 있던 행은 같은 시각 → 번호 순으로 본다)
alter table public.user_genres add column created_at timestamptz not null default now();

-- 저장: 빠진 것만 지우고 새로 고른 것만 넣는다 (이미 있던 것은 담은 시각이 그대로). 새 것은 고른 순서대로 시각을 준다
--   표 정책과 같이 본인 것만, 이용 제한 중에도 된다 (캘린더 쪽 설정은 상태를 보지 않는다, 마이그 25)
create or replace function public.set_my_artists(ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.user_artists where user_id = me and artist_id <> all (ids);
  insert into public.user_artists (user_id, artist_id, created_at)
  select me, x.id, clock_timestamp() from unnest(ids) with ordinality x(id, n)
   where not exists (select 1 from public.user_artists a where a.user_id = me and a.artist_id = x.id)
   order by x.n;
end $$;

create or replace function public.set_my_genres(ids smallint[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.user_genres where user_id = me and genre_id <> all (ids);
  insert into public.user_genres (user_id, genre_id, created_at)
  select me, x.id, clock_timestamp() from unnest(ids) with ordinality x(id, n)
   where not exists (select 1 from public.user_genres g where g.user_id = me and g.genre_id = x.id)
   order by x.n;
end $$;

-- 내 멤버십: 등급·한도·구독 개월 수·자동 갱신 여부
create or replace function public.my_membership()
returns table (tier text, sub_started_at timestamptz, sub_until timestamptz,
               max_artists int, max_genres int, months int, auto_renew boolean)
language sql stable security definer set search_path = '' as $$
  select case when public.is_subscriber(me.uid) then 'subscriber' else 'free' end,
         m.sub_started_at, m.sub_until,
         public.pref_limit(auth.uid(), 'user_artists'), public.pref_limit(auth.uid(), 'user_genres'), public.sub_months(auth.uid()),
         coalesce(m.auto_renew, true)
    from (select auth.uid() as uid) me
    left join public.memberships m on m.user_id = me.uid
   where me.uid is not null
$$;

-- 구독 해지 예약(false)·해지 취소(true). 구독 중일 때만. 해지해도 만료일까지는 그대로 구독 중
create or replace function public.set_my_auto_renew(turn_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.memberships set auto_renew = turn_on, updated_at = now()
   where user_id = auth.uid() and sub_until > now();
  if not found then raise exception 'not_subscribed'; end if;
end $$;

-- 남의 프로필 뱃지: 구독 개월 수만 공개 (시작일·만료일은 비공개)
create or replace function public.member_badge(target uuid) returns int
language sql stable security definer set search_path = '' as $$
  select public.sub_months(target)
$$;

-- 운영자 시험 지급 (결제 연동 전). kind: subscribe(months 개월 연장) / end_sub(구독 지금 끝내기) / clear(전부 지우기)
create or replace function public.admin_set_membership(target uuid, kind text, months int default 1) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.profiles where id = target and not is_guest) then raise exception 'not_found'; end if;
  if kind = 'clear' then delete from public.memberships where user_id = target; return; end if;
  insert into public.memberships (user_id) values (target) on conflict (user_id) do nothing;
  if kind = 'subscribe' then
    if months is null or months not between 1 and 24 then raise exception 'bad_request'; end if;
    update public.memberships
       set sub_started_at = case when sub_until > now() then sub_started_at else now() end,
           auto_renew = case when sub_until > now() then auto_renew else true end, -- 새로 시작하면 자동 갱신부터
           sub_until = greatest(coalesce(sub_until, now()), now()) + make_interval(months => months),
           updated_at = now()
     where user_id = target;
  elsif kind = 'end_sub' then
    update public.memberships set sub_until = least(sub_until, now()), updated_at = now() where user_id = target;
  else
    raise exception 'bad_request';
  end if;
end $$;

-- 운영자: 한 사람의 멤버십 보기
create or replace function public.admin_membership(target uuid)
returns table (sub_started_at timestamptz, sub_until timestamptz, months int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select m.sub_started_at, m.sub_until, public.sub_months(target)
                 from public.memberships m where m.user_id = target;
end $$;

revoke execute on function public.set_my_artists(uuid[]), public.set_my_genres(smallint[]), public.my_membership(), public.set_my_auto_renew(boolean),
  public.member_badge(uuid), public.admin_set_membership(uuid, text, int), public.admin_membership(uuid) from public, anon;
grant execute on function public.set_my_artists(uuid[]), public.set_my_genres(smallint[]), public.my_membership(), public.set_my_auto_renew(boolean),
  public.member_badge(uuid), public.admin_set_membership(uuid, text, int), public.admin_membership(uuid) to authenticated;
