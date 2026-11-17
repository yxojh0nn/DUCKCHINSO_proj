-- 내 문의 내역 (2026-11-17) — 답변을 채팅(운영팀 대화방) 대신 MY > 문의 > 문의 내역에서 본다
--   inquiries 표는 사용자 select 권한을 회수했으므로(마이그 29) 본인 것만 돌려주는 함수로 읽는다
--   이용 제한 중인 사람도 이의 제기 답변을 봐야 하므로 require_uid() 가 아니라 auth.uid() 로 거른다
create or replace function public.my_inquiries()
returns table (id uuid, category text, body text, status text, answer text, answered_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.category, i.body, i.status, i.answer, i.answered_at, i.created_at
    from public.inquiries i
   where i.user_id = auth.uid()
   order by i.created_at desc
$$;
revoke execute on function public.my_inquiries() from public, anon;
grant execute on function public.my_inquiries() to authenticated;
