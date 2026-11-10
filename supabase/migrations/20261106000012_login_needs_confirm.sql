-- 이제 아이디를 메일 인증 전(가입 화면)에 저장한다. 인증 전 계정이 아이디로 로그인되면
-- 남의 이메일로 가입한 사람이 일회용 토큰을 받아 그 이메일을 인증 처리할 수 있으므로 인증된 계정만 통과시킨다
create or replace function public.check_login(p_id_hmac text, p_password text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u record;
begin
  select a.id, a.encrypted_password into u
    from public.login_ids l join auth.users a on a.id = l.user_id
   where l.id_hmac = p_id_hmac and a.email_confirmed_at is not null;
  if u.id is null or coalesce(u.encrypted_password, '') = '' then
    perform extensions.crypt(p_password, '$2a$10$abcdefghijklmnopqrstuu');
    return null;
  end if;
  return case when u.encrypted_password = extensions.crypt(p_password, u.encrypted_password) then u.id end;
end $$;
