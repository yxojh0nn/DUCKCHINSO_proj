-- 보안 점검 2단계 (2026-11-11) — docs/보안_취약점_보완_계획.md 3-3
--   M7 출처(source)는 서버가 정한다 · M8 운영자 변경 기록 · L7 내 메시지 삭제 · I2 커뮤니티 동의 시각은 서버가 찍는다
--   + 1단계 뒤 찾은 것: 정지·이용 제한 계정의 사용자 검색·추천·프로필 수정·DM 표시 정리

-- ─────────── M7·M8: 아티스트·공연 쓰기 도장 ───────────
-- source='admin' 은 "운영자가 손봐서 수집이 덮어쓰지 않는 행"이다(sync-artists·saveConcert 가 이 값을 본다).
-- 앱(로그인 사용자 = RLS 상 운영자)에서 온 쓰기는 무조건 admin, 수집 함수(service_role, auth.uid() 없음)는 보낸 값 그대로.
-- 작성자·수정자는 외래키 없이 id 만 남긴다: 계정을 지워도 "누가 했는지"가 사라지지 않게
alter table public.artists add column created_by uuid default auth.uid(), add column updated_by uuid,
  add column updated_at timestamptz not null default now();
alter table public.concerts add column created_by uuid default auth.uid(), add column updated_by uuid;

create or replace function public.stamp_admin_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then new.source := 'admin'; end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_by := auth.uid();
    new.updated_at := now();
  else
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger artists_stamp before insert or update on public.artists for each row execute function public.stamp_admin_write();
create trigger concerts_stamp before insert or update on public.concerts for each row execute function public.stamp_admin_write();

