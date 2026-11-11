-- 비밀번호 찾기로 비밀번호를 바꾸면 그 계정의 모든 로그인(세션·갱신 토큰)을 끊는다 (2026-11-11)
--   auth.refresh_tokens 는 session 이 지워지면 함께 지워진다. 서버 키(login-id 함수)만 부를 수 있다
create or replace function public.revoke_user_sessions(p_uid uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_uid
$$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
