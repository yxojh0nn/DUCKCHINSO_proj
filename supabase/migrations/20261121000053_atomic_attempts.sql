-- 로그인·메일 횟수 제한을 한 번에(원자적으로) 센다 (2026-11-21, 동시 요청 우회 제보)
--   예전: login-id 함수가 ① 횟수를 세고 ② 비밀번호를 확인한 뒤 ③ 실패를 기록했다.
--         같은 순간 요청 N개를 보내면 모두 ①에서 같은 수를 읽어 통과 → 10분 5회 제한이 N회가 됐다.
--   지금: 키마다 잠금을 잡고 세기와 기록을 한 트랜잭션에서 한다. 통과하면 먼저 자리를 잡고(기록), 성공하면 함수가 그 기록을 지운다.
alter table public.login_attempts add column id bigint generated always as identity;

-- p_rules: [{"key": "...", "max": 5, "sec": 600}, ...] — 같은 키에 창이 다른 규칙을 여러 개 둘 수 있다(메일: 1시간 3회 + 하루 5회)
-- 하나라도 넘으면 null(기록 안 함), 모두 통과하면 키마다 한 줄씩 기록하고 그 id 들을 돌려준다
create function public.take_attempts(p_rules jsonb) returns bigint[]
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  r record;
  ids bigint[];
begin
  -- 같은 키를 다루는 동시 요청은 여기서 줄을 선다. 정렬된 순서로 잡아 교착을 막는다
  for k in select distinct x.key from jsonb_to_recordset(p_rules) as x(key text) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('login_attempts:' || k, 0));
  end loop;
  for r in select * from jsonb_to_recordset(p_rules) as x(key text, max int, sec int) loop
    if (select count(*) from public.login_attempts a where a.key = r.key and a.at > now() - make_interval(secs => r.sec)) >= r.max then
      return null;
    end if;
  end loop;
  with ins as (
    insert into public.login_attempts (key)
    select distinct x.key from jsonb_to_recordset(p_rules) as x(key text)
    returning id
  ) select array_agg(id) into ids from ins;
  return ids;
end $$;
revoke execute on function public.take_attempts(jsonb) from public, anon, authenticated;
grant execute on function public.take_attempts(jsonb) to service_role;

-- 인증 코드 입력 횟수도 같은 문제: 예전엔 tries 를 읽고 → 비교하고 → tries+1 을 썼다(동시에 보내면 5번 넘게 맞춰 볼 수 있다)
-- 지금: 비교하기 전에 시도 한 번을 먼저 쓴다. UPDATE 는 행을 잠그고 조건(tries < p_max)을 다시 보므로 동시 요청도 p_max 번까지만 코드를 받는다
create function public.use_code_try(p_key text, p_max int) returns text
language sql security definer set search_path = '' as $$
  update public.email_codes set tries = tries + 1
   where email_hmac = p_key and tries < p_max and expires_at > now()
  returning code_hmac
$$;
revoke execute on function public.use_code_try(text, int) from public, anon, authenticated;
grant execute on function public.use_code_try(text, int) to service_role;
