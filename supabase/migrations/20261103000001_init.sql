-- 덕친소 초기 스키마 (docs/보안_및_회원정보_처리_기획서.md 기준)
-- 원칙
-- 1. 모든 사용자 데이터는 auth.users.id 하나로 묶인다. profiles.id = auth.users.id 이고,
--    사용자 소유 테이블은 모두 profiles(id) on delete cascade 로 연결한다.
--    → 탈퇴는 "auth.users 에서 내 행 하나를 지운다" 한 번으로 끝나고, 다른 사용자의 행은 경로상 지워질 수 없다.
-- 2. 모든 테이블 RLS 활성. 앱에는 anon 키만 들어가고, 쓰기 규칙이 복잡한 곳은 security definer 함수로만 연다.
-- 3. 시각은 timestamptz(UTC)로 저장하고 화면에서 Asia/Seoul 로 바꾼다.

-- ─────────────────────────── 운영 설정 ───────────────────────────
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('consent_version', '"2026-11-03"'),
  ('max_artists', '5'),
  ('max_genres', '5'),
  ('friend_request_expire_days', '3'),
  ('daily_friend_request_limit', '20'),
  ('concert_retention_days', '365'),      -- 공연 마지막 날로부터 보관 일수 (6개월~1년, 추후 조정)
  ('guest_inactive_delete_days', '180');  -- 비회원(익명) 계정 미접속 삭제 기준

create or replace function public.setting_int(k text) returns int
language sql stable security definer set search_path = '' as $$
  select (value #>> '{}')::int from public.app_settings where key = k
$$;

-- ─────────────────────────── 계정 ───────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  bio text not null default '' check (char_length(bio) <= 150),
  avatar_url text,
  banner_url text,
  is_guest boolean not null default true,
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  profile_setup_done boolean not null default false,
  community_agreed_at timestamptz,
  notify_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index profiles_nickname_key on public.profiles (lower(nickname));

-- 가입(익명 포함) 시 프로필 자동 생성. 비회원은 "익명의 팬0000" 닉네임 발급
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  nick text;
  tries int := 0;
begin
  base := case
    when new.is_anonymous then '익명의 팬'
    else left(coalesce(new.raw_user_meta_data ->> 'nickname',
                       new.raw_user_meta_data ->> 'name',
                       split_part(coalesce(new.email, ''), '@', 1), '덕친'), 14)
  end;
  if char_length(base) < 2 then base := '덕친'; end if;
  loop
    nick := base || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where lower(nickname) = lower(nick));
    tries := tries + 1;
    if tries > 20 then nick := base || substr(replace(new.id::text, '-', ''), 1, 6); exit; end if;
  end loop;
  insert into public.profiles (id, nickname, is_guest) values (new.id, nick, coalesce(new.is_anonymous, false));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 동의 이력. 철회도 새 행으로 남긴다 (기획서 9.2)
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item text not null check (item in ('age14', 'terms', 'privacy', 'policy', 'push', 'marketing', 'nightMarketing', 'community')),
  version text not null,
  agreed boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, item, created_at desc);

create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ─────────────────────────── 취향 ───────────────────────────
create table public.genres (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

insert into public.genres (id, slug, name, sort_order) values
  (1, 'rock', '록', 1), (2, 'indie', '인디', 2), (3, 'metal', '메탈', 3),
  (4, 'anisong', '애니송', 4), (5, 'idol', '아이돌', 5), (6, 'citypop', '시티팝', 6),
  (7, 'vocaloid', '보카로', 7), (8, 'hiphop', '힙합', 8), (9, 'electronic', '일렉트로닉', 9),
  (10, 'ballad', '발라드', 10);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- 한국어 표기 (없으면 원어)
  name_ja text,
  name_en text,
  aliases text[] not null default '{}',  -- 공연명 대조용 별칭 (MusicBrainz aliases)
  mbid text unique,              -- MusicBrainz ID
  image_url text,
  source text not null default 'admin' check (source in ('admin', 'musicbrainz')),
  created_at timestamptz not null default now()
);

create table public.user_artists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.user_genres (
  user_id uuid not null references public.profiles (id) on delete cascade,
  genre_id smallint not null references public.genres (id) on delete cascade,
  primary key (user_id, genre_id)
);

create or replace function public.check_pref_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'user_artists'
     and (select count(*) from public.user_artists where user_id = new.user_id) >= public.setting_int('max_artists') then
    raise exception 'limit_reached';
  end if;
  if tg_table_name = 'user_genres'
     and (select count(*) from public.user_genres where user_id = new.user_id) >= public.setting_int('max_genres') then
    raise exception 'limit_reached';
  end if;
  return new;
end $$;

create trigger user_artists_limit before insert on public.user_artists for each row execute function public.check_pref_limit();
create trigger user_genres_limit before insert on public.user_genres for each row execute function public.check_pref_limit();

