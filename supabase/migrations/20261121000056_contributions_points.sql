-- 유저 정보 제보 + 포인트 (docs/유저_정보제보_포인트_설계.md, 2026-11-21 결정)
--   제보 종류: 예매 오픈일(ticket_open) · 장르(genre) · 공연 정보(info: 아티스트 정보·공연 수칙·꿀팁)
--   모두 운영자 검수 후 반영. 적용되면 포인트(예매일 30 · 장르 10 · 공연 정보 운영자가 0~30 정수로)
--   제보 기능 첫 이용 때 동의(제보 내용 공개·이용 허락, 닉네임 표시)를 받는다. 동의한 사람만 제보하고, 동의한 사람의 닉네임만 보인다
--   "거부 및 제재" 누적(최근 1년): 1회 7일 · 2회 14일 · 3회 30일 · 4회 이상 영구 제보 정지. 그냥 거부는 세지 않는다
--   가입 3일 뒤부터 제보 가능. 기존 예매일 제보(ticket_open_tips)는 이 큐로 옮기고 지운다

insert into public.app_settings (key, value) values
  ('point_ticket_open', '30'), ('point_genre', '10'), ('point_info_default', '20'), ('point_info_max', '30'),
  ('contrib_daily_max', '10'), ('contrib_min_days', '3')
on conflict (key) do nothing;

alter table public.consents drop constraint consents_item_check;
alter table public.consents add constraint consents_item_check
  check (item in ('age14', 'terms', 'privacy', 'policy', 'push', 'marketing', 'nightMarketing', 'community', 'contribution'));

-- ─────────── 제보 큐 ───────────
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('ticket_open', 'genre', 'info')),
  open_at timestamptz,
  genre_id smallint references public.genres (id),
  category text check (category in ('artist', 'rules', 'tips')),
  title text check (char_length(title) <= 40),
  body text check (char_length(body) <= 1000),
  source_url text check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  reject_reason text check (char_length(reject_reason) <= 200),
  penalized boolean not null default false,
  points int not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  constraint contributions_shape check (case kind
    when 'ticket_open' then open_at is not null and source_url is not null
    when 'genre' then genre_id is not null
    else category is not null and title is not null and body is not null end)
);
create index contributions_status_idx on public.contributions (status, created_at desc);
create index contributions_concert_idx on public.contributions (concert_id, kind);
create index contributions_user_idx on public.contributions (user_id, created_at desc);
create index contributions_resolver_idx on public.contributions (resolved_by);
create index contributions_genre_idx on public.contributions (genre_id);
-- 같은 사람이 같은 공연·같은 종류(공연 정보는 같은 분류)로 대기 중인 제보는 하나만
create unique index contributions_one_pending on public.contributions (concert_id, user_id, kind, coalesce(category, ''))
  where status = 'pending';
alter table public.contributions enable row level security;
revoke all on public.contributions from public, anon, authenticated;

-- 기존 예매일 제보 옮기기 (동의 전 제보라 닉네임은 보이지 않는다)
insert into public.contributions (id, concert_id, user_id, kind, open_at, source_url, status, created_at, resolved_at, resolved_by)
select id, concert_id, user_id, 'ticket_open', open_at, source_url, status, created_at, resolved_at, resolved_by
  from public.ticket_open_tips;
drop function public.submit_ticket_tip(uuid, timestamptz, text);
drop function public.admin_ticket_tips();
drop function public.admin_resolve_ticket_tip(uuid, boolean, timestamptz);
drop table public.ticket_open_tips;

