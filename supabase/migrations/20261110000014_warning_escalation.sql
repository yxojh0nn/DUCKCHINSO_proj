-- 경고 누적 제재 (2026-11-10 결정)
--   경고 1회 → 7일 커뮤니티·채팅 이용 제한, 2회 → 14일, 3회 이상 → 계정 정지(영구 제한)
--   누적은 남아 있는 경고 기록 수로 센다. 경고 기록은 1년 보관(run_maintenance)이라 사실상 최근 1년 기준
--   운영자가 직접 고르는 기간 제한(suspend)·영구 제한(ban)은 그대로 둔다 (사기 등 즉시 조치용)
create or replace function public.admin_sanction(target uuid, level text, reason text, days int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ends timestamptz;
  why text := btrim(reason);
  n int;
  d int;
begin
  perform public.require_admin();
  if level not in ('warning', 'suspend', 'ban') or coalesce(why, '') = '' then raise exception 'bad_request'; end if;
  if level = 'suspend' and (days is null or days < 1 or days > 365) then raise exception 'bad_request'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'not_found'; end if;

  if level = 'warning' then
    insert into public.sanctions (user_id, level, reason) values (target, 'warning', why);
    select count(*) into n from public.sanctions s where s.user_id = target and s.level = 'warning';
    if n >= 3 then
      insert into public.sanctions (user_id, level, reason) values (target, 'ban', '경고 ' || n || '회 누적: ' || why);
      update public.profiles set status = 'banned' where id = target;
      perform public.notify_support(target, '운영정책 위반 경고가 ' || n || '회 쌓여 계정 이용이 정지됐어요. 사유: ' || why);
    else
      d := case n when 1 then 7 else 14 end;
      insert into public.sanctions (user_id, level, reason, ends_at)
        values (target, 'suspend', '경고 ' || n || '회: ' || why, now() + make_interval(days => d));
      update public.profiles set status = 'suspended' where id = target and status = 'active';
      perform public.notify_support(target, '운영정책 위반으로 경고 ' || n || '회가 기록되어 ' || d
        || '일 동안 커뮤니티·채팅 이용이 제한돼요. 경고가 3회 쌓이면 계정 이용이 정지돼요. 사유: ' || why);
    end if;
    return;
  end if;

  ends := case when level = 'suspend' then now() + make_interval(days => days) end;
  insert into public.sanctions (user_id, level, reason, ends_at) values (target, level, why, ends);
  if level = 'suspend' then update public.profiles set status = 'suspended' where id = target and status = 'active'; end if;
  if level = 'ban' then update public.profiles set status = 'banned' where id = target; end if;
  perform public.notify_support(target, case level
    when 'suspend' then '운영정책 위반으로 ' || days || '일 동안 커뮤니티·채팅 이용이 제한돼요. 사유: ' || why
    else '운영정책 위반으로 계정 이용이 영구 제한됐어요. 사유: ' || why end);
end $$;
revoke execute on function public.admin_sanction(uuid, text, text, int) from public, anon;
grant execute on function public.admin_sanction(uuid, text, text, int) to authenticated;
