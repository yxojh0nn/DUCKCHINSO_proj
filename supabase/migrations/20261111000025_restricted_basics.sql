-- 정지·이용 제한 계정이 쓸 수 있는 것 (2026-11-11 결정)
--   캘린더(공연 보기·관심 공연·관심 아티스트·장르)와 문의(운영팀 대화방)는 계속 쓴다. 이의 제기·해제 요청 창구가 문의뿐이라서.
--   커뮤니티·친구·DM 등 다른 사람과 닿는 기능은 막는다.
--   캘린더 쪽 표(favorites·user_artists·user_genres) 정책은 원래 상태를 보지 않아 바꿀 것 없음.

-- 문의: require_uid() 가 상태가 active 가 아니면 거절해서 정지 계정이 문의 방을 못 열었다 → 회원 여부만 본다
create or replace function public.ensure_support_room() returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.is_member() then raise exception 'members_only'; end if;
  select m.room_id into rid from public.chat_members m join public.chat_rooms r on r.id = m.room_id
   where m.user_id = me and r.kind = 'support' limit 1;
  if rid is null then
    insert into public.chat_rooms (kind) values ('support') returning id into rid;
    insert into public.chat_members (room_id, user_id) values (rid, me);
    insert into public.messages (room_id, kind, body) values (rid, 'system', '문의 답변이 이 대화방으로 도착해요.');
  end if;
  return rid;
end $$;

-- 메시지: 정지·이용 제한 계정은 운영팀 대화방에만 보낼 수 있다 (전에는 친구 DM 도 계속 보내졌다)
drop policy "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text', 'image') and public.can_send(room_id) and public.is_member()
              and (exists (select 1 from public.chat_rooms r where r.id = room_id and r.kind = 'support')
                   or exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')));