-- ─────────────────────────── 공연 ───────────────────────────
create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  kopis_id text unique,
  title text not null,
  poster_url text,
  venue_name text not null,
  venue_query text not null,     -- 지도 앱 검색어
  region text,
  price_text text,               -- KOPIS pcseguidance 원문
  price_min int,
  price_max int,
  ticket_open_at timestamptz,    -- KOPIS 미제공 → 운영자 입력
  genre_id smallint references public.genres (id),
  status text not null default 'review' check (status in ('published', 'review', 'hidden')),
  source text not null default 'admin' check (source in ('admin', 'kopis')),
  last_date date,                -- 보관 기간 계산용 (마지막 회차 날짜, KST)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index concerts_status_idx on public.concerts (status, last_date);

create table public.concert_schedules (
  concert_id uuid not null references public.concerts (id) on delete cascade,
  starts_at timestamptz not null,
  primary key (concert_id, starts_at)
);

create table public.concert_artists (
  concert_id uuid not null references public.concerts (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  primary key (concert_id, artist_id)
);

create table public.ticket_links (
  concert_id uuid not null references public.concerts (id) on delete cascade,
  vendor text not null,
  url text not null check (url ~ '^https?://'),
  primary key (concert_id, url)
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concert_id uuid not null references public.concerts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, concert_id)
);

-- ─────────────────────────── 친구·차단·채팅 ───────────────────────────
create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index friend_requests_pending_pair
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user)) where status = 'pending';
create index friend_requests_to_idx on public.friend_requests (to_user, status);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'dm' check (kind in ('dm', 'support')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.chat_members (
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete cascade, -- null = 시스템·운영팀
  kind text not null default 'text' check (kind in ('text', 'image', 'system')),
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,               -- chat-media 버킷 경로 ({room_id}/{user_id}/파일)
  created_at timestamptz not null default now(),
  check (kind <> 'image' or image_path is not null)
);
create index messages_room_idx on public.messages (room_id, created_at desc);

create or replace function public.is_room_member(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members where room_id = r and user_id = auth.uid())
$$;

-- 1:1 방은 친구 관계가 있고 차단이 없을 때만 보낼 수 있다. 운영팀 문의방은 항상 가능
create or replace function public.can_send(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_room_member(r) and (
    exists (select 1 from public.chat_rooms where id = r and kind = 'support')
    or exists (
      select 1 from public.friendships f
      where f.room_id = r and auth.uid() in (f.user_a, f.user_b)
        and not public.is_blocked_between(f.user_a, f.user_b)
    )
  )
$$;

create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_rooms set last_message_at = new.created_at where id = new.room_id;
  if new.sender_id is not null then
    update public.chat_members set last_read_at = new.created_at
     where room_id = new.room_id and user_id = new.sender_id;
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_insert();

-- ─────────────────────────── 커뮤니티 ───────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  image_urls text[] not null default '{}' check (cardinality(image_urls) <= 4),
  concert_id uuid references public.concerts (id) on delete set null, -- 공연 후기 연결
  like_count int not null default 0,
  comment_count int not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (status, created_at desc);
create index posts_tags_idx on public.posts using gin (tags);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create or replace function public.bump_post_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(0, like_count + d) where id = coalesce(new.post_id, old.post_id);
  else
    update public.posts set comment_count = greatest(0, comment_count + d) where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.bump_post_counts();
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_post_counts();

-- ─────────────────────────── 신고·제재·문의 ───────────────────────────
-- 신고·제재 기록은 법령상 보관 대상이라 탈퇴 시 사용자 연결만 끊고(set null) 행은 남긴다
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles (id) on delete set null,
  target_user uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (reason in ('abuse', 'sexual', 'scam', 'spam', 'harmful_image', 'etc')),
  detail text check (char_length(detail) <= 500),
  content_snapshot text,         -- 신고 시점 원문 (삭제돼도 처리 가능하도록)
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  level text not null check (level in ('warning', 'suspend', 'ban')),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('bug', 'concert_info', 'account', 'report', 'suggestion', 'etc')),
  answers jsonb not null default '{}',  -- 설문 응답
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'answered')),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 신고 시 원문을 서버에서 복사한다 (클라이언트가 보낸 값을 믿지 않음)
create or replace function public.fill_report_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.content_snapshot := coalesce(
    (select title || E'\n' || body from public.posts where id = new.post_id),
    (select body from public.comments where id = new.comment_id),
    (select coalesce(nullif(body, ''), image_path) from public.messages where id = new.message_id),
    (select nickname || E'\n' || bio from public.profiles where id = new.target_user));
  return new;
end $$;
create trigger reports_snapshot before insert on public.reports for each row execute function public.fill_report_snapshot();
