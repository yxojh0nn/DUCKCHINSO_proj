-- 운영자 권한 추가 (2026-11-10)
--   글 바로 삭제: 커뮤니티 글 상세에서 운영자가 사유를 골라 지운다. 작성자에게 운영팀 대화방으로 알린다
--   사용자 상세: 전체 사용자 목록에서 한 사람을 열어 정보·제재 이력을 보고 바로 제재한다 (제재는 기존 admin_sanction)

-- 글 삭제. 댓글·추천은 함께 지워지고, 이 글에 들어온 신고는 원문 스냅숏과 함께 남는다(post_id 만 비워짐)
create or replace function public.admin_delete_post(post uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
  ttl text;
  why text := btrim(reason);
begin
  perform public.require_admin();
  if coalesce(why, '') = '' then raise exception 'bad_request'; end if;
  -- 이 글에 들어온 대기 중 신고는 지우기 전에 조치 완료로 닫는다 (지우면 post_id 가 비워져 찾을 수 없음)
  update public.reports set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
   where status = 'open' and post_id = post;
  delete from public.posts p where p.id = post returning p.author_id, p.title into author, ttl;
  if author is null then raise exception 'not_found'; end if;
  perform public.notify_support(author, '운영정책 위반으로 글이 삭제됐어요. 글: ' || ttl || ' / 사유: ' || why);
end $$;

-- 사용자 한 명 (목록과 같은 칸 + 소개글). 이메일 등 개인정보는 돌려주지 않는다
create or replace function public.admin_user(target uuid)
returns table (id uuid, nickname text, bio text, is_guest boolean, status text, is_admin boolean, login text,
               created_at timestamptz, last_seen_at timestamptz, posts int, comments int, reports_against int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.nickname, p.bio, p.is_guest, p.status,
         exists (select 1 from public.admins a where a.user_id = p.id),
         case when p.is_guest then 'guest'
              else coalesce((select e.provider from public.external_ids e where e.user_id = p.id limit 1),
                            (select string_agg(distinct i.provider, ',') from auth.identities i where i.user_id = p.id), 'email') end,
         p.created_at, p.last_seen_at,
         (select count(*)::int from public.posts x where x.author_id = p.id),
         (select count(*)::int from public.comments x where x.author_id = p.id),
         (select count(*)::int from public.reports x where x.target_user = p.id)
    from public.profiles p
   where p.id = target;
end $$;

-- 제재 이력 (최신순)
create or replace function public.admin_user_sanctions(target uuid)
returns table (level text, reason text, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select s.level, s.reason, s.starts_at, s.ends_at from public.sanctions s where s.user_id = target order by s.starts_at desc;
end $$;

revoke execute on function public.admin_delete_post(uuid, text), public.admin_user(uuid), public.admin_user_sanctions(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid, text), public.admin_user(uuid), public.admin_user_sanctions(uuid) to authenticated;
