-- 글·댓글 수정: 본인이 쓴 것만 (2026-11-11 결정)
--   표 직접 UPDATE 는 계속 막는다 (posts UPDATE 정책은 운영자 전용, comments 는 UPDATE 권한 없음).
--   수정은 아래 두 함수로만: 작성자 본인·회원·이용 제한 아님·운영자가 가리지 않은 글일 때.
--   바꿀 수 있는 칸은 제목·내용·태그(글), 내용(댓글)뿐. 작성자·상태·추천 수·공연 연결은 못 바꾼다.
--   금칙어는 기존 before update 트리거(check_banned_words)가 그대로 검사한다.
--   신고 시점 원문은 reports.content_snapshot 에 남으므로 신고 후 고쳐도 증거는 그대로다.
alter table public.posts add column edited_at timestamptz;
alter table public.comments add column edited_at timestamptz;

create or replace function public.require_active_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.require_member();
begin
  if not exists (select 1 from public.profiles where id = me and status = 'active') then raise exception 'account_restricted'; end if;
  return me;
end $$;

create or replace function public.edit_post(p uuid, new_title text, new_body text, new_tags text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_active_member();
begin
  update public.posts set title = new_title, body = new_body, tags = coalesce(new_tags, '{}'), edited_at = now()
   where id = p and author_id = me and status = 'visible';
  if not found then raise exception 'not_found'; end if; -- 남의 글·가려진 글·없는 글을 구분하지 않는다
end $$;

create or replace function public.edit_comment(c uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_active_member();
begin
  update public.comments set body = new_body, edited_at = now()
   where id = c and author_id = me
     and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible');
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function public.require_active_member(), public.edit_post(uuid, text, text, text[]), public.edit_comment(uuid, text) from public, anon;
grant execute on function public.edit_post(uuid, text, text, text[]), public.edit_comment(uuid, text) to authenticated;
