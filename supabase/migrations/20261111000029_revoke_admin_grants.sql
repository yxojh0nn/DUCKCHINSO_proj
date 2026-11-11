-- 보안 점검 3단계-2 (2026-11-11) — L1: 앱이 직접 쓸 일이 없는 표는 표 권한 자체를 없앤다
--   RLS 정책이 실수로 열려도(using (true) 등) 42501 permission denied 에서 멈추게 하는 두 번째 방어선.
--   옛 앱의 운영자 화면은 표에 직접 쓰므로, 이 마이그레이션 적용 직후 마이그 28 함수를 쓰는 앱을 바로 배포한다
--   (그 사이 운영자 화면 일부만 실패, 일반 사용자 기능은 여기서 회수하는 권한을 쓰지 않는다).
--   읽기(SELECT)가 필요한 공개 표는 그대로 둔다. 운영자 쓰기는 모두 security definer 함수(마이그 7·14·15·17·28)로만.

-- 공연·아티스트: 누구나 읽고, 쓰기는 운영자 함수와 수집 함수(service_role)만
revoke insert, update, delete, truncate on public.artists, public.concerts, public.concert_artists,
  public.concert_schedules, public.ticket_links from authenticated, anon;

-- 운영자 전용 표: 앱에서는 읽기도 없음 (admin_words·admin_search_inbox 함수로)
revoke all on public.banned_words, public.allowed_words, public.jpop_promoters, public.kopis_inbox from authenticated, anon;

-- 신고·문의: 사용자는 넣기만 한다. 목록·처리는 운영자 함수(admin_reports·admin_inquiries 등)로
revoke select, update, delete, truncate on public.reports, public.inquiries from authenticated, anon;

-- 제재: 앱 직접 사용 없음 (admin_sanction·admin_user_sanctions 함수로)
revoke all on public.sanctions from authenticated, anon;

-- 글: 수정은 edit_post(작성자), 숨김·삭제는 운영자 함수로만. 직접 UPDATE 권한 회수
revoke update on public.posts from authenticated, anon;
