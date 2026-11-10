-- 신고 처리 보완
-- 1) 신고 대상(작성자)을 서버가 신고 시점에 저장한다: 댓글이 지워져도(comment_id 가 null 이 돼도) 작성자를 알 수 있게
-- 2) 같은 내용의 다른 신고는 내용을 지우기 전에 닫는다 (지운 뒤에는 comment_id 가 비어 찾지 못한다)
-- 3) 이미 처리한 신고는 다시 처리할 수 없다
-- 4) 탈퇴로 주인이 없어진 영구 제한 기록도 1년 뒤 지운다 (처리방침의 "1년 보관"과 맞춘다)

create or replace function public.fill_report_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 글·댓글·채팅을 신고하면 대상은 그 작성자다 (클라이언트가 보낸 target_user 는 믿지 않는다). 시스템 메시지는 보낸 사람이 없어 보낸 값을 쓴다
  new.target_user := coalesce(
    (select author_id from public.posts where id = new.post_id),
    (select author_id from public.comments where id = new.comment_id),
    (select sender_id from public.messages where id = new.message_id),
    new.target_user);
  new.content_snapshot := coalesce(
    (select title || E'\n' || body from public.posts where id = new.post_id),
    (select body from public.comments where id = new.comment_id),
    (select coalesce(nullif(body, ''), image_path) from public.messages where id = new.message_id),
    (select nickname || E'\n' || bio from public.profiles where id = new.target_user));
  return new;
end $$;

-- 이미 들어온 신고에도 대상을 채운다 (글·채팅은 아직 남아 있다. 이미 지워진 댓글은 찾을 수 없다)
update public.reports r set target_user = coalesce(
    (select author_id from public.posts where id = r.post_id),
    (select author_id from public.comments where id = r.comment_id),
    (select sender_id from public.messages where id = r.message_id))
 where r.target_user is null and (r.post_id is not null or r.comment_id is not null or r.message_id is not null);

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
      update public.messages set kind = 'text', body = '운영정책에 따라 가려진 메시지예요.', image_path = null where id = rep.message_id;
    end if;
  end if;
end $$;

create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'expired' where status = 'pending' and expires_at <= now();

  delete from public.concerts
   where last_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');
  delete from public.kopis_inbox
   where end_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');

  update public.profiles p set status = 'active'
   where p.status = 'suspended'
     and not exists (select 1 from public.sanctions s where s.user_id = p.id and s.level = 'suspend' and s.ends_at > now());

  delete from public.reports where status <> 'open' and resolved_at < now() - interval '1 year';
  delete from public.sanctions where level <> 'ban' and coalesce(ends_at, starts_at) < now() - interval '1 year';
  -- 영구 제한은 제한을 유지하는 근거라 지우지 않는다. 단, 탈퇴해서 주인이 없어진(user_id null) 기록은 1년 뒤 지운다
  delete from public.sanctions where level = 'ban' and user_id is null and starts_at < now() - interval '1 year';
  delete from public.inquiries where status = 'answered' and answered_at < now() - interval '1 year';

  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;
