-- 채팅 개선 (2026-11-12): 내 메시지 고치기, 채팅 사진·영상 형식 확대, 공용 GIF 모음(운영자 승인 후 공개)

-- ─────────── 메시지 수정 ───────────
-- 보낸 사람이 글 메시지만 고친다. 금칙어는 보내기와 같이 가리고, 원문(처음 글 + 고친 내용)은 운영자용 message_originals 에 남긴다
alter table public.messages add column edited_at timestamptz;

create or replace function public.edit_my_message(m uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b text := btrim(new_body); msg public.messages;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(b) not between 1 and 2000 then raise exception 'bad_body'; end if;
  select * into msg from public.messages
   where id = m and sender_id = me and kind = 'text' and deleted_at is null and public.can_send(room_id) for update;
  if not found then raise exception 'not_found'; end if;
  -- 처음 원문(금칙어로 가려졌다면 가리기 전 원문)은 그대로 두고 고친 내용을 뒤에 붙인다: 신고 처리 때 바꿔치기를 알 수 있게
  insert into public.message_originals (message_id, body) values (m, msg.body) on conflict (message_id) do nothing;
  update public.message_originals set body = body || E'\n[수정] ' || b where message_id = m;
  update public.messages set body = public.mask_text(b), edited_at = now() where id = m;
end $$;

revoke execute on function public.edit_my_message(uuid, text) from public, anon;
grant execute on function public.edit_my_message(uuid, text) to authenticated;

-- ─────────── 채팅 첨부: 영상까지 ───────────
-- 사진은 앱이 JPEG 로 줄여 올리고(GIF 는 그대로), 영상은 원본. Supabase 기본 업로드 한도(50MB)에 맞춘다
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'chat-media';

-- ─────────── 공용 GIF 모음 ───────────
-- 회원이 올린 GIF 는 운영자가 승인해야 모두에게 보인다 (선정적·문제 이미지 검열). 올린 사람은 검토 중인 자기 GIF 를 본다
-- 파일 = public-media 버킷 {user_id}/gifs/파일 (기존 "public media upload own" 정책으로 본인 폴더에만 올린다)
create table public.gifs (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index gifs_status_idx on public.gifs (status, created_at desc);
alter table public.gifs enable row level security;
revoke all on public.gifs from anon, authenticated;
grant select on public.gifs to authenticated;
create policy "gifs read" on public.gifs for select to authenticated
  using (status = 'approved' or uploader_id = auth.uid() or public.is_admin());

create or replace function public.submit_gif(p text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_member() then raise exception 'members_only'; end if;
  if p !~ ('^' || me::text || '/gifs/[A-Za-z0-9-]+\.gif$') then raise exception 'bad_path'; end if;
  if (select count(*) from public.gifs where uploader_id = me and status = 'pending') >= 10 then raise exception 'too_many_pending'; end if;
  insert into public.gifs (uploader_id, path) values (me, p) returning id into gid;
  return gid;
end $$;

create or replace function public.admin_resolve_gif(gif uuid, approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.gifs set status = case when approve then 'approved' else 'rejected' end where id = gif;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function public.submit_gif(text), public.admin_resolve_gif(uuid, boolean) from public, anon;
grant execute on function public.submit_gif(text), public.admin_resolve_gif(uuid, boolean) to authenticated;
