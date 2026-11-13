-- FK 쪽 인덱스 (2026-11-13): Postgres 는 FK 컬럼 인덱스를 자동으로 만들지 않는다
-- 없으면 부모 삭제(회원 탈퇴·비회원 정리·공연 보관기간 삭제) 때마다 자식 표 전체를 훑는다 → 행이 늘면 cron·탈퇴가 느려지고 타임아웃
-- Supabase 마이그레이션은 트랜잭션이라 CONCURRENTLY 를 못 쓴다. 표가 작은 지금 넣는다 (잠금은 몇 초 이내)
-- 새 FK 를 만들면 인덱스도 같이: schema.test.mjs 가 FK 첫 컬럼으로 시작하는 인덱스가 없는 FK 를 잡는다
create index if not exists blocks_blocked_idx            on public.blocks (blocked);
create index if not exists comments_reply_to_idx         on public.comments (reply_to);
create index if not exists concert_artists_artist_idx    on public.concert_artists (artist_id);
create index if not exists concerts_genre_idx            on public.concerts (genre_id);
create index if not exists favorites_concert_idx         on public.favorites (concert_id);
create index if not exists friend_requests_from_idx      on public.friend_requests (from_user);
create index if not exists friendships_room_idx          on public.friendships (room_id);
create index if not exists friendships_user_b_idx        on public.friendships (user_b);
create index if not exists inquiries_user_idx            on public.inquiries (user_id, created_at desc);
create index if not exists messages_sender_idx           on public.messages (sender_id);
create index if not exists post_likes_user_idx           on public.post_likes (user_id);
create index if not exists posts_concert_idx             on public.posts (concert_id);
create index if not exists reports_comment_idx           on public.reports (comment_id);
create index if not exists reports_message_idx           on public.reports (message_id);
create index if not exists reports_post_idx              on public.reports (post_id);
create index if not exists reports_reporter_idx          on public.reports (reporter);
create index if not exists reports_resolved_by_idx       on public.reports (resolved_by);
create index if not exists reports_target_idx            on public.reports (target_user);
create index if not exists sanctions_user_idx            on public.sanctions (user_id);
create index if not exists ticket_open_tips_concert_idx  on public.ticket_open_tips (concert_id);
create index if not exists ticket_open_tips_resolver_idx on public.ticket_open_tips (resolved_by);
create index if not exists ticket_open_tips_user_idx     on public.ticket_open_tips (user_id);
create index if not exists user_artists_artist_idx       on public.user_artists (artist_id);
create index if not exists user_genres_genre_idx         on public.user_genres (genre_id);
