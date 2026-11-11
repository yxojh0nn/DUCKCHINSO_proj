-- 2026-11-11: 답변 완료 문의 삭제 + 운영자 권한 점검에서 나온 작은 구멍 정리

-- ① 운영자: 답변을 마친 문의만 지운다 (답변 대기 중인 문의는 실수로 지우지 않게 거절)
--    사용자의 운영팀 대화방에 간 답변 메시지는 그대로 남는다(사용자 기록). 누가 지웠는지는 운영 기록에 남긴다
create or replace function public.admin_delete_inquiry(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare st text;
begin
  perform public.require_admin();
  select status into st from public.inquiries where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if st <> 'answered' then raise exception 'not_answered'; end if;
  delete from public.inquiries where id = p_id;
end $$;
revoke execute on function public.admin_delete_inquiry(uuid) from public, anon;
grant execute on function public.admin_delete_inquiry(uuid) to authenticated;

-- 문의 삭제만 운영 기록에 남긴다 (사용자가 문의를 넣는 것까지 기록하면 문의 내용이 1년 동안 운영 기록에 복사된다)
create trigger inquiries_audit after delete on public.inquiries for each row execute function public.audit_row();

-- ② 차단 관계 조회: 호출한 사람이 두 사람 중 하나일 때만 답한다
--    전에는 아무 두 사람(a, b)을 넣어 "누가 누구를 차단했는지"를 알아낼 수 있었다 (blocks 표는 본인 것만 읽히는데 함수로 우회).
--    모든 정책·함수가 (본인, 상대)로 부르므로 동작은 같다. 로그인 사용자 없이 부르는 서버 작업에는 쓰지 않는다
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.uid() in (a, b), false)
     and exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

-- ③ 로그인하지 않은 요청(anon)에는 필요 없는 함수의 실행 권한 정리 (anon 은 auth.uid() 가 없어 해는 없지만 표면을 줄인다)
-- (마이그 21 에서 authenticated 에게만 grant 했지만 PUBLIC 기본 실행 권한이 남아 anon 도 부를 수 있었다)
revoke execute on function public.is_member(), public.require_member(), public.my_profile(), public.profile_card(uuid) from public, anon;
grant execute on function public.is_member(), public.require_member(), public.my_profile(), public.profile_card(uuid) to authenticated;
