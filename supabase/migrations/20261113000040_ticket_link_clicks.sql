-- 예매 링크 클릭 기록 (2026-11-13) — 예매처 제휴 협의 때 보여 줄 송객 실적. 운영자만 본다
--   예매처 이름은 클릭 시점 값으로 남긴다(링크가 바뀌거나 공연이 보관 기간으로 지워져도 예매처별 합계는 유지)
--   user_id 는 중복 클릭 거르기와 순 사용자 수 세기에만 쓴다. 탈퇴하면 연결만 끊긴다

create table public.ticket_link_clicks (
  id bigint generated always as identity primary key,
  concert_id uuid references public.concerts (id) on delete set null,
  vendor text not null,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ticket_link_clicks_concert_idx on public.ticket_link_clicks (concert_id);
create index ticket_link_clicks_user_idx on public.ticket_link_clicks (user_id, created_at desc);
create index ticket_link_clicks_created_idx on public.ticket_link_clicks (created_at desc);
alter table public.ticket_link_clicks enable row level security;
revoke all on public.ticket_link_clicks from anon, authenticated;
-- shortcut: 보관 기한 없이 쌓인다. 행이 수십만을 넘거나 개인정보처리방침에 보관 기간을 적을 때 run_maintenance 에 정리 추가

-- 기록: 로그인한 누구나(비회원 포함). 그 공연에 실제 있는 링크만, 같은 사람·같은 링크는 10분에 한 번만 센다
create or replace function public.log_ticket_click(concert uuid, link_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_uid();
  v text;
begin
  select l.vendor into v from public.ticket_links l where l.concert_id = concert and l.url = link_url;
  if v is null then return; end if; -- 없는 링크는 조용히 무시 (기록 실패가 예매 이동을 막으면 안 된다)
  if exists (select 1 from public.ticket_link_clicks c
              where c.user_id = me and c.concert_id = concert and c.vendor = v and c.created_at > now() - interval '10 minutes') then
    return;
  end if;
  insert into public.ticket_link_clicks (concert_id, vendor, user_id) values (concert, v, me);
end $$;

-- 운영자: 최근 N일 공연·예매처별 클릭 수와 순 사용자 수
create or replace function public.admin_ticket_clicks(days int)
returns table (concert_id uuid, concert_title text, vendor text, clicks bigint, users bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select c.concert_id, co.title, c.vendor, count(*), count(distinct c.user_id)
    from public.ticket_link_clicks c
    left join public.concerts co on co.id = c.concert_id
   where c.created_at > now() - make_interval(days => greatest(1, least(days, 3650)))
   group by c.concert_id, co.title, c.vendor
   order by count(*) desc;
end $$;

revoke execute on function public.log_ticket_click(uuid, text), public.admin_ticket_clicks(int) from public, anon;
grant execute on function public.log_ticket_click(uuid, text), public.admin_ticket_clicks(int) to authenticated;
