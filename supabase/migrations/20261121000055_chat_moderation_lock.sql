-- 채팅 운영 조치 우회 막기 (2026-11-20 보안 점검, 외부 기여 PR #21 changhwan-exe — 번호 50 충돌로 55 로 옮김)
-- 1) 운영자가 신고 처리로 가린 메시지를 보낸 사람이 edit_my_message 로 다시 고칠 수 있었다
--    (가린 뒤에도 kind='text'·deleted_at=null 이라 수정 조건을 그대로 통과). 가린 시각을 남기고 수정을 막는다
-- 2) 금칙어 트리거는 kind='text' 만 본다. kind='image' 에 body 를 같이 넣으면 가리지 않은 채 저장되고,
--    사진 주소를 못 만들면 앱(Bubble.tsx)이 body 를 글로 보여 줬다. 앱은 사진·GIF 에 body 를 보내지 않으므로 비워 두게 한다

-- ─────────── 1) 운영자가 가린 메시지는 잠근다 ───────────
-- 클라이언트 insert 권한은 열 단위(마이그 49)라 이 칸은 앱이 정할 수 없다
alter table public.messages add column moderated_at timestamptz;

-- 이미 가린 메시지도 잠근다 (운영자 함수가 넣는 문구 그대로인 사용자 메시지)
update public.messages set moderated_at = now()
 where sender_id is not null and deleted_at is null and kind = 'text' and body = '운영정책에 따라 가려진 메시지예요.';

create or replace function public.admin_resolve_report(r uuid, resolution text, hide_content boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_admin(); rep public.reports;
begin
  if resolution not in ('resolved', 'dismissed') then raise exception 'bad_request'; end if;
  select * into rep from public.reports where id = r for update;
  if not found then raise exception 'not_found'; end if;
  if rep.status <> 'open' then raise exception 'bad_request'; end if;

  -- 먼저 신고를 닫는다: 댓글을 지우면 reports.comment_id 가 null 이 되어 같은 댓글의 다른 신고를 못 찾는다
  update public.reports set status = resolution, resolved_at = now(), resolved_by = me
   where id = r
      or (status = 'open' and ((rep.post_id is not null and post_id = rep.post_id)
                            or (rep.comment_id is not null and comment_id = rep.comment_id)
                            or (rep.message_id is not null and message_id = rep.message_id)));

  if hide_content and resolution = 'resolved' then
    if rep.post_id is not null then update public.posts set status = 'hidden' where id = rep.post_id; end if;
    if rep.comment_id is not null then delete from public.comments where id = rep.comment_id; end if;
    if rep.message_id is not null then
      -- 가리기 전 원문은 남긴다 (사진이면 경로). 금칙어로 이미 원문이 있으면 그대로
      insert into public.message_originals (message_id, body)
      select m.id, case when m.kind = 'image' then '[사진] ' || coalesce(m.image_path, '') else m.body end
        from public.messages m where m.id = rep.message_id
      on conflict (message_id) do nothing;
      update public.messages
         set kind = 'text', body = '운영정책에 따라 가려진 메시지예요.', image_path = null, gif_slug = null, moderated_at = now()
       where id = rep.message_id;
    end if;
  end if;
end $$;

-- 보낸 사람 수정: 운영자가 가린 메시지는 not_found (마이그 37 과 같고 moderated_at 조건만 더함)
create or replace function public.edit_my_message(m uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b text := btrim(new_body); msg public.messages;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(b) not between 1 and 2000 then raise exception 'bad_body'; end if;
  select * into msg from public.messages
   where id = m and sender_id = me and kind = 'text' and deleted_at is null and moderated_at is null
     and public.can_send(room_id) for update;
  if not found then raise exception 'not_found'; end if;
  -- 처음 원문(금칙어로 가려졌다면 가리기 전 원문)은 그대로 두고 고친 내용을 뒤에 붙인다: 신고 처리 때 바꿔치기를 알 수 있게
  insert into public.message_originals (message_id, body) values (m, msg.body) on conflict (message_id) do nothing;
  update public.message_originals set body = body || E'\n[수정] ' || b where message_id = m;
  update public.messages set body = public.mask_text(b), edited_at = now() where id = m;
end $$;

-- 실행 권한은 create or replace 가 그대로 둔다 (마이그 7·37 의 grant 유지)

-- ─────────── 2) 사진·GIF 메시지에는 글을 싣지 않는다 ───────────
-- 이미 들어간 글은 원문 기록으로 옮기고 비운다
insert into public.message_originals (message_id, body)
select id, body from public.messages where kind = 'image' and body <> ''
on conflict (message_id) do nothing;
update public.messages set body = '' where kind = 'image' and body <> '';
alter table public.messages add constraint messages_image_no_body check (kind <> 'image' or body = '');