-- ─────────── 공개 공연 정보 ───────────
create table public.concert_infos (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts (id) on delete cascade,
  category text not null check (category in ('artist', 'rules', 'tips')),
  title text not null check (char_length(title) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000),
  author_id uuid references public.profiles (id) on delete set null,
  contribution_id uuid references public.contributions (id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index concert_infos_concert_idx on public.concert_infos (concert_id, category, created_at desc);
create index concert_infos_author_idx on public.concert_infos (author_id);
create index concert_infos_contribution_idx on public.concert_infos (contribution_id);
alter table public.concert_infos enable row level security;
revoke all on public.concert_infos from public, anon, authenticated;

-- ─────────── 포인트 원장 (지우지 않고 쌓는다. 잔액 = 합계) ───────────
create table public.point_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade, -- 탈퇴하면 소멸
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('contribution')),
  contribution_id uuid references public.contributions (id) on delete set null,
  label text not null, -- 지급 내역 표시용 ("예매 오픈일 · 공연명"). 제보 기록이 정리돼도 남는다
  created_at timestamptz not null default now(),
  created_by uuid
);
create index point_ledger_user_idx on public.point_ledger (user_id, created_at desc);
-- 같은 제보로 두 번 지급하지 않는다
create unique index point_ledger_once on public.point_ledger (contribution_id); -- 지금 사유는 지급 하나뿐. 사용·회수가 생기면 where reason = 'contribution' 으로 좁힌다
alter table public.point_ledger enable row level security;
revoke all on public.point_ledger from public, anon, authenticated;

