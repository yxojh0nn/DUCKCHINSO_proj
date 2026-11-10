-- 공연 수집을 한 번에 목록 3쪽(300건)씩 세 번에 나눠 부른다 (sync-concerts ?from=)
-- 한 번에 700건을 받으면 KOPIS 연속 요청 차단과 재시도 때문에 Edge Function 실행 한도(150초)를 넘었다 (2026-11-04)
-- 04:00 / 04:10 / 04:20 KST. 3쪽 × 3번 = 900건까지. 대중음악 공연이 900건을 넘으면 한 번 더 추가한다

select cron.unschedule('duckchinso-sync-concerts');

select cron.schedule('duckchinso-sync-concerts-' || part, mins || ' 19 * * *', format($job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-concerts?from=%s',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$job$, start_page))
from (values (1, 0, 1), (2, 10, 4), (3, 20, 7)) as t(part, mins, start_page);
