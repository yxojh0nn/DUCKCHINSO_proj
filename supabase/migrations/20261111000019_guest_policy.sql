-- 비회원 정책 변경 (2026-11-11)
--   ① 같은 기기에서 다시 들어오면 같은 계정을 쓴다: 마지막 접속 후 14일(20160분) 지나야 정기 작업이 지운다 (기존 60분)
--      로그아웃하면 그대로 즉시 삭제
--   ② 비회원은 커뮤니티 글을 쓸 수 없다 (읽기·댓글·추천은 가능). 기존 정책에 is_guest 조건만 더한다
update public.app_settings set value = '20160' where key = 'guest_inactive_delete_minutes';

drop policy "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from public.profiles p where p.id = auth.uid()
                          and p.status = 'active' and p.community_agreed_at is not null and not p.is_guest));
