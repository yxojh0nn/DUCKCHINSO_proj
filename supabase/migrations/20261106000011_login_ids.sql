-- 로그인 아이디 · 네이버·카카오 로그인 · 아이디 로그인 실패 횟수 (docs/로그인_계정_암호화_설계.md)
-- 값의 암호화·복호화는 서버 함수(_shared/crypto.ts)만 한다. DB 에는 HMAC(찾기용)과 AES-256-GCM 암호문만 들어간다
-- 표는 RLS 를 켜고 정책을 두지 않으며 anon·authenticated 권한을 뺀다 → 서비스 키(서버 함수)만 읽고 쓴다

-- 이메일 가입자의 로그인 아이디. id_hmac = HMAC(PII_HMAC_KEY, 소문자 아이디), id_enc = "v1:iv:암호문"
create table public.login_ids (
  user_id uuid primary key references auth.users (id) on delete cascade,
  id_hmac text not null unique,
  id_enc text not null,
  created_at timestamptz not null default now()
);

-- 네이버·카카오 회원 식별값. 이메일이 아니라 이 값으로 계정을 찾는다
-- subject_enc: 탈퇴 때 카카오 연결 끊기(Admin 키 + 회원번호)에 원문이 필요해서 암호화해 둔다
create table public.external_ids (
  provider text not null check (provider in ('naver', 'kakao')),
  subject_hmac text not null,
  subject_enc text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, subject_hmac),
  unique (user_id, provider)
);

-- 탈퇴 때 외부 연결을 끊는 데 쓰는 refresh token (네이버 토큰 삭제, 애플 토큰 철회)
create table public.provider_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('apple', 'naver')),
  refresh_enc text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- 아이디 로그인 실패 기록. key = 'id:<아이디 HMAC>' 또는 'ip:<IP HMAC>'
create table public.login_attempts (
  key text not null,
  at timestamptz not null default now()
);
create index login_attempts_key_idx on public.login_attempts (key, at);

alter table public.login_ids enable row level security;
alter table public.external_ids enable row level security;
alter table public.provider_tokens enable row level security;
alter table public.login_attempts enable row level security;
revoke all on public.login_ids, public.external_ids, public.provider_tokens, public.login_attempts from anon, authenticated;
grant all on public.login_ids, public.external_ids, public.provider_tokens, public.login_attempts to service_role;

-- 내 로그인 상태. needs_login_id: 이메일로 가입했는데 아직 아이디를 안 만든 사람 → 아이디 만들기 화면으로
-- 네이버·카카오 계정도 auth 에는 email 신원이 생기므로 external_ids 가 있으면 제외한다
create or replace function public.my_login()
returns table (social text, has_login_id boolean, needs_login_id boolean)
language sql stable security definer set search_path = '' as $$
  select e.provider,
         l.user_id is not null,
         e.provider is null and l.user_id is null
           and exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'email')
    from (select auth.uid() as uid) u
    left join public.external_ids e on e.user_id = u.uid
    left join public.login_ids l on l.user_id = u.uid
   where u.uid is not null
   limit 1
$$;
revoke execute on function public.my_login() from public, anon;
grant execute on function public.my_login() to authenticated;

-- 닉네임 기본값: 이메일 앞부분·실명(구글 name)이 공개 닉네임으로 드러나지 않게 '덕친0000'
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text := case when new.is_anonymous then '익명의 팬' else '덕친' end;
  nick text;
  tries int := 0;
begin
  loop
    nick := base || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where lower(nickname) = lower(nick));
    tries := tries + 1;
    if tries > 20 then nick := base || substr(replace(new.id::text, '-', ''), 1, 6); exit; end if;
  end loop;
  insert into public.profiles (id, nickname, is_guest) values (new.id, nick, coalesce(new.is_anonymous, false));
  return new;
end $$;

-- 정기 작업에 실패 기록 정리(하루 지난 것) 추가. 나머지는 20261105000008_retention 과 같다
create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'expired' where status = 'pending' and expires_at <= now();

  delete from public.concerts
   where last_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');
  delete from public.kopis_inbox
   where end_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');

  update public.profiles p set status = 'active'
   where p.status = 'suspended'
     and not exists (select 1 from public.sanctions s where s.user_id = p.id and s.level = 'suspend' and s.ends_at > now());

  delete from public.reports where status <> 'open' and resolved_at < now() - interval '1 year';
  delete from public.sanctions where level <> 'ban' and coalesce(ends_at, starts_at) < now() - interval '1 year';
  delete from public.inquiries where status = 'answered' and answered_at < now() - interval '1 year';
  delete from public.login_attempts where at < now() - interval '1 day';

  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;

-- 아이디 로그인 확인: 아이디 HMAC + 비밀번호 → 맞으면 사용자 id, 아니면 null. 서비스 키(login-id 함수)만 부른다
-- auth.users 의 bcrypt 해시와 비교만 한다(복호화 없음). 없는 아이디도 bcrypt 를 한 번 돌려 응답 시간으로 존재 여부가 드러나지 않게
create or replace function public.check_login(p_id_hmac text, p_password text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u record;
begin
  select a.id, a.encrypted_password into u
    from public.login_ids l join auth.users a on a.id = l.user_id
   where l.id_hmac = p_id_hmac;
  if u.id is null or coalesce(u.encrypted_password, '') = '' then
    perform extensions.crypt(p_password, '$2a$10$abcdefghijklmnopqrstuu');
    return null;
  end if;
  return case when u.encrypted_password = extensions.crypt(p_password, u.encrypted_password) then u.id end;
end $$;

-- 아이디 찾기: 이메일 → 아이디 암호문. 서버 함수가 복호화해 그 이메일로만 보낸다
create or replace function public.login_id_by_email(p_email text) returns table (user_id uuid, id_enc text)
language sql stable security definer set search_path = '' as $$
  select l.user_id, l.id_enc from auth.users a join public.login_ids l on l.user_id = a.id
   where lower(a.email) = lower(p_email)
$$;
revoke execute on function public.check_login(text, text), public.login_id_by_email(text) from public, anon, authenticated;
grant execute on function public.check_login(text, text), public.login_id_by_email(text) to service_role;
