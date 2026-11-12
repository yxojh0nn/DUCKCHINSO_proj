-- 공지 업로드 예약 (2026-11-12): 운영자가 정한 시각(starts_at)에 공지가 열린다
--   예약 공지는 live = false 로 운영자에게만 보이고, 1분마다 도는 publish_due_notices 가 시각이 되면 live 로 바꾼다.
--   live 로 바뀌는 UPDATE 가 실시간으로 앱에 닿아 그때 접속 중인 사람에게도 팝업이 뜬다 (INSERT 때는 RLS 로 가려져 안 닿는다)

alter table public.notices
  add column starts_at timestamptz not null default now(),
  add column live boolean not null default true;
update public.notices set starts_at = created_at;
drop index public.notices_created_idx;
create index notices_starts_idx on public.notices (starts_at desc);

drop policy "notices read" on public.notices;
create policy "notices read" on public.notices for select to authenticated using (live or public.is_admin());

drop function public.admin_post_notice(text, text, timestamptz);
create function public.admin_post_notice(title text, body text, ends_at timestamptz default null, starts_at timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin();
  st timestamptz := greatest(coalesce(starts_at, now()), now());
  nid uuid;
begin
  if starts_at > now() + interval '1 year' then raise exception 'notice_bad_schedule'; end if;
  if ends_at is not null and ends_at <= st then raise exception 'notice_bad_period'; end if;
  insert into public.notices (title, body, author_id, ends_at, starts_at, live)
  values (btrim(title), btrim(body), me, ends_at, st, st <= now()) returning id into nid;
  return nid;
end $$;
revoke execute on function public.admin_post_notice(text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_post_notice(text, text, timestamptz, timestamptz) to authenticated;

-- 예약 시각이 된 공지를 연다 (pg_cron 전용)
create or replace function public.publish_due_notices() returns void
language sql security definer set search_path = '' as $$
  update public.notices set live = true where not live and starts_at <= now();
$$;
revoke execute on function public.publish_due_notices() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('duckchinso-publish-notices', '* * * * *', 'select public.publish_due_notices()');
  end if;
end $$;
