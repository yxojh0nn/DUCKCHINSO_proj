-- 비회원은 닉네임·프로필 사진·배너를 바꿀 수 없다 (2026-11-11 결정)
--   닉네임은 가입 때 받은 '익명의 팬0000' 고정. 소개글은 그대로 쓸 수 있다.
--   사진 업로드는 마이그 21 에서 막았지만 avatar_url·banner_url 칸에 외부 이미지 주소를 직접 넣는 길이 남아 있어 함께 막는다.
--   본인이 스스로 바꿀 때만 거절한다 (운영자가 SQL 로 닉네임을 정리하는 것은 그대로 된다)
create or replace function public.guest_profile_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_guest and new.id = auth.uid()
     and (new.nickname is distinct from old.nickname
          or new.avatar_url is distinct from old.avatar_url
          or new.banner_url is distinct from old.banner_url) then
    raise exception 'members_only';
  end if;
  return new;
end $$;
create trigger profiles_guest_lock before update on public.profiles
  for each row execute function public.guest_profile_lock();
