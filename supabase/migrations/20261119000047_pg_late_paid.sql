-- 결제 2단계 보완 (2026-11-19, 보안 점검): 돈은 나갔는데 멤버십이 없는 경우를 없앤다
--   1) 이미 실패로 닫은 청구가 뒤늦게 PAID 로 확인되면 → 'late_paid' (서버 함수 settle 이 그 결제를 바로 취소)
--   2) 해지·탈퇴·환불로 끝난 구독의 청구가 결제되면 → 같은 처리
--   3) 그렇게 취소한 결제(원래 failed 청구)의 취소 반영은 지금 쓰는 구독을 끊지 않는다
--      (같은 회차의 다른 시도가 정상 결제된 경우가 있다. 운영자 환불은 paid 청구라 그대로 구독이 끝난다)

create or replace function public.pg_charge_result(pid text, ok boolean, paid_krw int, paid timestamptz, reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.pg_charges; s public.subscriptions; grace interval := make_interval(days => public.setting_int('sub_grace_days'));
begin
  select * into c from public.pg_charges where payment_id = pid for update;
  if not found then raise exception 'not_found'; end if;
  if ok and c.status = 'failed' then
    insert into public.payment_events (source, subscription_id, kind, result) values ('settle', c.subscription_id, 'late_paid:' || pid, 'cancel');
    return 'late_paid';
  end if;
  if c.status <> 'pending' then return 'ignored'; end if;
  select * into s from public.subscriptions where id = c.subscription_id for update;
  if ok and s.state in ('ended', 'revoked') then
    update public.pg_charges set status = 'failed', fail_reason = 'late_paid', updated_at = now() where payment_id = pid;
    insert into public.payment_events (source, subscription_id, kind, result) values ('settle', s.id, 'late_paid:' || pid, 'cancel');
    return 'late_paid';
  end if;
  if ok and paid_krw is distinct from c.amount_krw then
    update public.pg_charges set status = 'failed', fail_reason = 'amount_mismatch', updated_at = now() where payment_id = pid;
    ok := false; reason := 'amount_mismatch';
  elsif ok then
    update public.pg_charges set status = 'paid', paid_at = paid, updated_at = now() where payment_id = pid;
    if s.state = 'pending' then
      update public.subscriptions set state = 'active', anchor_at = paid, period_n = 0, period_end = paid + interval '1 month', updated_at = now() where id = s.id;
      perform public.membership_started(s.user_id, paid);
    elsif s.state = 'active' or (s.state = 'past_due' and paid <= s.period_end + grace) then
      update public.subscriptions set state = 'active', period_n = c.period_n,
             period_end = s.anchor_at + make_interval(months => c.period_n + 1), retries = 0, retry_at = null, updated_at = now() where id = s.id;
    elsif s.state = 'past_due' then
      update public.subscriptions set state = 'active', anchor_at = paid, period_n = 0, period_end = paid + interval '1 month',
             retries = 0, retry_at = null, updated_at = now() where id = s.id;
      perform public.membership_started(s.user_id, paid);
    end if;
    perform public.refresh_membership(s.user_id);
    return 'applied';
  end if;
  -- 실패
  update public.pg_charges set status = 'failed', fail_reason = coalesce(fail_reason, left(reason, 200)), updated_at = now() where payment_id = pid;
  if s.state = 'pending' then
    update public.subscriptions set state = 'ended', ended_at = now(), auto_renew = false, updated_at = now() where id = s.id;
    delete from public.pg_billing where subscription_id = s.id;
    return case when reason = 'amount_mismatch' then 'amount_mismatch' else 'first_failed' end;
  end if;
  update public.subscriptions
     set state = 'past_due', retries = s.retries + 1,
         retry_at = case s.retries + 1 when 1 then s.period_end + interval '1 day' when 2 then s.period_end + interval '3 days'
                                       when 3 then s.period_end + interval '7 days' when 4 then s.period_end + interval '13 days' end,
         updated_at = now()
   where id = s.id and s.state in ('active', 'past_due');
  perform public.refresh_membership(s.user_id);
  return case when reason = 'amount_mismatch' then 'amount_mismatch' else 'retry' end;
end $$;

create or replace function public.pg_charge_canceled(pid text, canceled_total int) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.pg_charges; s public.subscriptions;
begin
  select * into c from public.pg_charges where payment_id = pid for update;
  if not found then raise exception 'not_found'; end if;
  if c.status = 'canceled' and c.canceled_krw >= canceled_total then return 'ignored'; end if;
  update public.pg_charges set status = 'canceled', canceled_krw = greatest(canceled_krw, canceled_total), updated_at = now() where payment_id = pid;
  select * into s from public.subscriptions where id = c.subscription_id for update;
  if c.status <> 'failed' and s.state in ('active', 'past_due', 'pending') and c.period_n >= s.period_n then
    update public.subscriptions set state = 'revoked', auto_renew = false, retry_at = null, ended_at = now(), updated_at = now() where id = s.id;
    delete from public.pg_billing where subscription_id = s.id;
    perform public.refresh_membership(s.user_id);
  end if;
  return 'applied';
end $$;

-- create or replace 는 권한을 유지하지만 마이그 44 와 같게 다시 적어 둔다
revoke execute on function public.pg_charge_result(text, boolean, int, timestamptz, text), public.pg_charge_canceled(text, int) from public, anon, authenticated;
grant execute on function public.pg_charge_result(text, boolean, int, timestamptz, text), public.pg_charge_canceled(text, int) to service_role;
