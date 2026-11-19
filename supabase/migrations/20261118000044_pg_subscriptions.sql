-- 멤버십 2단계 (2026-11-18): 웹 PG(포트원 V2) 간편·카드 정기결제. 설계: docs/결제_멤버십_연동_설계.md
--   원칙: 금액·기간은 서버(이 DB)가 정하고, 결제 결과는 서버 함수가 포트원에 다시 물어 확인한 것만 넣는다.
--   이 파일의 pg_* 함수는 전부 service role(서버 함수) 전용. 앱(anon·authenticated)은 표도 함수도 못 쓴다.
--   결제일: 사람마다 첫 결제일이 기준일(anchor). 다음 결제일 = 기준일 + n개월 (없는 날짜면 그달 말일, 기준일에서 매번 다시 계산해 밀리지 않음)
--   결제 실패: 혜택은 결제일부터 3일 유예, 재시도 1·3·7·13일째. 결제일부터 14일 안에 결제되면 연속 구독 유지, 넘기면 끝
--   연속 구독(뱃지 개월 수): 이전 구독이 끝난 뒤 14일 안에 다시 시작하면 이어서 센다

insert into public.app_settings (key, value) values
  ('sub_grace_days', '3'),       -- 결제 실패·결제 대기 중 혜택 유지 일수
  ('sub_streak_gap_days', '14')  -- 이 안에 다시 결제되면 연속 구독으로 본다
on conflict (key) do nothing;

