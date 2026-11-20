-- 네이버·카카오 로그인 토큰 전달을 기기에 묶는다 (보안 감사 #1, docs/보안감사_보완_설계.md 1-3)
--   예전: 돌아가는 주소의 #token_hash 로 바로 로그인 → 같은 스킴을 등록한 다른 앱이 가로채면 그대로 로그인됐다
--   지금: 주소에는 교환 코드만 싣고, 로그인을 시작한 기기만 가진 verifier 를 내야 token_hash 를 준다 (PKCE 와 같은 원리)
--   한 번 쓴 코드를 또 쓰거나 verifier 가 틀리면 누군가 코드를 손에 넣은 것 → 그 계정의 모든 세션을 끊는다
create table public.social_handoff (
  code_hash  text primary key,             -- sha256(교환 코드). 코드 원문은 저장하지 않는다
  challenge  text not null,                -- base64url(sha256(verifier))
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text,                         -- 꺼내 가면 null
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index social_handoff_user_id_idx on public.social_handoff (user_id); -- 탈퇴 cascade 용
alter table public.social_handoff enable row level security; -- 정책 없음: 서버 키만 쓴다
revoke all on public.social_handoff from anon, authenticated;

-- 교환: 'ok' + token_hash / 'expired' / 'reused'(공격 신호, user_id 를 돌려줘 함수가 세션을 끊는다)
create function public.take_social_handoff(p_code_hash text, p_challenge text)
returns table (result text, user_id uuid, token_hash text)
language plpgsql security definer set search_path = '' as $$
declare r public.social_handoff;
begin
  delete from public.social_handoff h where h.expires_at < now() - interval '1 day'; -- 재사용 탐지를 위해 하루는 남긴다
  select * into r from public.social_handoff h where h.code_hash = p_code_hash for update;
  if not found then
    return query select 'expired'::text, null::uuid, null::text; return;
  end if;
  if r.used_at is not null or r.challenge <> p_challenge then
    update public.social_handoff h set used_at = coalesce(h.used_at, now()), token_hash = null where h.code_hash = p_code_hash;
    return query select 'reused'::text, r.user_id, null::text; return;
  end if;
  if r.expires_at < now() then
    return query select 'expired'::text, null::uuid, null::text; return;
  end if;
  update public.social_handoff h set used_at = now(), token_hash = null where h.code_hash = p_code_hash;
  return query select 'ok'::text, r.user_id, r.token_hash;
end $$;
revoke execute on function public.take_social_handoff(text, text) from public, anon, authenticated;
grant execute on function public.take_social_handoff(text, text) to service_role;
