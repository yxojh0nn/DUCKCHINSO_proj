-- 쓰기 권한을 열 단위로 (2026-11-20, 보안 점검 Vuln 1)
-- 표 전체 insert 를 주면 created_at·like_count·status·answer 같은 서버 값까지 클라이언트가 정할 수 있다
--   (미래 시각 글로 피드 고정, 채팅방 안 읽음 고정, 동의 일시 소급, 답변된 문의 위조 등).
-- 앱(supabaseApi.ts)이 실제로 보내는 열만 연다. 열을 새로 추가하면 여기에도 grant 를 함께 적어야 한다 (안 적으면 막힌 채로 남는다).
-- 시스템·운영 메시지는 security definer 함수가, 서버 함수는 service_role 이 넣으므로 영향이 없다.
revoke insert on public.posts, public.comments, public.messages, public.reports,
  public.inquiries, public.consents, public.favorites from authenticated;

grant insert (author_id, title, body, tags, image_urls, concert_id)                   on public.posts     to authenticated;
grant insert (post_id, author_id, body, parent_id, reply_to)                          on public.comments  to authenticated;
grant insert (room_id, sender_id, kind, body, image_path, gif_slug)                   on public.messages  to authenticated;
grant insert (reporter, target_user, post_id, comment_id, message_id, reason, detail) on public.reports   to authenticated;
grant insert (user_id, category, answers, body)                                       on public.inquiries to authenticated;
grant insert (user_id, item, version, agreed)                                         on public.consents  to authenticated;
grant insert (user_id, concert_id)                                                    on public.favorites to authenticated;
