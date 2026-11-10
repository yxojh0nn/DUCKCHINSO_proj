-- 운영자 화면(검수 대기 · 공연 찾기 · 아티스트)에 필요한 칸과 표
-- 1. 검수 판단 근거를 공연에 남긴다 (점수·근거·내한 여부·출연진·기획사)
-- 2. 수집한 KOPIS 목록 전체를 kopis_inbox 에 남겨, 후보에도 못 오른 공연(Regallily 같은 경우)을 운영자가 찾아 가져올 수 있게 한다
-- 3. J-pop 기획사 목록을 코드 상수에서 표로 옮긴다. 운영자가 공연을 게시하면 그 기획사가 쌓인다

alter table public.concerts
  add column review_score int,
  add column review_reasons text[] not null default '{}',
  add column visit boolean,
  add column cast_text text,
  add column promoter text;

create table public.kopis_inbox (
  kopis_id text primary key,
  title text not null,
  venue text not null default '',
  area text not null default '',
  start_date date,
  end_date date,
  poster_url text,
  seen_at timestamptz not null default now()
);
create index kopis_inbox_end_idx on public.kopis_inbox (end_date);

create table public.jpop_promoters (
  name text primary key check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);
insert into public.jpop_promoters (name) values
  ('위트'), ('weete'), ('원더로크'), ('리벳'), ('LIVET'), ('지누락'), ('하이징크스'), ('HIGHJINKX'), ('아뮤즈');

-- 운영자만 읽고 쓴다 (일반 사용자에게는 정책이 없어 보이지 않음)
alter table public.kopis_inbox enable row level security;
alter table public.jpop_promoters enable row level security;
create policy "admin inbox read" on public.kopis_inbox for select to authenticated using (public.is_admin());
create policy "admin promoters" on public.jpop_promoters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.kopis_inbox to authenticated;
grant select, insert, delete on public.jpop_promoters to authenticated;
grant all on public.kopis_inbox, public.jpop_promoters to service_role;

-- 오래된 수집 목록 정리 (공연 보관 기간과 같은 기준)
create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'expired' where status = 'pending' and expires_at <= now();

  delete from public.concerts
   where last_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');
  delete from public.kopis_inbox
   where end_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');

  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;
