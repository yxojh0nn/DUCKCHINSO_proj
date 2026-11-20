-- 비밀번호 변경 전 현재 비밀번호 확인 (2026-11-20, 계정 보안 보강 3)
-- 세션만 훔친 사람이 비밀번호를 바꿔 주인을 내쫓지 못하게, 서버 함수 login-id(change_password)가 이것으로 먼저 확인한다
-- check_login(마이그 12)과 같은 bcrypt 비교. 비밀번호가 없는 계정(소셜·익명)은 false
create or replace function public.check_password(p_uid uuid, p_password text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  h text;
begin
  select encrypted_password into h from auth.users where id = p_uid;
  if coalesce(h, '') = '' then
    perform extensions.crypt(p_password, '$2a$10$abcdefghijklmnopqrstuu'); -- 없는 계정도 같은 시간이 걸리게
    return false;
  end if;
  return h = extensions.crypt(p_password, h);
end $$;
revoke execute on function public.check_password(uuid, text) from public, anon, authenticated;
grant execute on function public.check_password(uuid, text) to service_role;
