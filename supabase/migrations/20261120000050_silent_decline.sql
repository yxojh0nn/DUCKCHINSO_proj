-- 친구 요청을 조용히 거절 (2026-11-20, 보안 점검 보강 D)
-- 지금은 보낸 사람이 ① friend_requests 를 직접 읽어 status='declined' 를 보고 ② Realtime UPDATE 로 거절 순간을 받고
-- ③ 보낸 요청 목록에서 바로 사라지거나 다시 보내기가 성공하는 것으로 거절을 알 수 있다.
-- → 보낸 사람에게는 거절된 요청이 만료될 때까지 '대기 중'으로 보인다. 받은 사람·운영자 쪽 동작은 그대로

-- ①② 보낸 사람은 거절된 행을 읽을 수 없다 (Realtime 도 RLS 를 따르므로 거절 이벤트가 보낸 사람에게 가지 않는다)
drop policy "requests mine" on public.friend_requests;
create policy "requests mine" on public.friend_requests for select to authenticated
  using (to_user = auth.uid() or (from_user = auth.uid() and status <> 'declined'));

-- ③ 내 대기 요청 목록. 보낸 사람에게는 거절된 요청도 만료 전까지 pending 으로 돌려준다
--    표 모양 그대로 돌려줘서 앱이 profiles 를 함께 읽을 수 있다 (PostgREST 임베드)
create or replace function public.my_requests() returns setof public.friend_requests
language sql stable security definer set search_path = '' as $$
  select r.id, r.from_user, r.to_user, 'pending'::text, r.created_at, r.expires_at, null::timestamptz
    from public.friend_requests r
   where r.expires_at > now()
     and ((r.to_user = auth.uid() and r.status = 'pending')
       or (r.from_user = auth.uid() and r.status in ('pending', 'declined')))
$$;
revoke execute on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;

-- 다시 보내기: 내가 보낸 요청이 거절됐어도 만료 전이면 '이미 보냄'(duplicate) 으로 답한다 (나머지는 마이그 21 과 같다)
create or replace function public.send_friend_request(target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_member();
  rid uuid;
begin
  if target = me then raise exception 'self'; end if;
  if public.is_blocked_between(me, target)
     or not exists (select 1 from public.profiles where id = target and status = 'active' and not is_guest) then
    raise exception 'unavailable';
  end if;
  if exists (select 1 from public.friendships where user_a = least(me, target) and user_b = greatest(me, target)) then
    raise exception 'already_friends';
  end if;
  update public.friend_requests set status = 'expired'
   where status = 'pending' and expires_at <= now()
     and least(from_user, to_user) = least(me, target) and greatest(from_user, to_user) = greatest(me, target);
  if exists (select 1 from public.friend_requests where status = 'pending'
             and least(from_user, to_user) = least(me, target) and greatest(from_user, to_user) = greatest(me, target))
     or exists (select 1 from public.friend_requests where status = 'declined' and expires_at > now()
             and from_user = me and to_user = target) then
    raise exception 'duplicate';
  end if;
  if (select count(*) from public.friend_requests where from_user = me
      and created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
     >= public.setting_int('daily_friend_request_limit') then
    raise exception 'daily_limit';
  end if;
  insert into public.friend_requests (from_user, to_user, expires_at)
  values (me, target, now() + make_interval(days => public.setting_int('friend_request_expire_days')))
  returning id into rid;
  return rid;
end $$;

-- 취소: 보낸 사람에게는 거절된 요청도 대기 중으로 보이므로 똑같이 취소된다 (마이그 41 과 나머지는 같다)
create or replace function public.cancel_friend_request(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_member();
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
   where from_user = me and to_user = target
     and (status = 'pending' or (status = 'declined' and expires_at > now()));
  if not found then raise exception 'not_found'; end if;
end $$;
