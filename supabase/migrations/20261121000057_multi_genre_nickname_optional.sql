-- 제보 조정 (2026-11-21)
--   ① 공개 화면의 닉네임 표시는 선택: 제보 동의(contribution)와 따로 contribution_nickname 동의로 둔다. 나중에 켜고 끌 수 있다
--   ② 공연 장르를 여러 개로: concerts.genre_id → genre_ids smallint[], 장르 제보도 여러 개

alter table public.consents drop constraint consents_item_check;
alter table public.consents add constraint consents_item_check
  check (item in ('age14', 'terms', 'privacy', 'policy', 'push', 'marketing', 'nightMarketing', 'community', 'contribution', 'contribution_nickname'));
-- 이미 동의한 사람은 닉네임 표시가 들어간 문안에 동의했다 → 표시 켬으로 옮긴다
insert into public.consents (user_id, item, version, agreed)
select distinct on (user_id) user_id, 'contribution_nickname', version, agreed
  from public.consents where item = 'contribution' order by user_id, created_at desc;

-- ─────────── 장르 여러 개 ───────────
-- 장르 칸은 운영자 함수로만 쓴다 (앱 직접 수정 권한 없음). 값 검사는 아래 트리거가 한다
alter table public.concerts add column genre_ids smallint[] not null default '{}';
update public.concerts set genre_ids = array[genre_id] where genre_id is not null;
drop index if exists public.concerts_genre_idx;
alter table public.concerts drop column genre_id;

alter table public.contributions add column genre_ids smallint[];
update public.contributions set genre_ids = array[genre_id] where genre_id is not null;
alter table public.contributions drop constraint contributions_shape;
drop index if exists public.contributions_genre_idx;
alter table public.contributions drop column genre_id;
alter table public.contributions add constraint contributions_shape check (case kind
  when 'ticket_open' then open_at is not null and source_url is not null
  when 'genre' then cardinality(genre_ids) between 1 and 3
  else category is not null and title is not null and body is not null end);

-- 장르 배열은 외래키를 못 걸어서 있는 장르만, 겹치지 않게, 3개까지
create or replace function public.check_genre_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.genre_ids is not null and (
       cardinality(new.genre_ids) > 3
       or cardinality(new.genre_ids) <> (select count(distinct g) from unnest(new.genre_ids) g)
       or exists (select 1 from unnest(new.genre_ids) g where not exists (select 1 from public.genres x where x.id = g))) then
    raise exception 'bad_genres';
  end if;
  return new;
end $$;
revoke execute on function public.check_genre_ids() from public, anon, authenticated;
create trigger concerts_genre_ids before insert or update of genre_ids on public.concerts for each row execute function public.check_genre_ids();
create trigger contributions_genre_ids before insert or update of genre_ids on public.contributions for each row execute function public.check_genre_ids();

