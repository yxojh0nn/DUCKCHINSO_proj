-- 커뮤니티 '관리자' 표시 (2026-11-12): 글 작성자가 관리자인지 앱이 알 수 있게 관리자 id 목록만 연다
--   admins 표 자체는 계속 닫아 둔다 (마이그 2). id 외 정보는 주지 않는다

create or replace function public.admin_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.admins;
$$;
revoke execute on function public.admin_ids() from public, anon;
grant execute on function public.admin_ids() to authenticated;
