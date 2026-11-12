-- 공지 노출 기간 (2026-11-12): 운영자가 공지를 올릴 때 상단 팝업을 언제까지 띄울지 정한다. null = 제한 없음
-- 기간이 지나도 커뮤니티 공지 탭에는 남는다 (팝업만 멈춘다)

alter table public.notices add column ends_at timestamptz;

drop function public.admin_post_notice(text, text);
create function public.admin_post_notice(title text, body text, ends_at timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_admin(); nid uuid;
begin
  if ends_at is not null and ends_at <= now() then raise exception 'notice_bad_period'; end if;
  insert into public.notices (title, body, author_id, ends_at) values (btrim(title), btrim(body), me, ends_at) returning id into nid;
  return nid;
end $$;

revoke execute on function public.admin_post_notice(text, text, timestamptz) from public, anon;
grant execute on function public.admin_post_notice(text, text, timestamptz) to authenticated;