-- 같은 장르 조합인지 (순서 무시)
create or replace function public.same_genres(a smallint[], b smallint[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((select array_agg(distinct x order by x) from unnest(a) x), '{}')
       = coalesce((select array_agg(distinct x order by x) from unnest(b) x), '{}')
$$;

-- ─────────── 닉네임 표시 ───────────
create or replace function public.contrib_show_nick(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.agreed from public.consents c where c.user_id = uid and c.item = 'contribution_nickname'
                    order by c.created_at desc limit 1), false)
$$;

drop function public.agree_contribution(text);
create or replace function public.agree_contribution(ver text, show_nick boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if coalesce(btrim(ver), '') = '' then raise exception 'bad_request'; end if;
  if (select is_guest from public.profiles where id = me) then raise exception 'members_only'; end if;
  insert into public.consents (user_id, item, version, agreed)
  values (me, 'contribution', ver, true), (me, 'contribution_nickname', ver, coalesce(show_nick, false));
end $$;

-- 닉네임 표시 켜기·끄기 (이미 공개된 정보에도 바로 적용된다)
create or replace function public.set_contrib_nickname(ver text, show_nick boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if coalesce(btrim(ver), '') = '' or show_nick is null then raise exception 'bad_request'; end if;
  if not public.contrib_agreed(me) then raise exception 'contrib_consent'; end if;
  insert into public.consents (user_id, item, version, agreed) values (me, 'contribution_nickname', ver, show_nick);
end $$;

-- ─────────── 함수 다시 만들기 (장르 배열·닉네임 선택) ───────────
drop function public.submit_contribution(uuid, text, timestamptz, smallint, text, text, text, text);
create or replace function public.submit_contribution(
  concert uuid, kind text, open_at timestamptz default null, genres smallint[] default null,
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
    if coalesce(cardinality(genres), 0) not between 1 and 3
       or exists (select 1 from unnest(genres) g where not exists (select 1 from public.genres x where x.id = g and x.is_active)) then
      raise exception 'bad_genres';
    end if;
    if public.same_genres(c.genre_ids, genres) then raise exception 'contrib_same'; end if;
  elsif kind = 'info' then
    if category not in ('artist', 'rules', 'tips') then raise exception 'bad_request'; end if;
    if t is null or char_length(t) > 40 or b is null or char_length(b) < 10 or char_length(b) > 1000 then raise exception 'contrib_bad_text'; end if;
    if public.blocked_word(t) is not null or public.blocked_word(b) is not null then raise exception 'blocked_word'; end if;
  else
    raise exception 'bad_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('contrib:' || me, 0));
  if (select count(*) from public.contributions x where x.user_id = me and x.created_at > now() - interval '1 day')
     >= public.setting_int('contrib_daily_max') then
    raise exception 'daily_limit';
  end if;

  insert into public.contributions (concert_id, user_id, kind, open_at, genre_ids, category, title, body, source_url)
  values (concert, me, kind,
          case when kind = 'ticket_open' then open_at end,
          case when kind = 'genre' then (select array_agg(distinct g order by g) from unnest(genres) g) end,
          case when kind = 'info' then category end,
          case when kind = 'info' then t end,
          case when kind = 'info' then b end,
          u);
exception when unique_violation then raise exception 'tip_exists';
end $$;

drop function public.my_contributions();
create or replace function public.my_contributions()
returns table (id uuid, concert_id uuid, concert_title text, kind text, open_at timestamptz, genre_ids smallint[],
               category text, title text, body text, status text, reject_reason text, points int,
               created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id, x.concert_id, c.title, x.kind, x.open_at, x.genre_ids, x.category, x.title, x.body,
         x.status, x.reject_reason, x.points, x.created_at, x.resolved_at
    from public.contributions x join public.concerts c on c.id = x.concert_id
   where x.user_id = auth.uid()
   order by x.created_at desc
   limit 200
$$;

create or replace function public.concert_extra(concert uuid)
returns table (id uuid, kind text, category text, title text, body text, nickname text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with c as (select * from public.concerts where id = concert and status = 'published')
  select i.id, 'info', i.category, i.title, i.body, case when public.contrib_show_nick(w.id) then w.nickname end, i.created_at
    from public.concert_infos i join c on c.id = i.concert_id left join public.profiles w on w.id = i.author_id
   where not i.hidden
  union all
  select * from (
    select distinct on (x.kind) x.id, x.kind, null::text, null::text, null::text,
           case when public.contrib_show_nick(w.id) then w.nickname end, x.resolved_at
      from public.contributions x join c on c.id = x.concert_id left join public.profiles w on w.id = x.user_id
     where x.status = 'approved' and x.kind in ('ticket_open', 'genre')
       -- 운영자가 나중에 값을 직접 바꿨다면 그 제보자는 표시하지 않는다
       and (x.kind = 'ticket_open' and x.open_at = c.ticket_open_at or x.kind = 'genre' and public.same_genres(x.genre_ids, c.genre_ids))
     order by x.kind, x.resolved_at desc
  ) s
  order by 7 desc
$$;

drop function public.admin_contributions(text);
create or replace function public.admin_contributions(tab text)
returns table (id uuid, concert_id uuid, concert_title text, artists text, kind text,
               current_open_at timestamptz, current_genre_ids smallint[],
               open_at timestamptz, genre_ids smallint[], category text, title text, body text, source_url text,
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
         x.kind, c.ticket_open_at, c.genre_ids,
         x.open_at, x.genre_ids, x.category, x.title, x.body, x.source_url,
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
    update public.concerts set genre_ids = x.genre_ids, updated_at = now() where id = x.concert_id returning title into ctitle;
    pts := public.setting_int('point_genre'); what := '장르';
  else
    pts := coalesce(award, public.setting_int('point_info_default'));
    if pts < 0 or pts > public.setting_int('point_info_max') then raise exception 'bad_points'; end if;
    insert into public.concert_infos (concert_id, category, title, body, author_id, contribution_id)
      values (x.concert_id, x.category, x.title, x.body, x.user_id, x.id);
    select title into ctitle from public.concerts where id = x.concert_id;
    what := '공연 정보';
  end if;

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

revoke execute on function public.contrib_show_nick(uuid), public.same_genres(smallint[], smallint[]),
  public.agree_contribution(text, boolean), public.set_contrib_nickname(text, boolean),
  public.submit_contribution(uuid, text, timestamptz, smallint[], text, text, text, text),
  public.my_contributions(), public.concert_extra(uuid), public.admin_contributions(text)
  from public, anon, authenticated;
grant execute on function public.agree_contribution(text, boolean), public.set_contrib_nickname(text, boolean),
  public.submit_contribution(uuid, text, timestamptz, smallint[], text, text, text, text),
  public.my_contributions(), public.concert_extra(uuid), public.admin_contributions(text)
  to authenticated;