-- 운영 기록: 지우거나 고칠 수 없다(앱 권한 없음, service_role 도 수정·삭제 불가). 1년 보관. 조회는 SQL Editor
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, -- 외래키 없음: 운영자 계정이 지워져도 기록은 그대로
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb
);
create index admin_audit_log_at_idx on public.admin_audit_log (at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
revoke update, delete, truncate on public.admin_audit_log from service_role;

-- 사람이 한 변경만 남긴다 (수집 함수의 대량 갱신은 주체가 시스템이라 제외)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(coalesce(new, old));
begin
  if auth.uid() is not null then
    insert into public.admin_audit_log (actor, table_name, row_id, action, before, after)
    values (auth.uid(), tg_table_name,
            coalesce(j->>'id', j->>'concert_id', j->>'user_id', j->>'word', j->>'name'),
            lower(tg_op),
            case when tg_op <> 'INSERT' then to_jsonb(old) end,
            case when tg_op <> 'DELETE' then to_jsonb(new) end);
  end if;
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['artists', 'concerts', 'concert_artists', 'concert_schedules', 'ticket_links',
                           'banned_words', 'allowed_words', 'jpop_promoters', 'sanctions', 'admins'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;

-- ─────────── L7: 내 메시지 삭제 ───────────
-- 화면에는 "삭제된 메시지예요"만 남긴다. 원문은 운영자만 보는 message_originals 에 30일 보관
-- (상대가 나중에 신고해도 원문으로 처리할 수 있게. 신고 스냅숏은 message_originals 를 먼저 본다)
alter table public.messages add column deleted_at timestamptz;

create or replace function public.delete_my_message(m uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); msg public.messages;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into msg from public.messages
   where id = m and sender_id = me and kind in ('text', 'image') and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  insert into public.message_originals (message_id, body)
  values (m, case when msg.kind = 'image' then '[사진] ' || msg.image_path else msg.body end)
  on conflict (message_id) do nothing; -- 금칙어로 가려진 메시지는 이미 원문이 있다
  update public.messages set kind = 'text', body = '삭제된 메시지예요', image_path = null, deleted_at = now() where id = m;
  return msg.image_path; -- 앱이 Storage 에서 사진 파일을 지운다
end $$;

-- 보낸 사람은 자기 채팅 사진 파일을 지울 수 있다 (경로 = {room_id}/{user_id}/파일)
create policy "chat media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[2] = auth.uid()::text);

-- ─────────── I2: 커뮤니티 동의 시각은 서버가 찍는다 ───────────
-- 동의 기록(consents)과 시각을 한 번에 남긴다. 앱이 동의 없이 시각만 찍을 수 없다.
-- profile_setup_done 은 본인 편의용 표시라 위조해도 얻는 것이 없어 그대로 둔다
revoke update (community_agreed_at) on public.profiles from authenticated;

create or replace function public.agree_community(ver text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if coalesce(btrim(ver), '') = '' then raise exception 'bad_request'; end if;
  insert into public.consents (user_id, item, version, agreed) values (me, 'community', ver, true);
  update public.profiles set community_agreed_at = now() where id = me;
end $$;

-- ─────────── 정지·이용 제한 계정 정리 ───────────
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_guest and status = 'active')
$$;

-- 사용자 검색·추천: 활성 회원만
create or replace function public.recommend_friends(lim int default 30)
returns table (id uuid, nickname text, bio text, avatar_url text, score real, common_artists int)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid where public.is_active_member()),
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
   where public.is_active_member()
     and p.id <> auth.uid() and p.status = 'active' and p.profile_setup_done and not p.is_guest
     and not public.is_blocked_between(auth.uid(), p.id)
     and (coalesce(q, '') = '' or p.nickname ilike '%' || q || '%' or p.bio ilike '%' || q || '%')
     and (genre is null or exists (select 1 from public.user_genres g where g.user_id = p.id and g.genre_id = genre))
     and (artist is null or exists (select 1 from public.user_artists a where a.user_id = p.id and a.artist_id = artist))
   order by p.last_seen_at desc
   limit 50
$$;

-- 프로필 고정: 비회원(닉네임·사진·배너) + 정지·이용 제한 계정(닉네임·소개·사진·배너). 알림 설정·접속 시각은 그대로
create or replace function public.guest_profile_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id = auth.uid() then
    if new.is_guest and (new.nickname is distinct from old.nickname
                         or new.avatar_url is distinct from old.avatar_url
                         or new.banner_url is distinct from old.banner_url) then
      raise exception 'members_only';
    end if;
    if old.status <> 'active' and (new.nickname is distinct from old.nickname or new.bio is distinct from old.bio
                                   or new.avatar_url is distinct from old.avatar_url
                                   or new.banner_url is distinct from old.banner_url) then
      raise exception 'account_restricted';
    end if;
  end if;
  return new;
end $$;

-- 보낼 수 있는 방: 정지·이용 제한 계정은 운영팀 대화방만 (채팅 목록의 입력창 표시도 이 값을 따른다)
create or replace function public.can_send(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_room_member(r) and (
    exists (select 1 from public.chat_rooms where id = r and kind = 'support')
    or (exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
        and exists (
          select 1 from public.friendships f
          where f.room_id = r and auth.uid() in (f.user_a, f.user_b)
            and not public.is_blocked_between(f.user_a, f.user_b)))
  )
$$;

-- ─────────── 보관 기간 정리 ───────────
create or replace function public.cleanup_security_logs() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.admin_audit_log where at < now() - interval '1 year';
  delete from public.message_originals o using public.messages m
   where m.id = o.message_id and m.deleted_at < now() - interval '30 days';
end $$;

revoke execute on function public.stamp_admin_write(), public.audit_row(), public.cleanup_security_logs() from public, anon, authenticated;
revoke execute on function public.delete_my_message(uuid), public.agree_community(text), public.is_active_member() from public, anon;
grant execute on function public.delete_my_message(uuid), public.agree_community(text), public.is_active_member() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('duckchinso-security-cleanup', '20 4 * * *', 'select public.cleanup_security_logs()');
  end if;
end $$;
