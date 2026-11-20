-- 닉네임 중복 기준 강화 (2026-11-19): 대소문자만이 아니라 공백·_·.·- 차이도 같은 닉네임으로 본다
--   '덕친 소' = '덕친소' = '덕_친.소' = 'Duck-Fan' / 'duckfan'. 원래 표기는 그대로 저장하고 비교만 이 값으로
--   적용 전 확인: 운영 DB 에 이 기준으로 겹치는 닉네임 없음 (2026-11-19)

create or replace function public.nickname_key(n text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(regexp_replace(n, '[[:space:]_.-]', '', 'g'))
$$;

drop index public.profiles_nickname_key;
create unique index profiles_nickname_key on public.profiles (public.nickname_key(nickname));

-- 앞뒤 공백·연속 공백·글자 없는 닉네임('__' 등) 금지. 앱은 이미 앞뒤를 자르므로 새로 쓰는 값부터 (기존 행은 그대로)
alter table public.profiles add constraint profiles_nickname_shape
  check (nickname = btrim(nickname) and nickname !~ '  ' and public.nickname_key(nickname) <> '') not valid;

-- 가입 때 자동 닉네임도 같은 기준으로 겹침을 본다 (마이그 11 과 나머지는 같다)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text := case when new.is_anonymous then '익명의 팬' else '덕친' end;
  nick text;
  tries int := 0;
begin
  loop
    nick := base || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where public.nickname_key(nickname) = public.nickname_key(nick));
    tries := tries + 1;
    if tries > 20 then nick := base || substr(replace(new.id::text, '-', ''), 1, 6); exit; end if;
  end loop;
  insert into public.profiles (id, nickname, is_guest) values (new.id, nick, coalesce(new.is_anonymous, false));
  return new;
end $$;

-- 저장 전에 미리 보기: 나 말고 같은(비슷한) 닉네임이 있으면 false. 닉네임은 원래 공개라 따로 감출 것이 없다
create or replace function public.nickname_available(n text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not exists (select 1 from public.profiles p where public.nickname_key(p.nickname) = public.nickname_key(n) and p.id <> auth.uid())
$$;
revoke execute on function public.nickname_available(text) from public, anon;
grant execute on function public.nickname_available(text) to authenticated;
