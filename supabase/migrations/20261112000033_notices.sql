-- 운영자 공지 (2026-11-12): 커뮤니티 > 공지 탭에 쌓이고, 새 공지는 접속 중인 사람에게 실시간으로 상단 팝업
-- 읽기는 로그인한 모두(회원·비회원 = authenticated), 쓰기·지우기는 운영자 함수로만

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  author_id uuid, -- 운영자 id. 감사 기록이라 auth.users FK 없음 (마이그 27 과 같은 이유)
  created_at timestamptz not null default now()
);
create index notices_created_idx on public.notices (created_at desc);
alter table public.notices enable row level security;
revoke all on public.notices from anon, authenticated;
grant select on public.notices to authenticated;
create policy "notices read" on public.notices for select to authenticated using (true);

create or replace function public.admin_post_notice(title text, body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.require_admin(); nid uuid;
begin
  insert into public.notices (title, body, author_id) values (btrim(title), btrim(body), me) returning id into nid;
  return nid;
end $$;

create or replace function public.admin_delete_notice(notice uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  delete from public.notices where id = notice;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function public.admin_post_notice(text, text), public.admin_delete_notice(uuid) from public, anon;
grant execute on function public.admin_post_notice(text, text), public.admin_delete_notice(uuid) to authenticated;

-- 새 공지 INSERT 를 접속 중인 앱에 알린다 (RLS select 정책을 따른다)
alter publication supabase_realtime add table public.notices;
