-- 공연 후기는 공연이 시작한 뒤에만 연결된다 (2026-11-21 제보)
--   예전: 앱 화면만 지난 공연에 '후기 쓰기'를 보여 줬고, posts.concert_id 에 아무 공연 id 나 직접 넣으면 시작 전 공연에도 후기가 달렸다
--   지금: 첫 회차가 시작했고(starts_at <= now()) 공개된 공연만 받는다. 운영자 수정·삭제 흐름(concert_id 를 null 로)은 그대로 둔다
create function public.check_review_concert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.concert_id is null or new.concert_id is not distinct from (case when tg_op = 'UPDATE' then old.concert_id end) then
    return new;
  end if;
  if not exists (select 1 from public.concerts c where c.id = new.concert_id and c.status = 'published')
     or not exists (select 1 from public.concert_schedules s where s.concert_id = new.concert_id and s.starts_at <= now()) then
    raise exception 'review_not_open';
  end if;
  return new;
end $$;
create trigger posts_review_concert before insert or update of concert_id on public.posts
  for each row execute function public.check_review_concert();
