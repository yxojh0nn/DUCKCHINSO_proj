-- 예매 오픈일 사용자 제보 + 운영자 전체 사용자 목록 (2026-11-10)
-- 예매처 사이트는 자동 수집하지 않는다(약관·봇 차단). 공식 공지를 본 회원이 날짜와 출처를 제보하고 운영자가 확인해 반영한다

create table public.ticket_open_tips (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  open_at timestamptz not null,
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create index ticket_open_tips_status_idx on public.ticket_open_tips (status, created_at desc);
-- 같은 사람이 같은 공연에 대기 중인 제보는 하나만
create unique index ticket_open_tips_one_pending on public.ticket_open_tips (concert_id, user_id) where status = 'pending';
alter table public.ticket_open_tips enable row level security;
revoke all on public.ticket_open_tips from anon, authenticated;

-- 제보: 회원만(비회원·이용 제한 계정 제외), 하루 10건, 게시된 공연만
create or replace function public.submit_ticket_tip(concert uuid, open_at timestamptz, source_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_uid();
begin
  if (select is_guest from public.profiles where id = me) then raise exception 'members_only'; end if;
  if not exists (select 1 from public.concerts c where c.id = concert and c.status = 'published') then raise exception 'not_found'; end if;
  if open_at < now() - interval '30 days' or open_at > now() + interval '1 year' then raise exception 'tip_bad_date'; end if;
  if coalesce(source_url, '') !~ '^https?://[^\s]+$' or char_length(source_url) > 500 then raise exception 'tip_bad_url'; end if;
  if (select count(*) from public.ticket_open_tips t where t.user_id = me and t.created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily_limit';
  end if;
  insert into public.ticket_open_tips (concert_id, user_id, open_at, source_url) values (concert, me, open_at, btrim(source_url));
exception when unique_violation then raise exception 'tip_exists';
end $$;

-- 운영자: 제보 목록 (대기 전체 + 최근 처리 100건)
create or replace function public.admin_ticket_tips()
returns table (id uuid, concert_id uuid, concert_title text, current_open_at timestamptz, open_at timestamptz, source_url text,
               status text, user_id uuid, nickname text, created_at timestamptz, resolved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select t.id, t.concert_id, c.title, c.ticket_open_at, t.open_at, t.source_url, t.status, t.user_id, p.nickname, t.created_at, t.resolved_at
    from public.ticket_open_tips t
    join public.concerts c on c.id = t.concert_id
    left join public.profiles p on p.id = t.user_id
   where t.status = 'pending'
      or t.id in (select x.id from public.ticket_open_tips x where x.status <> 'pending' order by x.resolved_at desc nulls last limit 100)
   order by (t.status = 'pending') desc, t.created_at desc;
end $$;

-- 운영자: 승인(날짜를 고쳐서 반영할 수 있음) / 거절. 승인하면 같은 공연의 다른 대기 제보도 함께 정리하고 제보자에게 알린다
create or replace function public.admin_resolve_ticket_tip(tip uuid, approve boolean, fixed_open_at timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin();
  t public.ticket_open_tips;
  final_at timestamptz;
  ctitle text;
begin
  select * into t from public.ticket_open_tips where id = tip for update;
  if t.id is null or t.status <> 'pending' then raise exception 'not_found'; end if;
  if not approve then
    update public.ticket_open_tips set status = 'rejected', resolved_at = now(), resolved_by = me where id = tip;
    return;
  end if;
  final_at := coalesce(fixed_open_at, t.open_at);
  update public.concerts set ticket_open_at = final_at, updated_at = now() where id = t.concert_id returning concerts.title into ctitle;
  update public.ticket_open_tips
     set status = case when open_at = final_at then 'approved' else 'rejected' end, resolved_at = now(), resolved_by = me
   where concert_id = t.concert_id and status = 'pending';
  update public.ticket_open_tips set status = 'approved' where id = tip;
  if t.user_id is not null then
    perform public.notify_support(t.user_id, '제보해 주신 예매 오픈일이 반영됐어요. 고마워요! 공연: ' || ctitle);
  end if;
end $$;

-- 운영자: 전체 사용자 (닉네임 검색, 최근 가입순, 쪽 나눔). 이메일 등 개인정보는 돌려주지 않는다
create or replace function public.admin_users(q text default '', lim int default 50, off int default 0)
returns table (id uuid, nickname text, is_guest boolean, status text, is_admin boolean, login text,
               created_at timestamptz, last_seen_at timestamptz, sanctions int, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.nickname, p.is_guest, p.status,
         exists (select 1 from public.admins a where a.user_id = p.id),
         case when p.is_guest then 'guest'
              else coalesce((select e.provider from public.external_ids e where e.user_id = p.id limit 1),
                            (select string_agg(distinct i.provider, ',') from auth.identities i where i.user_id = p.id), 'email') end,
         p.created_at, p.last_seen_at,
         (select count(*)::int from public.sanctions s where s.user_id = p.id),
         count(*) over ()
    from public.profiles p
   where coalesce(btrim(q), '') = '' or p.nickname ilike '%' || btrim(q) || '%'
   order by p.created_at desc
   limit least(greatest(lim, 1), 200) offset greatest(off, 0);
end $$;

-- 운영자: 사용자 요약
create or replace function public.admin_user_stats()
returns table (members bigint, guests bigint, active_7d bigint, suspended bigint, banned bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select count(*) filter (where not p.is_guest), count(*) filter (where p.is_guest),
         count(*) filter (where p.last_seen_at > now() - interval '7 days'),
         count(*) filter (where p.status = 'suspended'), count(*) filter (where p.status = 'banned')
    from public.profiles p;
end $$;

revoke execute on function public.submit_ticket_tip(uuid, timestamptz, text), public.admin_ticket_tips(),
  public.admin_resolve_ticket_tip(uuid, boolean, timestamptz), public.admin_users(text, int, int), public.admin_user_stats()
  from public, anon;
grant execute on function public.submit_ticket_tip(uuid, timestamptz, text), public.admin_ticket_tips(),
  public.admin_resolve_ticket_tip(uuid, boolean, timestamptz), public.admin_users(text, int, int), public.admin_user_stats()
  to authenticated;
