-- 보관 기간 지키기: 처리방침·계정 삭제 안내(/legal)에 적은 "신고·제재 기록 1년 보관 후 삭제"를 정기 작업으로 실제로 한다
-- 영구 제한(ban) 기록은 제한을 유지하는 근거라 지우지 않는다

create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'expired' where status = 'pending' and expires_at <= now();

  delete from public.concerts
   where last_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');
  delete from public.kopis_inbox
   where end_date < (now() at time zone 'Asia/Seoul')::date - public.setting_int('concert_retention_days');

  update public.profiles p set status = 'active'
   where p.status = 'suspended'
     and not exists (select 1 from public.sanctions s where s.user_id = p.id and s.level = 'suspend' and s.ends_at > now());

  delete from public.reports where status <> 'open' and resolved_at < now() - interval '1 year';
  delete from public.sanctions where level <> 'ban' and coalesce(ends_at, starts_at) < now() - interval '1 year';
  delete from public.inquiries where status = 'answered' and answered_at < now() - interval '1 year';

  -- shortcut: 비회원이 올린 public-media 파일은 남는다. 비회원 사진 업로드가 늘면 delete-account 함수로 정리하도록 바꾼다
  delete from auth.users u
   where u.is_anonymous
     and exists (select 1 from public.profiles p where p.id = u.id
                 and p.last_seen_at < now() - make_interval(days => public.setting_int('guest_inactive_delete_days')));
end $$;
revoke execute on function public.run_maintenance() from public, anon, authenticated;