-- 상품·가격의 유일한 출처. 앱이 보낸 금액은 쓰지 않는다. 가격이 정해지면 운영자가 price·active 를 바꾼다
create table public.membership_products (
  id text primary key,
  name text not null,
  price_krw int not null check (price_krw > 0),
  first_price_krw int check (first_price_krw is null or first_price_krw > 0), -- 첫 달 할인가 (처음 구독하는 사람만). null = 할인 없음
  active boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.membership_products (id, name, price_krw, first_price_krw) values ('monthly', '덕친소 멤버십 월간', 4900, 990); -- 월 4,900원, 처음 구독하는 사람은 첫 달 990원 (2026-11-18 확정). 포트원 연결 전이라 active=false (docs/포트원_연동_가이드.md 마지막 단계에서 켠다)

-- 결제사에 넘기는 고객 번호. 사용자 id 대신 무작위 값 (빌링키가 이 사람 것인지 확인하는 데 쓴다)
create table public.billing_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  customer_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 구독 원장: 한 구독 = 한 행. 탈퇴해도 결제 기록은 법정 보관 (user_id 만 끊는다)
create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  platform text not null default 'pg' check (platform in ('pg', 'apple', 'google')),
  product_id text not null references public.membership_products (id),
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  state text not null default 'pending' check (state in ('pending', 'active', 'past_due', 'ended', 'revoked')),
  anchor_at timestamptz,          -- 결제 기준일 (첫 결제 시각, 연체 뒤 늦게 결제되면 그때로 다시)
  period_n int not null default 0, -- 지금 기간 = anchor + n개월 ~ anchor + (n+1)개월
  period_end timestamptz,          -- = 다음 결제일
  auto_renew boolean not null default true,
  promo boolean not null default false,
  retries int not null default 0,
  retry_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 한 사람에게 살아 있는 구독은 하나 (수단이 달라도). 중복 결제의 마지막 방어선
create unique index subscriptions_one_live on public.subscriptions (user_id) where state in ('pending', 'active', 'past_due');
create index subscriptions_due on public.subscriptions (period_end) where state in ('active', 'past_due');

-- PG 결제 수단: 빌링키는 서버 함수가 별도 키(BILLING_ENC_KEY)로 암호화해 넣는다. 앱으로는 절대 나가지 않는다
create table public.pg_billing (
  subscription_id bigint primary key references public.subscriptions (id) on delete cascade,
  billing_key_enc text not null,
  method_label text not null, -- 표시용 '카카오페이', '신한카드 ****1234'
  updated_at timestamptz not null default now()
);

-- PG 청구 한 건 = 한 행 (대금 결제 기록, 5년 보관). payment_id 는 서버가 정한 고정값이라 같은 청구를 두 번 할 수 없다
create table public.pg_charges (
  payment_id text primary key,
  subscription_id bigint not null references public.subscriptions (id),
  period_n int not null,
  attempt int not null,
  amount_krw int not null check (amount_krw > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
  fail_reason text,
  paid_at timestamptz,
  canceled_krw int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, period_n, attempt)
);
create unique index pg_charges_one_paid on public.pg_charges (subscription_id, period_n) where status = 'paid';
create index pg_charges_pending on public.pg_charges (created_at) where status = 'pending';

-- 결제 감사 기록: 추가만 된다. event_key(웹훅 id 등)가 같으면 두 번 처리하지 않는다
create table public.payment_events (
  id bigint generated always as identity primary key,
  source text not null,
  event_key text unique,
  subscription_id bigint,
  actor uuid,
  kind text not null,
  result text not null,
  payload_hash text,
  created_at timestamptz not null default now()
);
create or replace function public.forbid_change() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception 'append_only'; end $$;
create trigger payment_events_append_only before update or delete on public.payment_events
  for each row execute function public.forbid_change();

-- 1회용 결제 준비 번호 (15분)
create table public.checkout_intents (
  issue_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null references public.membership_products (id),
  amount_krw int not null,
  promo boolean not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- 외래키 색인 (마이그 39 규칙: 참조 칸마다 색인)
create index subscriptions_user_id on public.subscriptions (user_id);
create index subscriptions_product_id on public.subscriptions (product_id);
create index checkout_intents_user_id on public.checkout_intents (user_id);
create index checkout_intents_product_id on public.checkout_intents (product_id);

alter table public.membership_products enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pg_billing enable row level security;
alter table public.pg_charges enable row level security;
alter table public.payment_events enable row level security;
alter table public.checkout_intents enable row level security;
revoke all on public.membership_products, public.billing_customers, public.subscriptions, public.pg_billing,
  public.pg_charges, public.payment_events, public.checkout_intents from anon, authenticated;

-- 탈퇴: 원장은 user_id 만 끊기고 남는다 → 살아 있던 구독은 끝내고 빌링키를 지운다 (포트원 쪽 빌링키는 delete-account 가 먼저 지움)
create or replace function public.on_subscription_orphaned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.user_id is not null and new.user_id is null then
    delete from public.pg_billing where subscription_id = new.id;
    if new.state in ('pending', 'active', 'past_due') then
      new.state := 'ended'; new.ended_at := now(); new.auto_renew := false;
    end if;
  end if;
  return new;
end $$;
create trigger subscriptions_orphaned before update of user_id on public.subscriptions
  for each row execute function public.on_subscription_orphaned();

-- ── 멤버십 계산 ──

-- 구독이 (새로) 시작될 때: 이전 구독이 끝난 뒤 14일 안이면 시작일을 이어 간다 (뱃지 개월 수 유지)
create or replace function public.membership_started(uid uuid, at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where user_id = uid for update;
  if not found then
    insert into public.memberships (user_id, sub_started_at) values (uid, at);
  elsif m.sub_started_at is null or m.sub_until is null
        or at > m.sub_until + make_interval(days => public.setting_int('sub_streak_gap_days')) then
    update public.memberships set sub_started_at = at, updated_at = now() where user_id = uid;
  end if;
end $$;

-- 원장 → memberships. 자동 갱신 중이면 결제일 + 유예까지 혜택 (갱신 결제가 도는 동안·실패 재시도 중에도 끊기지 않게)
create or replace function public.refresh_membership(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions; until timestamptz; grace interval := make_interval(days => public.setting_int('sub_grace_days'));
begin
  if uid is null then return; end if;
  select * into s from public.subscriptions where user_id = uid and state <> 'pending' order by id desc limit 1;
  if not found then return; end if;
  if s.state = 'active' then
    until := case when s.auto_renew then s.period_end + grace else s.period_end end;
  elsif s.state = 'past_due' then
    until := s.period_end + grace;
  else -- ended·revoked: 늘리지 않고 지금 끝낸다
    until := least(coalesce((select sub_until from public.memberships where user_id = uid), now()), now());
  end if;
  insert into public.memberships (user_id, sub_until, auto_renew) values (uid, until, s.auto_renew)
  on conflict (user_id) do update set sub_until = excluded.sub_until, auto_renew = excluded.auto_renew, updated_at = now();
end $$;

-- ── 앱이 부르는 것 (회원만) ──

-- 가격 안내: 정가, 첫 달 할인가(받을 수 있을 때만), 판매 중인지
create or replace function public.membership_offer()
returns table (price_krw int, first_price_krw int, available boolean)
language sql stable security definer set search_path = '' as $$
  select p.price_krw,
         case when p.first_price_krw is not null and not exists (
           select 1 from public.subscriptions s where s.user_id = auth.uid() and s.anchor_at is not null) then p.first_price_krw end,
         p.active
    from public.membership_products p where p.id = 'monthly' and auth.uid() is not null
$$;

-- 내 멤버십 (마이그 43 에 결제 칸 추가): 결제 수단, 다음 결제일·금액, 결제 실패 중인지
drop function public.my_membership();
create function public.my_membership()
returns table (tier text, sub_started_at timestamptz, sub_until timestamptz,
               max_artists int, max_genres int, months int, auto_renew boolean,
               platform text, method_label text, next_charge_at timestamptz, next_amount_krw int, past_due boolean)
language sql stable security definer set search_path = '' as $$
  select case when public.is_subscriber(me.uid) then 'subscriber' else 'free' end,
         m.sub_started_at, m.sub_until,
         public.pref_limit(auth.uid(), 'user_artists'), public.pref_limit(auth.uid(), 'user_genres'), public.sub_months(auth.uid()),
         coalesce(m.auto_renew, true),
         s.platform, b.method_label,
         case when s.state = 'past_due' then s.retry_at when s.auto_renew then s.period_end end, -- 실패 중이면 다음 재시도
         case when s.auto_renew then p.price_krw end,
         coalesce(s.state = 'past_due', false)
    from (select auth.uid() as uid) me
    left join public.memberships m on m.user_id = me.uid
    left join lateral (select * from public.subscriptions x where x.user_id = me.uid and x.state in ('active', 'past_due') order by x.id desc limit 1) s on true
    left join public.pg_billing b on b.subscription_id = s.id
    left join public.membership_products p on p.id = s.product_id
   where me.uid is not null
$$;

-- 해지 예약·취소 (마이그 43 대체). PG 구독은 원장을 바꾼다. 결제 실패 중에 해지하면 재시도를 멈추고 바로 끝낸다
--   스토어 구독은 스토어에서 해지해야 한다 (use_store). 운영자 지급만 있으면 예전처럼 memberships
create or replace function public.set_my_auto_renew(turn_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s public.subscriptions;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into s from public.subscriptions where user_id = me and state in ('active', 'past_due') for update;
  if found then
    if s.platform <> 'pg' then raise exception 'use_store'; end if;
    if s.state = 'past_due' and not turn_on then
      update public.subscriptions set state = 'ended', auto_renew = false, ended_at = now(), retry_at = null, updated_at = now() where id = s.id;
      delete from public.pg_billing where subscription_id = s.id;
    elsif s.state = 'past_due' then
      raise exception 'payment_retry'; -- 결제 실패 중에는 해지 취소 대신 결제 수단을 고친다
    else
      update public.subscriptions set auto_renew = turn_on, updated_at = now() where id = s.id;
    end if;
    insert into public.payment_events (source, subscription_id, actor, kind, result)
      values ('user', s.id, me, case when turn_on then 'auto_renew_on' else 'auto_renew_off' end, 'applied');
    perform public.refresh_membership(me);
    return;
  end if;
  update public.memberships set auto_renew = turn_on, updated_at = now()
   where user_id = me and sub_until > now();
  if not found then raise exception 'not_subscribed'; end if;
end $$;

-- 운영자 시험 지급 (마이그 43 대체): 실제 결제 구독이 있는 사람에게는 못 한다. 기록을 남긴다
create or replace function public.admin_set_membership(target uuid, kind text, months int default 1) returns void
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.require_admin();
begin
  if not exists (select 1 from public.profiles where id = target and not is_guest) then raise exception 'not_found'; end if;
  if exists (select 1 from public.subscriptions where user_id = target and state in ('pending', 'active', 'past_due')) then
    raise exception 'has_paid_subscription';
  end if;
  if kind = 'clear' then
    delete from public.memberships where user_id = target;
  else
    insert into public.memberships (user_id) values (target) on conflict (user_id) do nothing;
    if kind = 'subscribe' then
      if months is null or months not between 1 and 24 then raise exception 'bad_request'; end if;
      update public.memberships
         set sub_started_at = case when sub_until > now() then sub_started_at else now() end,
             auto_renew = case when sub_until > now() then auto_renew else true end,
             sub_until = greatest(coalesce(sub_until, now()), now()) + make_interval(months => months),
             updated_at = now()
       where user_id = target;
    elsif kind = 'end_sub' then
      update public.memberships set sub_until = least(sub_until, now()), updated_at = now() where user_id = target;
    else
      raise exception 'bad_request';
    end if;
  end if;
  insert into public.payment_events (source, actor, kind, result) values ('admin', admin, 'grant:' || kind || ':' || target, 'applied');
end $$;

-- 운영자: 한 사람의 멤버십 (마이그 43 대체) + 마지막 결제 구독과 환불할 수 있는 금액 (환불은 pg-refund 서버 함수가 한다)
drop function public.admin_membership(uuid);
create function public.admin_membership(target uuid)
returns table (sub_started_at timestamptz, sub_until timestamptz, months int,
               subscription_id bigint, sub_state text, method_label text, refundable_krw int, paid_at timestamptz, within_7days boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
    select m.sub_started_at, m.sub_until, public.sub_months(target), s.id, s.state, b.method_label, q.refundable_krw, q.paid_at, q.within_7days
      from (select target as uid) t
      left join public.memberships m on m.user_id = t.uid
      left join lateral (select * from public.subscriptions x where x.user_id = t.uid and x.platform = 'pg' and x.state <> 'pending' order by x.id desc limit 1) s on true
      left join public.pg_billing b on b.subscription_id = s.id
      left join lateral public.pg_refund_quote(s.id) q on true
     where m.user_id is not null or s.id is not null;
end $$;
revoke execute on function public.admin_membership(uuid) from public, anon;
grant execute on function public.admin_membership(uuid) to authenticated;

-- ── 서버 함수(service role) 전용 ──

-- 결제 준비: 회원·판매 중·구독 중 아님을 확인하고 1회용 번호와 금액(첫 달 할인 포함)을 정한다
create or replace function public.pg_checkout(uid uuid)
returns table (issue_id uuid, customer_token uuid, order_name text, amount_krw int, promo boolean)
language plpgsql security definer set search_path = '' as $$
declare p public.membership_products; first boolean; amt int; tok uuid; iid uuid;
begin
  if not exists (select 1 from public.profiles where id = uid and not is_guest) then raise exception 'members_only'; end if;
  select * into p from public.membership_products where id = 'monthly' and active;
  if not found then raise exception 'not_ready'; end if;
  -- 오래 걸린 결제 준비(2시간 넘게 결과가 없는 것)는 정리 (그 사이 결제가 됐는지는 대사 cron 이 먼저 확인한다)
  update public.subscriptions s set state = 'ended', ended_at = now(), updated_at = now()
   where s.user_id = uid and s.state = 'pending' and s.created_at < now() - interval '2 hours'
     and not exists (select 1 from public.pg_charges c where c.subscription_id = s.id and c.status in ('pending', 'paid'));
  -- 결제 실패 중(past_due)인 사람은 새 결제로 바꿀 수 있다 (pg_begin 이 이전 구독을 끝낸다)
  if (public.is_subscriber(uid)
             and not exists (select 1 from public.subscriptions where user_id = uid and state = 'past_due'))
     or exists (select 1 from public.subscriptions where user_id = uid and state in ('pending', 'active')) then
    raise exception 'already_subscribed';
  end if;
  first := p.first_price_krw is not null and not exists (select 1 from public.subscriptions where user_id = uid and anchor_at is not null);
  amt := case when first then p.first_price_krw else p.price_krw end;
  insert into public.billing_customers (user_id) values (uid) on conflict (user_id) do nothing;
  select b.customer_token into tok from public.billing_customers b where b.user_id = uid;
  insert into public.checkout_intents (user_id, product_id, amount_krw, promo, expires_at)
    values (uid, p.id, amt, first, now() + interval '15 minutes') returning checkout_intents.issue_id into iid;
  return query select iid, tok, p.name, amt, first;
end $$;

-- 결제 시작: 1회용 번호를 쓰고 구독(pending)과 첫 청구 행을 만든다. 결제 실패 중이던 이전 구독은 새 구독으로 대신한다
create or replace function public.pg_begin(uid uuid, issue uuid)
returns table (subscription_id bigint, payment_id text, amount_krw int, order_name text, customer_token uuid)
language plpgsql security definer set search_path = '' as $$
declare i public.checkout_intents; sid bigint; pid text;
begin
  select * into i from public.checkout_intents c where c.issue_id = issue for update;
  if not found or i.user_id <> uid or i.used_at is not null or i.expires_at <= now() then raise exception 'checkout_expired'; end if;
  if (public.is_subscriber(uid)
             and not exists (select 1 from public.subscriptions where user_id = uid and state = 'past_due'))
     or exists (select 1 from public.subscriptions where user_id = uid and state in ('pending', 'active')) then
    raise exception 'already_subscribed';
  end if;
  update public.subscriptions set state = 'ended', auto_renew = false, retry_at = null, ended_at = now(), updated_at = now()
   where user_id = uid and state = 'past_due';
  delete from public.pg_billing b using public.subscriptions s where b.subscription_id = s.id and s.user_id = uid and s.state = 'ended';
  update public.checkout_intents set used_at = now() where checkout_intents.issue_id = issue;
  insert into public.subscriptions (user_id, product_id, promo) values (uid, i.product_id, i.promo) returning id into sid;
  pid := 'mbr_' || sid || '_0_0';
  insert into public.pg_charges (payment_id, subscription_id, period_n, attempt, amount_krw) values (pid, sid, 0, 0, i.amount_krw);
  insert into public.payment_events (source, subscription_id, actor, kind, result) values ('checkout', sid, uid, 'begin', 'applied');
  return query select sid, pid, i.amount_krw, (select name from public.membership_products where id = i.product_id),
                      (select b.customer_token from public.billing_customers b where b.user_id = uid);
end $$;

-- 빌링키 저장 (확인은 서버 함수가 포트원에 물어 끝낸 뒤). 결제 준비 중인 구독에만
create or replace function public.pg_save_billing(sid bigint, key_enc text, label text, env text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if env not in ('production', 'sandbox') then raise exception 'bad_request'; end if;
  update public.subscriptions set environment = env, updated_at = now() where id = sid and state = 'pending';
  if not found then raise exception 'bad_state'; end if;
  insert into public.pg_billing (subscription_id, billing_key_enc, method_label) values (sid, key_enc, left(label, 40))
  on conflict (subscription_id) do update set billing_key_enc = excluded.billing_key_enc, method_label = excluded.method_label, updated_at = now();
end $$;

-- 청구 결과 반영 (포트원에 다시 물어 본 값만 넣는다). 이미 끝난 청구면 무시 → 웹훅·재시도·cron 이 겹쳐도 한 번만
--   돌려주는 값: applied / ignored / amount_mismatch(서버 함수가 그 결제를 바로 취소) / first_failed / retry
create or replace function public.pg_charge_result(pid text, ok boolean, paid_krw int, paid timestamptz, reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.pg_charges; s public.subscriptions; grace interval := make_interval(days => public.setting_int('sub_grace_days'));
begin
  select * into c from public.pg_charges where payment_id = pid for update;
  if not found then raise exception 'not_found'; end if;
  if c.status <> 'pending' then return 'ignored'; end if;
  select * into s from public.subscriptions where id = c.subscription_id for update;
  if ok and paid_krw is distinct from c.amount_krw then
    update public.pg_charges set status = 'failed', fail_reason = 'amount_mismatch', updated_at = now() where payment_id = pid;
    ok := false; reason := 'amount_mismatch';
  elsif ok then
    update public.pg_charges set status = 'paid', paid_at = paid, updated_at = now() where payment_id = pid;
    if s.state = 'pending' then
      update public.subscriptions set state = 'active', anchor_at = paid, period_n = 0, period_end = paid + interval '1 month', updated_at = now() where id = s.id;
      perform public.membership_started(s.user_id, paid);
    elsif s.state = 'active' or (s.state = 'past_due' and paid <= s.period_end + grace) then
      -- 제때(또는 유예 안에) 결제: 기준일 그대로 다음 달
      update public.subscriptions set state = 'active', period_n = c.period_n,
             period_end = s.anchor_at + make_interval(months => c.period_n + 1), retries = 0, retry_at = null, updated_at = now() where id = s.id;
    elsif s.state = 'past_due' then
      -- 혜택이 끊긴 뒤 늦게 결제: 못 쓴 날을 내지 않게 결제한 날을 새 기준일로. 14일 안이면 연속 구독은 유지
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

-- 결제 취소·환불 반영 (포트원 확인 후). 지금 기간의 청구가 취소되면 구독은 바로 끝난다(revoked)
create or replace function public.pg_charge_canceled(pid text, canceled_total int) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.pg_charges; s public.subscriptions;
begin
  select * into c from public.pg_charges where payment_id = pid for update;
  if not found then raise exception 'not_found'; end if;
  if c.status = 'canceled' and c.canceled_krw >= canceled_total then return 'ignored'; end if;
  update public.pg_charges set status = 'canceled', canceled_krw = greatest(canceled_krw, canceled_total), updated_at = now() where payment_id = pid;
  select * into s from public.subscriptions where id = c.subscription_id for update;
  if s.state in ('active', 'past_due', 'pending') and c.period_n >= s.period_n then
    update public.subscriptions set state = 'revoked', auto_renew = false, retry_at = null, ended_at = now(), updated_at = now() where id = s.id;
    delete from public.pg_billing where subscription_id = s.id;
    perform public.refresh_membership(s.user_id);
  end if;
  return 'applied';
end $$;

-- 갱신할 차례인 구독: 청구 행을 먼저 만들어(같은 회차·시도는 하나만) 겹쳐 돌아도 두 번 청구되지 않는다
create or replace function public.pg_due(max_rows int default 50)
returns table (subscription_id bigint, user_id uuid, payment_id text, amount_krw int, order_name text, billing_key_enc text, customer_token uuid)
language plpgsql security definer set search_path = '' as $$
declare s record; pid text; n int; att int;
begin
  for s in
    select x.*, p.price_krw, p.name, b.billing_key_enc as enc, bc.customer_token as tok
      from public.subscriptions x
      join public.membership_products p on p.id = x.product_id
      join public.pg_billing b on b.subscription_id = x.id
      join public.billing_customers bc on bc.user_id = x.user_id
     where x.platform = 'pg' and x.auto_renew and x.user_id is not null
       and ((x.state = 'active' and x.period_end <= now()) or (x.state = 'past_due' and x.retry_at <= now()))
     order by x.period_end limit max_rows
     for update of x skip locked
  loop
    n := s.period_n + 1; att := s.retries;
    pid := 'mbr_' || s.id || '_' || n || '_' || att;
    insert into public.pg_charges (payment_id, subscription_id, period_n, attempt, amount_krw)
      values (pid, s.id, n, att, s.price_krw) on conflict do nothing;
    if found then
      subscription_id := s.id; user_id := s.user_id; payment_id := pid; amount_krw := s.price_krw;
      order_name := s.name; billing_key_enc := s.enc; customer_token := s.tok;
      return next;
    end if;
  end loop;
end $$;

-- 결과가 아직 안 온 청구 (대사 cron 이 포트원에 다시 물어본다)
create or replace function public.pg_stale_charges(older_than interval default interval '5 minutes')
returns table (payment_id text, amount_krw int)
language sql stable security definer set search_path = '' as $$
  select c.payment_id, c.amount_krw from public.pg_charges c where c.status = 'pending' and c.created_at < now() - older_than order by c.created_at limit 100
$$;

-- 정리: 해지 예약한 구독은 결제일에 끝, 결제 실패가 14일을 넘기면 끝, 지난 결제 준비 번호 삭제. 끝난 구독의 사람 목록을 돌려준다
create or replace function public.pg_sweep() returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare gap interval := make_interval(days => public.setting_int('sub_streak_gap_days')); u uuid;
begin
  for u in
    update public.subscriptions s set state = 'ended', ended_at = now(), retry_at = null, auto_renew = false, updated_at = now()
     where (s.state = 'active' and not s.auto_renew and s.period_end <= now())
        or (s.state = 'past_due' and s.period_end + gap <= now())
    returning s.user_id
  loop
    delete from public.pg_billing b using public.subscriptions s where b.subscription_id = s.id and s.user_id = u and s.state = 'ended';
    perform public.refresh_membership(u);
    return next u;
  end loop;
  delete from public.checkout_intents where expires_at < now() - interval '1 day';
end $$;

-- 감사 기록 (웹훅·서버 함수). 같은 event_key 면 false → 이미 처리한 알림
create or replace function public.pg_log(src text, ekey text, sid bigint, k text, res text, phash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payment_events (source, event_key, subscription_id, kind, result, payload_hash) values (src, ekey, sid, k, left(res, 200), phash);
  return true;
exception when unique_violation then
  return false;
end $$;

-- 운영자 환불 계산 근거: 그 구독의 이번 기간 결제와 쓴 날·남은 날 (정책 결정은 docs 의 환불 정책)
create or replace function public.pg_refund_quote(sid bigint)
returns table (payment_id text, paid_krw int, refundable_krw int, paid_at timestamptz, days_used int, days_total int, within_7days boolean)
language sql stable security definer set search_path = '' as $$
  select c.payment_id, c.amount_krw, c.amount_krw - c.canceled_krw, c.paid_at,
         greatest(0, ceil(extract(epoch from now() - c.paid_at) / 86400))::int,
         ceil(extract(epoch from s.period_end - (s.anchor_at + make_interval(months => s.period_n))) / 86400)::int,
         now() < c.paid_at + interval '7 days'
    from public.subscriptions s join public.pg_charges c on c.subscription_id = s.id and c.period_n = s.period_n and c.status = 'paid'
   where s.id = sid
$$;

revoke execute on function public.forbid_change(), public.on_subscription_orphaned(), public.membership_started(uuid, timestamptz), public.refresh_membership(uuid),
  public.pg_checkout(uuid), public.pg_begin(uuid, uuid), public.pg_save_billing(bigint, text, text, text),
  public.pg_charge_result(text, boolean, int, timestamptz, text), public.pg_charge_canceled(text, int), public.pg_due(int),
  public.pg_stale_charges(interval), public.pg_sweep(), public.pg_log(text, text, bigint, text, text, text), public.pg_refund_quote(bigint)
  from public, anon, authenticated;
grant execute on function public.pg_checkout(uuid), public.pg_begin(uuid, uuid), public.pg_save_billing(bigint, text, text, text),
  public.pg_charge_result(text, boolean, int, timestamptz, text), public.pg_charge_canceled(text, int), public.pg_due(int),
  public.pg_stale_charges(interval), public.pg_sweep(), public.pg_log(text, text, bigint, text, text, text), public.pg_refund_quote(bigint)
  to service_role;
revoke execute on function public.membership_offer(), public.my_membership() from public, anon;
grant execute on function public.membership_offer(), public.my_membership() to authenticated;

-- 15분마다 갱신 결제·대사·정리 (pg-renew 서버 함수, service role 키로만 부를 수 있다). pg_cron 이 있는 서버에서만
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('duckchinso-pg-renew', '*/15 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/pg-renew',
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                                      'Content-Type', 'application/json'),
        body := '{}'::jsonb, timeout_milliseconds := 120000)
    $job$);
  end if;
end $$;
