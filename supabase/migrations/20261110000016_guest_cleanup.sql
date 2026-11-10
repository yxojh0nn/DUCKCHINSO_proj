-- 비회원(익명) 계정: 나가면 지운다 (2026-11-10 결정)
--   로그아웃 = 즉시 삭제 (delete-account 함수)
--   그냥 닫고 나간 경우 = 마지막 접속 후 guest_inactive_delete_minutes(기본 60분) 지나면 매시 정기 작업이 삭제
--   보고 있는 동안은 앱이 10분마다 최근 접속(last_seen_at)을 갱신한다. 익명 닉네임 '익명의 팬0000'은 그대로
insert into public.app_settings (key, value) values ('guest_inactive_delete_minutes', '60')
on conflict (key) do nothing;

create or replace function public.cleanup_guests() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  -- shortcut: 비회원이 올린 public-media 파일은 남는다 (run_maintenance 와 같은 한계). 비회원 사진 업로드가 늘면 함수로 정리
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(mins => public.setting_int('guest_inactive_delete_minutes')));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.cleanup_guests() from public, anon, authenticated;

-- 매시 5분에 실행 (pg_cron 이 있는 서버에서만. 테스트 DB 에는 없다)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('duckchinso-guest-cleanup', '5 * * * *', 'select public.cleanup_guests()');
  end if;
end $$;
