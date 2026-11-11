-- 보안 점검 M1 마무리 (2026-11-11): 비회원은 회원 목록을 통째로 받지 못한다
--   마이그 21 은 칸(컬럼)만 줄였고, 행은 여전히 전원이 보였다 → 비회원 토큰 하나로 전 회원 id·닉네임 목록 수집 가능.
--   비회원에게 보이는 프로필: 본인 + 커뮤니티에 글·댓글을 남긴 사람(화면에서 이미 작성자로 보이는 사람)만.
--   회원끼리는 덕친 찾기 때문에 그대로(정지 계정 제외 전원). 링크로 여는 상세 프로필은 profile_card() 가 따로 처리한다.
-- 작성자 여부는 RLS 를 거치지 않는 함수로 본다. 정책 안에서 comments 를 직접 읽으면
-- comments 정책 → profiles 정책 → comments … 로 무한 재귀가 난다
create or replace function public.has_community_activity(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where author_id = u and status = 'visible')
      or exists (select 1 from public.comments where author_id = u)
$$;
revoke execute on function public.has_community_activity(uuid) from public, anon;
grant execute on function public.has_community_activity(uuid) to authenticated;

drop policy "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid()
         or (status <> 'banned'
             and ((select public.is_member()) -- 한 번만 계산 (행마다 부르지 않게)
                  or public.has_community_activity(id))));

-- 위 정책의 작성자 조회용 (탈퇴 시 연쇄 삭제도 빨라진다)
create index if not exists posts_author_idx on public.posts (author_id);
create index if not exists comments_author_idx on public.comments (author_id);
