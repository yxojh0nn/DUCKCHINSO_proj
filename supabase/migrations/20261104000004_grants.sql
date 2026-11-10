-- 테이블 권한 (2026-11 이후 새 Supabase 프로젝트는 anon·authenticated 에게 표 권한을 자동으로 주지 않는다)
-- RLS 는 "표에 접근할 권한이 있는 역할"의 행을 거르는 것이라, 표 권한이 먼저 있어야 한다.
-- 정책(20261103000002)이 허용하는 동작만 연다. 전체 update 를 주면 profiles 의 열 단위 제한이 풀리므로 표마다 나눠 준다.

-- 비로그인: 공개 데이터 읽기
grant select on public.app_settings, public.genres, public.artists,
  public.concerts, public.concert_schedules, public.concert_artists, public.ticket_links
  to anon;

-- 로그인 사용자 읽기 (어떤 행이 보이는지는 RLS 가 정한다)
grant select on public.app_settings, public.genres, public.artists,
  public.concerts, public.concert_schedules, public.concert_artists, public.ticket_links,
  public.profiles, public.consents, public.push_tokens, public.user_artists, public.user_genres, public.favorites,
  public.blocks, public.friend_requests, public.friendships, public.chat_rooms, public.chat_members, public.messages,
  public.posts, public.post_likes, public.comments, public.reports, public.sanctions, public.inquiries
  to authenticated;

-- 본인 데이터 쓰기
grant insert on public.consents, public.user_artists, public.user_genres, public.favorites,
  public.messages, public.posts, public.comments, public.reports, public.inquiries
  to authenticated;
grant insert, update, delete on public.push_tokens to authenticated;
grant delete on public.user_artists, public.user_genres, public.favorites, public.posts, public.comments to authenticated;
-- profiles 는 20261103000002 에서 열 단위 update 만 준다 (status·is_guest 는 못 바꿈)

-- 운영자 전용 정책이 걸린 표 (is_admin() 이 아니면 RLS 가 막는다)
grant insert, update, delete on public.concerts, public.concert_schedules, public.concert_artists, public.ticket_links,
  public.artists to authenticated;
grant update on public.posts, public.reports to authenticated;
grant delete on public.reports to authenticated;
grant insert on public.sanctions to authenticated;

grant usage on all sequences in schema public to authenticated;

-- Edge Function(service role)은 RLS 를 건너뛰지만 표 권한은 필요하다
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;