-- ─────────── 제보 기능 제재 (계정 제재 sanctions 와 따로: 계정 정지 자동 해제 로직에 섞이지 않게) ───────────
create table public.contribution_sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contribution_id uuid references public.contributions (id) on delete set null,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz -- null = 영구
);
create index contribution_sanctions_user_idx on public.contribution_sanctions (user_id, starts_at desc);
create index contribution_sanctions_contribution_idx on public.contribution_sanctions (contribution_id);
alter table public.contribution_sanctions enable row level security;
revoke all on public.contribution_sanctions from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['concert_infos', 'point_ledger', 'contribution_sanctions'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;

-- ─────────── 사용자 함수 ───────────
create or replace function public.agree_contribution(ver text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if coalesce(btrim(ver), '') = '' then raise exception 'bad_request'; end if;
  if (select is_guest from public.profiles where id = me) then raise exception 'members_only'; end if;
  insert into public.consents (user_id, item, version, agreed) values (me, 'contribution', ver, true);
end $$;

create or replace function public.contrib_agreed(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.agreed from public.consents c where c.user_id = uid and c.item = 'contribution'
                    order by c.created_at desc limit 1), false)
$$;

-- 지금 걸려 있는 제보 정지 (없으면 행 없음)
create or replace function public.my_contrib_restriction()
returns table (reason text, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.reason, s.ends_at from public.contribution_sanctions s
   where s.user_id = auth.uid() and (s.ends_at is null or s.ends_at > now())
   order by s.ends_at desc nulls first limit 1
$$;

create or replace function public.submit_contribution(
  concert uuid, kind text, open_at timestamptz default null, genre smallint default null,
  category text default null, title text default null, body text default null, source_url text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_uid();
  p public.profiles;
  c public.concerts;
  t text := nullif(btrim(title), '');
  b text := nullif(btrim(body), '');
  u text := nullif(btrim(source_url), '');
begin
  select * into p from public.profiles where id = me;
  if p.is_guest then raise exception 'members_only'; end if;
  if p.created_at > now() - make_interval(days => public.setting_int('contrib_min_days')) then raise exception 'contrib_too_new'; end if;
  if not public.contrib_agreed(me) then raise exception 'contrib_consent'; end if;
  if exists (select 1 from public.contribution_sanctions s where s.user_id = me and (s.ends_at is null or s.ends_at > now())) then
    raise exception 'contrib_restricted';
  end if;
  select * into c from public.concerts where id = concert and status = 'published';
  if c.id is null then raise exception 'not_found'; end if;
  if u is not null and (u !~ '^https?://[^\s]+$' or char_length(u) > 500) then raise exception 'tip_bad_url'; end if;

  if kind = 'ticket_open' then
    if open_at is null or open_at < now() - interval '30 days' or open_at > now() + interval '1 year' then raise exception 'tip_bad_date'; end if;
    if u is null then raise exception 'tip_bad_url'; end if;
    if c.ticket_open_at = open_at then raise exception 'contrib_same'; end if;
  elsif kind = 'genre' then
    if not exists (select 1 from public.genres g where g.id = genre and g.is_active) then raise exception 'bad_request'; end if;
    if c.genre_id = genre then raise exception 'contrib_same'; end if;
  elsif kind = 'info' then
    if category not in ('artist', 'rules', 'tips') then raise exception 'bad_request'; end if;
    if t is null or char_length(t) > 40 or b is null or char_length(b) < 10 or char_length(b) > 1000 then raise exception 'contrib_bad_text'; end if;
    if public.blocked_word(t) is not null or public.blocked_word(b) is not null then raise exception 'blocked_word'; end if;
  else
    raise exception 'bad_request';
  end if;

  -- 하루 한도: 같은 사람의 동시 요청은 여기서 줄을 세워 세기와 넣기를 한 번에 한다 (마이그레이션 53과 같은 이유)
  perform pg_advisory_xact_lock(hashtextextended('contrib:' || me, 0));
  if (select count(*) from public.contributions x where x.user_id = me and x.created_at > now() - interval '1 day')
     >= public.setting_int('contrib_daily_max') then
    raise exception 'daily_limit';
  end if;

  insert into public.contributions (concert_id, user_id, kind, open_at, genre_id, category, title, body, source_url)
  values (concert, me, kind,
          case when kind = 'ticket_open' then open_at end,
          case when kind = 'genre' then genre end,
          case when kind = 'info' then category end,
          case when kind = 'info' then t end,
          case when kind = 'info' then b end,
          u);
exception when unique_violation then raise exception 'tip_exists';
end $$;

-- 내 제보 (최근 1년)
create or replace function public.my_contributions()
returns table (id uuid, concert_id uuid, concert_title text, kind text, open_at timestamptz, genre_id smallint,
               category text, title text, body text, status text, reject_reason text, points int,
               created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id, x.concert_id, c.title, x.kind, x.open_at, x.genre_id, x.category, x.title, x.body,
         x.status, x.reject_reason, x.points, x.created_at, x.resolved_at
    from public.contributions x join public.concerts c on c.id = x.concert_id
   where x.user_id = auth.uid()
   order by x.created_at desc
   limit 200
$$;

-- 포인트 지급 내역 (최신순). 잔액은 앱에서 합한다
create or replace function public.my_points()
returns table (delta int, label text, contribution_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.delta, l.label, l.contribution_id, l.created_at from public.point_ledger l
   where l.user_id = auth.uid() order by l.created_at desc
$$;

-- 공연 추가 정보 페이지: 공개된 공연 정보 + 지금 값을 알려 준 제보자(예매일·장르).
-- 닉네임은 제보 동의를 한 사람만 (탈퇴·미동의는 null)
create or replace function public.concert_extra(concert uuid)
returns table (id uuid, kind text, category text, title text, body text, nickname text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with c as (select * from public.concerts where id = concert and status = 'published')
  select i.id, 'info', i.category, i.title, i.body, case when public.contrib_agreed(w.id) then w.nickname end, i.created_at
    from public.concert_infos i join c on c.id = i.concert_id left join public.profiles w on w.id = i.author_id
   where not i.hidden
  union all
  select * from (
    select distinct on (x.kind) x.id, x.kind, null::text, null::text, null::text,
           case when public.contrib_agreed(w.id) then w.nickname end, x.resolved_at
      from public.contributions x join c on c.id = x.concert_id left join public.profiles w on w.id = x.user_id
     where x.status = 'approved' and x.kind in ('ticket_open', 'genre')
       -- 운영자가 나중에 값을 직접 바꿨다면 그 제보자는 표시하지 않는다
       and (x.kind = 'ticket_open' and x.open_at = c.ticket_open_at or x.kind = 'genre' and x.genre_id = c.genre_id)
     order by x.kind, x.resolved_at desc
  ) s
  order by 7 desc
$$;

-- ─────────── 운영자 함수 ───────────
-- tab: pending(검수 대기) · done(검수 완료: 적용·거부·중복) · penalized(거부 및 제재). 처리분은 최근 200건
create or replace function public.admin_contributions(tab text)
returns table (id uuid, concert_id uuid, concert_title text, artists text, kind text,
               current_open_at timestamptz, current_genre_id smallint,
               open_at timestamptz, genre_id smallint, category text, title text, body text, source_url text,
               status text, reject_reason text, penalized boolean, points int,
               user_id uuid, nickname text, approved_count int, rejected_count int, penalty_count int, restricted_until text,
               created_at timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if tab not in ('pending', 'done', 'penalized') then raise exception 'bad_request'; end if;
  return query
  with picked as (
    select x.* from public.contributions x
     where case tab when 'pending' then x.status = 'pending'
                    when 'done' then x.status <> 'pending' and not x.penalized
                    else x.penalized end
     order by case when tab = 'pending' then x.created_at end asc, x.resolved_at desc nulls last
     limit case when tab = 'pending' then 1000 else 200 end
  )
  select x.id, x.concert_id, c.title,
         (select string_agg(a.name, ', ' order by a.name) from public.concert_artists ca join public.artists a on a.id = ca.artist_id where ca.concert_id = c.id),
         x.kind, c.ticket_open_at, c.genre_id,
         x.open_at, x.genre_id, x.category, x.title, x.body, x.source_url,
         x.status, x.reject_reason, x.penalized, x.points,
         x.user_id, p.nickname,
         (select count(*)::int from public.contributions y where y.user_id = x.user_id and y.status = 'approved'),
         (select count(*)::int from public.contributions y where y.user_id = x.user_id and y.status = 'rejected'),
         (select count(*)::int from public.contribution_sanctions s where s.user_id = x.user_id and s.starts_at > now() - interval '1 year'),
         (select case when s.ends_at is null then 'forever' else s.ends_at::text end from public.contribution_sanctions s
           where s.user_id = x.user_id and (s.ends_at is null or s.ends_at > now()) order by s.ends_at desc nulls first limit 1),
         x.created_at, x.resolved_at
    from picked x
    join public.concerts c on c.id = x.concert_id
    left join public.profiles p on p.id = x.user_id
   order by case when tab = 'pending' then x.created_at end asc, x.resolved_at desc nulls last;
end $$;

-- 적용: 공연에 반영 → 포인트 지급 → 제보자에게 알림. award: 공연 정보만 운영자가 0~30 정수로 (없으면 기본값)
-- 예매일·장르는 같은 공연의 다른 대기 제보를 '중복'으로 닫는다 (먼저 채택된 한 건만 지급)
create or replace function public.admin_approve_contribution(cid uuid, award int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin();
  x public.contributions;
  ctitle text;
  pts int;
  what text;
begin
  select * into x from public.contributions where id = cid for update;
  if x.id is null or x.status <> 'pending' then raise exception 'not_found'; end if;
  if x.user_id = me then raise exception 'self_review'; end if;

  if x.kind = 'ticket_open' then
    update public.concerts set ticket_open_at = x.open_at, updated_at = now() where id = x.concert_id returning title into ctitle;
    pts := public.setting_int('point_ticket_open'); what := '예매 오픈일';
  elsif x.kind = 'genre' then
    update public.concerts set genre_id = x.genre_id, updated_at = now() where id = x.concert_id returning title into ctitle;
    pts := public.setting_int('point_genre'); what := '장르';
  else
    pts := coalesce(award, public.setting_int('point_info_default'));
    if pts < 0 or pts > public.setting_int('point_info_max') then raise exception 'bad_points'; end if;
    insert into public.concert_infos (concert_id, category, title, body, author_id, contribution_id)
      values (x.concert_id, x.category, x.title, x.body, x.user_id, x.id);
    select title into ctitle from public.concerts where id = x.concert_id;
    what := '공연 정보';
  end if;

  -- 탈퇴한 제보자에게는 지급하지 않는다
  if x.user_id is null then pts := 0; end if;
  update public.contributions set status = 'approved', points = pts, resolved_at = now(), resolved_by = me where id = cid;
  if x.kind <> 'info' then
    update public.contributions set status = 'duplicate', resolved_at = now(), resolved_by = me
     where concert_id = x.concert_id and kind = x.kind and status = 'pending';
  end if;
  if pts > 0 then
    insert into public.point_ledger (user_id, delta, reason, contribution_id, label, created_by)
      values (x.user_id, pts, 'contribution', x.id, what || ' · ' || ctitle, me);
  end if;
  if x.user_id is not null then
    perform public.notify_support(x.user_id, '제보해 주신 ' || what || ' 정보가 반영됐어요. 고마워요!'
      || case when pts > 0 then ' ' || pts || '포인트를 드렸어요.' else '' end || ' 공연: ' || ctitle);
  end if;
end $$;

-- 거부 (사유 필수, 사용자에게 그대로 전달). penalize: 고의로 잘못된 정보 → 제보 기능 정지 단계
create or replace function public.admin_reject_contribution(cid uuid, reason text, penalize boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin();
  x public.contributions;
  why text := btrim(reason);
  ctitle text;
  n int;
  d int;
begin
  if coalesce(why, '') = '' or char_length(why) > 200 then raise exception 'bad_reason'; end if;
  select * into x from public.contributions where id = cid for update;
  if x.id is null or x.status <> 'pending' then raise exception 'not_found'; end if;
  if x.user_id = me then raise exception 'self_review'; end if;
  if penalize and exists (select 1 from public.admins where user_id = x.user_id) then raise exception 'forbidden'; end if;
  update public.contributions
     set status = 'rejected', reject_reason = why, penalized = penalize and x.user_id is not null, resolved_at = now(), resolved_by = me
   where id = cid;
  if x.user_id is null then return; end if;
  select title into ctitle from public.concerts where id = x.concert_id;

  if not penalize then
    perform public.notify_support(x.user_id, '보내 주신 제보가 반려됐어요. 공연: ' || ctitle || ' · 사유: ' || why);
    return;
  end if;

  -- 같은 사람의 동시 제재가 단계를 건너뛰지 않게 줄 세운다
  perform pg_advisory_xact_lock(hashtextextended('contrib-sanction:' || x.user_id, 0));
  select count(*) + 1 into n from public.contribution_sanctions s
   where s.user_id = x.user_id and s.starts_at > now() - interval '1 year';
  d := case n when 1 then 7 when 2 then 14 when 3 then 30 end; -- 4회 이상 영구
  insert into public.contribution_sanctions (user_id, contribution_id, reason, ends_at)
    values (x.user_id, x.id, why, case when d is not null then now() + make_interval(days => d) end);
  perform public.notify_support(x.user_id, '보내 주신 제보가 반려됐어요. 공연: ' || ctitle || ' · 사유: ' || why || E'\n'
    || '잘못된 정보를 반복해 보내 ' || case when d is null then '정보 제보 기능을 더 이상 쓸 수 없어요.'
       else d || '일 동안 정보 제보 기능을 쓸 수 없어요. (최근 1년 ' || n || '회)' end);
end $$;

-- 공개된 공연 정보 내리기 (포인트는 그대로)
create or replace function public.admin_hide_concert_info(info uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.concert_infos set hidden = true where id = info;
  if not found then raise exception 'not_found'; end if;
end $$;

-- 처리한 제보·제재 기록은 1년 보관 (포인트 원장은 탈퇴 때까지)
create or replace function public.cleanup_contributions() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contributions where status <> 'pending' and resolved_at < now() - interval '1 year';
  delete from public.contribution_sanctions where ends_at is not null and ends_at < now() - interval '1 year';
end $$;

revoke execute on function public.agree_contribution(text), public.contrib_agreed(uuid), public.my_contrib_restriction(),
  public.submit_contribution(uuid, text, timestamptz, smallint, text, text, text, text), public.my_contributions(), public.my_points(),
  public.concert_extra(uuid), public.admin_contributions(text),
  public.admin_approve_contribution(uuid, int),
  public.admin_reject_contribution(uuid, text, boolean), public.admin_hide_concert_info(uuid), public.cleanup_contributions()
  from public, anon, authenticated;
grant execute on function public.agree_contribution(text), public.my_contrib_restriction(),
  public.submit_contribution(uuid, text, timestamptz, smallint, text, text, text, text), public.my_contributions(), public.my_points(),
  public.concert_extra(uuid), public.admin_contributions(text),
  public.admin_approve_contribution(uuid, int),
  public.admin_reject_contribution(uuid, text, boolean), public.admin_hide_concert_info(uuid)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('duckchinso-contrib-cleanup', '40 4 * * *', 'select public.cleanup_contributions()');
  end if;
end $$;
