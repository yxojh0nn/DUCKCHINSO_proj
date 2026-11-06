-- 이메일 가입 인증 코드 (docs/로그인_계정_암호화_설계.md 5장). 이메일·코드는 HMAC 으로만 저장한다. 서버 함수만 읽고 쓴다
create table public.email_codes (
  email_hmac text primary key,
  code_hmac text not null,
  expires_at timestamptz not null,
  tries smallint not null default 0
);
alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated;
grant all on public.email_codes to service_role;

-- 이미 가입된 이메일인지. 서비스 키(login-id 함수)만 부른다
create or replace function public.email_registered(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email))
$$;
revoke execute on function public.email_registered(text) from public, anon, authenticated;
grant execute on function public.email_registered(text) to service_role;
