-- 운영자 전체 사용자: 회원·비회원을 따로 본다 (2026-11-11). guests=false(기본)면 회원만, true 면 비회원만
-- 인자가 바뀌어 기존 함수를 지우고 다시 만든다 (같은 이름에 기본값 있는 인자가 겹치면 호출이 모호해진다)
drop function public.admin_users(text, int, int);
create function public.admin_users(q text default '', lim int default 50, off int default 0, guests boolean default false)
returns table (id uuid, nickname text, is_guest boolean, status text, is_admin boolean, login text,
               created_at timestamptz, last_seen_at timestamptz, sanctions int, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.nickname, p.is_guest, p.status,
         exists (select 1 from public.admins a where a.user_id = p.id),
         case when p.is_guest then 'guest'
              else coalesce((select e.provider from public.external_ids e where e.user_id = p.id limit 1),
                            (select string_agg(distinct i.provider, ',') from auth.identities i where i.user_id = p.id), 'email') end,
         p.created_at, p.last_seen_at,
         (select count(*)::int from public.sanctions s where s.user_id = p.id),
         count(*) over ()
    from public.profiles p
   where p.is_guest = coalesce(guests, false)
     and (coalesce(btrim(q), '') = '' or p.nickname ilike '%' || btrim(q) || '%')
   order by p.created_at desc
   limit least(greatest(lim, 1), 200) offset greatest(off, 0);
end $$;
revoke execute on function public.admin_users(text, int, int, boolean) from public, anon;
grant execute on function public.admin_users(text, int, int, boolean) to authenticated;
