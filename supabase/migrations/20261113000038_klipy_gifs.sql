-- KLIPY GIF (2026-11-13): 채팅 GIF 는 KLIPY 가 준 미디어 주소를 그대로 보낸다
-- (KLIPY 규칙: 받아서 우리 저장소에 다시 올리거나 사본을 두지 않는다). 회원이 올리던 공용 GIF 모음은 없앤다

-- ─────────── 메시지: KLIPY GIF ───────────
-- gif_slug = KLIPY 콘텐츠 id. 받은 사람이 신고할 때 KLIPY 신고 API 에 넘긴다
-- 사진 칸(image_path)은 chat-media 경로 또는 KLIPY 미디어 주소만. 다른 외부 주소(추적 픽셀 등)는 막는다
alter table public.messages add column gif_slug text;
alter table public.messages add constraint messages_image_source check (
  image_path is null
  or (gif_slug is null and image_path !~ '^[A-Za-z][A-Za-z0-9+.-]*:')
  -- gif_slug is not null: 빠지면 NULL 비교가 되어 CHECK 를 그냥 통과한다
  or (gif_slug is not null and gif_slug ~ '^[A-Za-z0-9_-]{1,200}$' and image_path ~ '^https://static[12]?\.klipy\.com/[^[:space:]]+$')
);

-- ─────────── 공용 GIF 모음 폐지 ───────────
-- public-media/{user_id}/gifs/ 에 올라간 파일은 SQL 로 지울 수 없어(Storage API 전용) 남는다. 필요하면 대시보드에서 지운다
drop function public.submit_gif(text);
drop function public.admin_resolve_gif(uuid, boolean);
drop table public.gifs;
