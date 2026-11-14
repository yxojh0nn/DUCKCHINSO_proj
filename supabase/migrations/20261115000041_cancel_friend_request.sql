-- 보낸 친구 요청 취소. 행을 지우지 않고 cancelled 로 남긴다
-- → send_friend_request 의 하루 한도가 보낸 행 수로 세므로, 보내고 취소하기를 반복해 상대에게 알림을 계속 보낼 수 없다
alter table public.friend_requests drop constraint friend_requests_status_check;
alter table public.friend_requests add constraint friend_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

create or replace function public.cancel_friend_request(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_member();
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
   where from_user = me and to_user = target and status = 'pending';
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
