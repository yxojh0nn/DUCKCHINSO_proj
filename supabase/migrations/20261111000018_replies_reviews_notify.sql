-- 대댓글 · 공연 후기 · 알림 종류별 설정 (2026-11-11)

-- 대댓글: 한 단계만. parent_id = 원 댓글(답글에 다시 답하면 같은 원 댓글 아래로 붙인다), reply_to = 누구에게 단 답글인지
alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade,
  add column reply_to uuid references public.profiles (id) on delete set null;
create index comments_parent_idx on public.comments (parent_id);

create or replace function public.comment_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p_post uuid; p_parent uuid;
begin
  if new.parent_id is null then new.reply_to := null; return new; end if;
  select c.post_id, c.parent_id into p_post, p_parent from public.comments c where c.id = new.parent_id;
  if p_post is null or p_post <> new.post_id then raise exception 'bad_request'; end if;
  if p_parent is not null then new.parent_id := p_parent; end if; -- 답글의 답글 → 원 댓글 아래로
  return new;
end $$;
create trigger comments_thread before insert on public.comments for each row execute function public.comment_thread();

-- 알림 종류별 켜고 끄기 (서비스 알림 notify_enabled 가 켜져 있을 때만 의미가 있다). 발송은 푸시 서버(send-push)가 이 값을 본다
alter table public.profiles
  add column notify_friend boolean not null default true,   -- 덕친 요청·수락
  add column notify_like boolean not null default true,     -- 내 글·후기 추천
  add column notify_comment boolean not null default true,  -- 내 글·후기의 댓글, 내 댓글의 답글
  add column notify_concert boolean not null default true;  -- 관심 아티스트 새 공연, 관심 공연 예매 오픈 전날·공연 전날
grant update (notify_friend, notify_like, notify_comment, notify_concert) on public.profiles to authenticated;
