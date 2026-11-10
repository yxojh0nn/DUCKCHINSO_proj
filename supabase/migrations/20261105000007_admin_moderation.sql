-- 운영자 신고·문의 처리
-- 목록과 처리는 security definer 함수로만 한다: 함수 안에서 is_admin() 을 확인하고,
-- 내용 가리기·처리 상태·제재·당사자 알림을 한 트랜잭션으로 묶는다 (중간에 끊겨 반쯤 처리되는 일 방지)

alter table public.reports
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles (id) on delete set null;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return auth.uid();
end $$;

-- 운영팀 대화방에 안내를 남긴다 (문의 답변이 오는 그 방). 없으면 만든다
create or replace function public.notify_support(target uuid, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  select m.room_id into rid from public.chat_members m join public.chat_rooms r on r.id = m.room_id
   where m.user_id = target and r.kind = 'support' limit 1;
  if rid is null then
    insert into public.chat_rooms (kind) values ('support') returning id into rid;
    insert into public.chat_members (room_id, user_id) values (rid, target);
  end if;
  insert into public.messages (room_id, sender_id, kind, body) values (rid, null, 'text', body);
end $$;

-- 신고 목록: 처리 대기 전체 + 최근 처리 200건. 신고 대상 사용자는 글·댓글·채팅의 작성자에서 찾는다
create or replace function public.admin_reports()
returns table (id uuid, reason text, detail text, snapshot text, status text, created_at timestamptz, resolved_at timestamptz,
               kind text, post_id uuid, reporter_id uuid, reporter_nickname text,
               target_id uuid, target_nickname text, target_status text, prior_sanctions int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  with base as (
    select r.*,
      coalesce(r.target_user, p.author_id, c.author_id, m.sender_id) as tid,
      case when r.post_id is not null then 'post' when r.comment_id is not null then 'comment'
           when r.message_id is not null then 'message' else 'profile' end as k
      from public.reports r
      left join public.posts p on p.id = r.post_id
      left join public.comments c on c.id = r.comment_id
      left join public.messages m on m.id = r.message_id
  )
  select b.id, b.reason, b.detail, b.content_snapshot, b.status, b.created_at, b.resolved_at, b.k, b.post_id,
         rp.id, rp.nickname, tp.id, tp.nickname, tp.status,
         (select count(*)::int from public.sanctions s where s.user_id = b.tid)
    from base b
    left join public.profiles rp on rp.id = b.reporter
    left join public.profiles tp on tp.id = b.tid
   where b.status = 'open' or b.id in (select x.id from public.reports x where x.status <> 'open' order by x.resolved_at desc nulls last limit 200)
   order by (b.status = 'open') desc, b.created_at desc;
end $$;

-- 신고 처리: resolved(조치함) / dismissed(기각). hide_content 면 글은 숨기고, 댓글은 지우고, 채팅은 가린다
-- 같은 내용을 가리킨 다른 처리 대기 신고도 함께 닫는다. 신고 원문(content_snapshot)은 기록으로 남는다
create or replace function public.admin_resolve_report(r uuid, resolution text, hide_content boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_admin(); rep public.reports;
begin
  if resolution not in ('resolved', 'dismissed') then raise exception 'bad_request'; end if;
  select * into rep from public.reports where id = r for update;
  if not found then raise exception 'not_found'; end if;
  if hide_content and resolution = 'resolved' then
    if rep.post_id is not null then update public.posts set status = 'hidden' where id = rep.post_id; end if;
    if rep.comment_id is not null then delete from public.comments where id = rep.comment_id; end if;
    if rep.message_id is not null then
      update public.messages set kind = 'text', body = '운영정책에 따라 가려진 메시지예요.', image_path = null where id = rep.message_id;
    end if;
  end if;
  update public.reports set status = resolution, resolved_at = now(), resolved_by = me
   where id = r
      or (status = 'open' and ((rep.post_id is not null and post_id = rep.post_id)
                            or (rep.comment_id is not null and comment_id = rep.comment_id)
                            or (rep.message_id is not null and message_id = rep.message_id)));
end $$;

-- 제재: warning(경고) / suspend(days 일 이용 제한) / ban(영구). 당사자에게 운영팀 대화방으로 알린다
-- 이용 제한·영구 제한 계정은 require_uid() 와 RLS(status = 'active')에 막혀 글·댓글·요청·채팅을 못 한다
create or replace function public.admin_sanction(target uuid, level text, reason text, days int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare ends timestamptz;
begin
  perform public.require_admin();
  if level not in ('warning', 'suspend', 'ban') or coalesce(btrim(reason), '') = '' then raise exception 'bad_request'; end if;
  if level = 'suspend' and (days is null or days < 1 or days > 365) then raise exception 'bad_request'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'not_found'; end if;
  ends := case when level = 'suspend' then now() + make_interval(days => days) end;
  insert into public.sanctions (user_id, level, reason, ends_at) values (target, level, btrim(reason), ends);
  if level = 'suspend' then update public.profiles set status = 'suspended' where id = target and status = 'active'; end if;
  if level = 'ban' then update public.profiles set status = 'banned' where id = target; end if;
  perform public.notify_support(target, case level
    when 'warning' then '운영정책 위반으로 경고가 기록됐어요. 사유: ' || btrim(reason)
    when 'suspend' then '운영정책 위반으로 ' || days || '일 동안 커뮤니티·채팅 이용이 제한돼요. 사유: ' || btrim(reason)
    else '운영정책 위반으로 계정 이용이 영구 제한됐어요. 사유: ' || btrim(reason) end);
end $$;

-- 문의 목록: 답변 대기 전체 + 최근 답변 200건
create or replace function public.admin_inquiries()
returns table (id uuid, user_id uuid, nickname text, is_guest boolean, category text, answers jsonb, body text,
               status text, answer text, answered_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select i.id, i.user_id, p.nickname, p.is_guest, i.category, i.answers, i.body, i.status, i.answer, i.answered_at, i.created_at
    from public.inquiries i left join public.profiles p on p.id = i.user_id
   where i.status = 'open' or i.id in (select x.id from public.inquiries x where x.status = 'answered' order by x.answered_at desc nulls last limit 200)
   order by (i.status = 'open') desc, i.created_at desc;
end $$;

-- 정기 작업: 기간이 끝난 이용 제한을 푼다 (영구 제한은 그대로)
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

  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;

revoke execute on function public.require_admin(), public.notify_support(uuid, text), public.admin_reports(),
  public.admin_resolve_report(uuid, text, boolean), public.admin_sanction(uuid, text, text, int),
  public.admin_inquiries(), public.run_maintenance() from public, anon, authenticated;
-- 운영자 화면이 부르는 함수만 연다 (함수 안에서 운영자인지 다시 확인한다)
grant execute on function public.admin_reports(), public.admin_resolve_report(uuid, text, boolean),
  public.admin_sanction(uuid, text, text, int), public.admin_inquiries() to authenticated;
