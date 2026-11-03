-- 정기 작업: 요청 만료, 오래된 공연 정리, 장기 미접속 비회원 정리, 외부 데이터 수집 호출
-- 수집 함수 호출에는 Vault 에 저장한 프로젝트 URL·service role 키가 필요하다 (docs/배포_가이드.md 3장)

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'expired' where status = 'pending' and expires_at <= now();

  -- 공연은 마지막 회차로부터 보관 기간이 지나면 삭제 (관심 공연·후기 연결은 cascade / set null)
  delete from public.concerts
   where last_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');

  -- 장기 미접속 비회원: auth.users 삭제 → 모든 개인 데이터 cascade 삭제
  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;

select cron.schedule('duckchinso-maintenance', '10 3 * * *', 'select public.run_maintenance()');

-- 매일 04:00 KST(19:00 UTC) 공연 수집, 매주 월요일 아티스트 수집
select cron.schedule('duckchinso-sync-concerts', '0 19 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-concerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$);

select cron.schedule('duckchinso-sync-artists', '30 18 * * 1', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-artists',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$);
