// 마이그레이션 검증: Supabase auth·storage 를 흉내 낸 Postgres(PGlite)에 스키마를 올리고 권한·탈퇴 범위를 확인한다
// 실행: pnpm test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const db = new PGlite()
const stub = `
create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean default false, raw_user_meta_data jsonb default '{}', encrypted_password text, email_confirmed_at timestamptz);
create schema extensions; create function extensions.crypt(p text, s text) returns text language sql as $$ select 'h:' || p $$; -- bcrypt 흉내
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated; -- Supabase 기본 권한 (거르는 건 RLS)
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema public, storage, auth to authenticated, anon;
`
await db.exec(stub)
// 표 권한은 실제 Supabase 처럼 자동으로 주지 않고 마이그레이션(20261104000004_grants)이 준 것만 쓴다
for (const f of ['20261103000001_init.sql', '20261103000002_rls_and_rpc.sql', '20261104000004_grants.sql', '20261105000006_admin_review.sql', '20261105000007_admin_moderation.sql', '20261105000008_retention.sql', '20261105000009_report_fixes.sql', '20261106000010_word_filter.sql', '20261106000011_login_ids.sql', '20261106000012_login_needs_confirm.sql', '20261106000013_email_codes.sql', '20261110000014_warning_escalation.sql', '20261110000015_ticket_tips_admin_users.sql', '20261110000016_guest_cleanup.sql', '20261110000017_admin_post_user.sql', '20261111000018_replies_reviews_notify.sql', '20261111000019_guest_policy.sql', '20261111000020_concert_intro_images.sql', '20261111000021_security_guest_scope.sql', '20261111000022_own_edit.sql', '20261111000023_guest_profile_scope.sql', '20261111000024_admin_users_split.sql', '20261111000025_restricted_basics.sql', '20261111000026_guest_profile_lock.sql', '20261111000027_audit_and_integrity.sql', '20261111000028_admin_rpc.sql', '20261111000029_revoke_admin_grants.sql', '20261111000030_inquiry_delete_and_hardening.sql', '20261111000031_nickname_validate.sql', '20261111000032_revoke_sessions.sql', '20261112000033_notices.sql', '20261112000034_notice_period.sql', '20261112000035_notice_schedule.sql', '20261112000036_admin_badge.sql', '20261112000037_chat_media_gifs.sql', '20261113000038_klipy_gifs.sql', '20261113000039_fk_indexes.sql', '20261113000040_ticket_link_clicks.sql', '20261115000041_cancel_friend_request.sql', '20261117000042_my_inquiries.sql'])
  await db.exec(readFileSync(`${repo}supabase/migrations/${f}`, 'utf8'))

const ids = {}
for (const [k, anon] of [['a', false], ['b', false], ['c', true]]) {
  const r = await db.query(`insert into auth.users (email, is_anonymous) values ($1, $2) returning id`, [anon ? null : `${k}@x.com`, anon])
  ids[k] = r.rows[0].id
}
const prof = await db.query(`select id, nickname, is_guest from public.profiles order by created_at`)
assert.equal(prof.rows.length, 3)
assert.ok(prof.rows.find((p) => p.id === ids.c).nickname.startsWith('익명의 팬'))

// act as user
const as = async (k, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.uid', '${ids[k]}', false); set role authenticated;`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}

// prefs + community setup
const art = await db.query(`insert into public.artists (name) values ('YOASOBI'), ('Ado') returning id`)
for (const k of ['a', 'b', 'c']) {
  await as(k, `insert into public.user_artists (user_id, artist_id) values ($1, $2)`, [ids[k], art.rows[0].id])
  await as(k, `update public.profiles set profile_setup_done = true where id = $1`, [ids[k]])
  await as(k, `select public.agree_community('v1')`) // 동의 시각은 서버 함수로만 (I2)
}
// cannot escalate status
await assert.rejects(as('a', `update public.profiles set status = 'banned' where id = $1`, [ids.b]))
await assert.rejects(as('a', `update public.profiles set is_guest = true where id = $1`, [ids.a]))
// a cannot update b's bio (RLS filters → 0 rows)
const upd = await as('a', `update public.profiles set bio = 'hack' where id = $1`, [ids.b])
assert.equal(upd.affectedRows, 0)

const rec = await as('a', `select * from public.recommend_friends(10)`)
assert.deepEqual(rec.rows.map((r) => r.id), [ids.b]) // 비회원(c)은 추천에 나오지 않는다

// 보안 점검 1단계: 비회원은 사용자 검색·추천·친구·문의·추천(좋아요)·댓글 불가
assert.equal((await as('c', `select * from public.recommend_friends(10)`)).rows.length, 0)
assert.equal((await as('c', `select * from public.search_users('')`)).rows.length, 0)
assert.deepEqual((await as('a', `select id from public.search_users('')`)).rows.map((r) => r.id), [ids.b])
await assert.rejects(as('c', `select public.send_friend_request($1)`, [ids.a]), /members_only/)
await assert.rejects(as('a', `select public.send_friend_request($1)`, [ids.c]), /unavailable/)
await assert.rejects(as('c', `select public.block_user($1)`, [ids.a]), /members_only/)
await assert.rejects(as('c', `select public.ensure_support_room()`), /members_only/)
await assert.rejects(as('c', `insert into public.inquiries (user_id, category, body) values ($1, 'etc', 'x')`, [ids.c]))
assert.equal((await as('c', `select public.is_admin() as v`)).rows[0].v, false)
// 남의 프로필: 공개 칸만. 마지막 접속 시각은 못 읽고, 내 것은 my_profile() 로 전부
await assert.rejects(as('c', `select last_seen_at from public.profiles`), /permission denied/)
await assert.rejects(as('c', `select * from public.profiles`), /permission denied/)
assert.deepEqual((await as('c', `select id from public.profiles`)).rows.map((r) => r.id), [ids.c]) // 비회원: 아직 글·댓글 쓴 사람이 없으면 자기만
assert.equal((await as('a', `select id, nickname from public.profiles`)).rows.length, 3) // 회원: 전원
const mine = (await as('a', `select * from public.my_profile()`)).rows
assert.equal(mine.length, 1); assert.equal(mine[0].id, ids.a); assert.ok('last_seen_at' in mine[0])
// 취향 표는 본인 것만 직접 읽힌다
assert.deepEqual((await as('a', `select user_id from public.user_artists`)).rows.map((r) => r.user_id), [ids.a])
// 스토리지: 비회원은 사진을 못 올리고, 회원은 본인 경로를 읽을 수 있어 지울 수 있다
await assert.rejects(as('c', `insert into storage.objects (bucket_id, name) values ('public-media', $1)`, [`${ids.c}/x.png`]))
await as('a', `insert into storage.objects (bucket_id, name) values ('public-media', $1)`, [`${ids.a}/x.png`])
assert.equal((await as('a', `delete from storage.objects where name = $1`, [`${ids.a}/x.png`])).affectedRows, 1)
// 닉네임 허용 문자
await assert.rejects(as('a', `update public.profiles set nickname = '"><img>' where id = $1`, [ids.a]), /profiles_nickname_chars/)
await as('a', `update public.profiles set nickname = 'あいう 팬_1' where id = $1`, [ids.a])
await assert.rejects(as('a', `update public.profiles set nickname = '덕친😀' where id = $1`, [ids.a]), /profiles_nickname_chars/) // 이모지 불가
// 마이그 31: 규칙이 기존 행까지 적용됨(검증 완료). 가입 때 자동 닉네임(익명의 팬0000·덕친0000)은 규칙에 맞는다
assert.equal((await db.query(`select convalidated from pg_constraint where conname = 'profiles_nickname_chars'`)).rows[0].convalidated, true)
assert.equal((await db.query(`select count(*)::int n from public.profiles where nickname !~ '^[가-힣ㄱ-ㅎㅏ-ㅣぁ-ゖァ-ヺー一-龯A-Za-z0-9 _.\\-]+$'`)).rows[0].n, 0)

// friend flow
// 보낸 요청 취소: 보낸 사람만, 취소 뒤 다시 보낼 수 있다 (행은 cancelled 로 남아 하루 한도에 계속 센다)
const first = (await as('a', `select public.send_friend_request($1) as id`, [ids.b])).rows[0].id
await assert.rejects(as('b', `select public.cancel_friend_request($1)`, [ids.a]), /not_found/)
await as('a', `select public.cancel_friend_request($1)`, [ids.b])
assert.equal((await db.query(`select status from public.friend_requests where id = $1`, [first])).rows[0].status, 'cancelled')
await assert.rejects(as('a', `select public.cancel_friend_request($1)`, [ids.b]), /not_found/)
const req = await as('a', `select public.send_friend_request($1) as id`, [ids.b])
await assert.rejects(as('a', `select public.send_friend_request($1)`, [ids.b]), /duplicate/)
await assert.rejects(as('c', `select public.respond_friend_request($1, true)`, [req.rows[0].id]), /members_only/)
const room = (await as('b', `select public.respond_friend_request($1, true) as r`, [req.rows[0].id])).rows[0].r
assert.ok(room)
// 남의 프로필 카드: 취향·지난 관심 공연은 누구나, 다가오는 관심 공연은 친구만 (비회원 c 는 개수만)
const [cUp, cPast] = (await db.query(`insert into public.concerts (title, venue_name, venue_query, status) values
  ('다가올 공연', 'v', 'v', 'published'), ('지난 공연', 'v', 'v', 'published') returning id`)).rows.map((r) => r.id)
await db.query(`insert into public.concert_schedules (concert_id, starts_at) values ($1, now() + interval '10 days'), ($2, now() - interval '10 days')`, [cUp, cPast])
await as('a', `insert into public.favorites (user_id, concert_id) values ($1, $2), ($1, $3)`, [ids.a, cUp, cPast])
const cardBy = async (k) => (await as(k, `select * from public.profile_card($1)`, [ids.a])).rows[0]
assert.deepEqual((await cardBy('b')).favorite_ids.sort(), [cUp, cPast].sort())
const guestView = await cardBy('c')
assert.deepEqual(guestView.favorite_ids, [cPast]); assert.equal(guestView.upcoming_count, 1)
assert.equal(guestView.artist_ids.length, 1); assert.ok(!('last_seen_at' in guestView))
assert.equal((await cardBy('a')).favorite_ids.length, 2)
await as('a', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'hi')`, [room, ids.a])
await assert.rejects(as('c', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'x')`, [room, ids.c]))
assert.equal((await as('c', `select * from public.messages where room_id = $1`, [room])).rows.length, 0)
const rooms = await as('b', `select * from public.list_my_rooms()`)
assert.equal(rooms.rows[0].unread, 1)
await as('b', `select public.mark_room_read($1)`, [room])
assert.equal((await as('b', `select * from public.list_my_rooms()`)).rows[0].unread, 0)

// block cuts sending
await as('b', `select public.block_user($1)`, [ids.a])
await assert.rejects(as('a', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'hi2')`, [room, ids.a]))
assert.equal((await as('a', `select * from public.list_my_rooms()`)).rows[0].can_send, false)
await assert.rejects(as('a', `select public.send_friend_request($1)`, [ids.b]), /unavailable/)

// posts + likes
await assert.rejects(as('c', `insert into public.posts (author_id, title, body) values ($1, 't', 'b')`, [ids.c])) // 비회원은 글쓰기 불가
const post = await db.query(`insert into public.posts (author_id, title, body, tags) values ($1, 't', 'b', '{후기}') returning id`, [ids.c])
const pid = post.rows[0].id
assert.equal((await as('a', `select public.toggle_post_like($1) as v`, [pid])).rows[0].v, true)
assert.equal((await as('a', `select public.toggle_post_like($1) as v`, [pid])).rows[0].v, false)
await as('a', `insert into public.comments (post_id, author_id, body) values ($1, $2, 'c')`, [pid, ids.a])
// 비회원은 글·댓글 작성자만 보인다 (b 는 아무것도 안 써서 안 보임). 글 목록의 작성자 이름은 그대로 나온다
assert.deepEqual((await as('c', `select id from public.profiles`)).rows.map((r) => r.id).sort(), [ids.a, ids.c].sort())
assert.equal((await as('c', `select a.nickname from public.posts p join public.profiles a on a.id = p.author_id where p.id = $1`, [pid])).rows.length, 1)
assert.equal((await as('c', `select * from public.profile_card($1)`, [ids.b])).rows.length, 1) // 링크로 여는 상세 프로필은 된다
// b blocked a → b doesn't see a's comment
assert.equal((await as('b', `select * from public.comments`)).rows.length, 0)

// report snapshot
await as('b', `insert into public.reports (reporter, post_id, reason) values ($1, $2, 'spam')`, [ids.b, pid])

// support room
const sr = (await as('a', `select public.ensure_support_room() as r`)).rows[0].r
await as('a', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'help')`, [sr, ids.a])

// 운영자 화면: 일반 사용자는 검수 대기 공연·수집 목록을 보거나 바꿀 수 없고, 운영자(b)는 가능하다
const con = (await db.query(`insert into public.concerts (title, venue_name, venue_query, status, promoter) values ('검수 공연', 'v', 'v', 'review', '테스트기획') returning id`)).rows[0].id
await db.query(`insert into public.kopis_inbox (kopis_id, title) values ('PF1', 'Regallily Asia Tour')`)
assert.equal((await as('c', `select * from public.concerts where id = $1`, [con])).rows.length, 0)
// 3단계(마이그 29): 운영 표는 표 권한 자체가 없다 → RLS 이전에 permission denied
await assert.rejects(as('c', `select * from public.kopis_inbox`), /permission denied/)
await assert.rejects(as('c', `update public.concerts set status = 'published' where id = $1`, [con]), /permission denied/)
await assert.rejects(as('c', `insert into public.jpop_promoters (name) values ('가짜기획')`), /permission denied/)
await assert.rejects(as('c', `insert into public.artists (name, source) values ('가짜', 'admin')`), /permission denied/)
await assert.rejects(as('c', `select * from public.admin_search_inbox('Regal')`), /forbidden/)
await assert.rejects(as('c', `select public.admin_publish_concert($1, '{}', null)`, [con]), /forbidden/)
await db.query(`insert into public.admins (user_id) values ($1)`, [ids.b])
// 운영자도 표에 직접은 못 쓰고, 운영자 함수로만
await assert.rejects(as('b', `update public.concerts set status = 'published' where id = $1`, [con]), /permission denied/)
await assert.rejects(as('b', `select * from public.kopis_inbox`), /permission denied/)
assert.equal((await as('b', `select * from public.admin_search_inbox('regal')`)).rows.length, 1)
await as('b', `select public.admin_publish_concert($1, $2, null)`, [con, [art.rows[0].id]])
assert.equal((await db.query(`select status from public.concerts where id = $1`, [con])).rows[0].status, 'published')
assert.equal((await db.query(`select count(*)::int n from public.concert_artists where concert_id = $1`, [con])).rows[0].n, 1)
assert.equal((await db.query(`select count(*)::int n from public.jpop_promoters where name = '테스트기획'`)).rows[0].n, 1) // 게시한 공연의 기획사가 쌓인다
assert.equal((await as('b', `select public.admin_save_artist($1, 'Ado', null, null, '{레갈릴리}') as id`, [art.rows[1].id])).rows[0].id, art.rows[1].id)
assert.deepEqual((await db.query(`select aliases from public.artists where id = $1`, [art.rows[1].id])).rows[0].aliases, ['레갈릴리'])
assert.equal((await as('c', `select * from public.concerts where id = $1`, [con])).rows.length, 1) // 게시 후에는 모두에게 보인다

// 신고·제재: 운영자 함수는 일반 사용자가 부르면 거절된다
await assert.rejects(as('c', `select * from public.admin_reports()`), /forbidden/)
await assert.rejects(as('c', `select * from public.admin_inquiries()`), /forbidden/)
await assert.rejects(as('a', `select public.admin_sanction($1, 'ban', 'x')`, [ids.c]), /forbidden/)
const reps = (await as('b', `select * from public.admin_reports()`)).rows
assert.equal(reps.length, 1)
assert.equal(reps[0].kind, 'post')
assert.equal(reps[0].target_id, ids.c) // 글 신고의 대상은 글쓴이
await as('b', `select public.admin_resolve_report($1, 'resolved', true)`, [reps[0].id])
assert.equal((await db.query(`select status from public.posts where id = $1`, [pid])).rows[0].status, 'hidden')
assert.equal((await db.query(`select status from public.reports where id = $1`, [reps[0].id])).rows[0].status, 'resolved')
// 7일 이용 제한 → 글을 못 쓰고, 운영팀 대화방으로 알림을 받는다
await as('b', `select public.admin_sanction($1, 'suspend', '욕설', 7)`, [ids.c])
assert.equal((await db.query(`select status from public.profiles where id = $1`, [ids.c])).rows[0].status, 'suspended')
await assert.rejects(as('c', `insert into public.posts (author_id, title, body) values ($1, 't', 'b')`, [ids.c]))
assert.ok((await db.query(`select 1 from public.messages m join public.chat_members cm on cm.room_id = m.room_id where cm.user_id = $1 and m.body like '%7일%'`, [ids.c])).rows.length)
await assert.rejects(as('b', `select public.admin_sanction($1, 'warning', 'x')`, [ids.b]), /forbidden/) // 운영자는 제재 대상이 아니다
await assert.rejects(as('b', `select public.admin_sanction($1, 'suspend', 'x', 0)`, [ids.c]), /bad_request/)
// 기간이 끝나면 정기 작업이 제한을 푼다
await db.query(`update public.sanctions set ends_at = now() - interval '1 minute' where user_id = $1`, [ids.c])
await db.query(`select public.run_maintenance()`)
assert.equal((await db.query(`select status from public.profiles where id = $1`, [ids.c])).rows[0].status, 'active')
assert.equal((await as('b', `select * from public.admin_inquiries()`)).rows.length, 0)
// 보관 기간: 처리한 지 1년 지난 신고·제재는 지우고, 영구 제한 기록은 남긴다
await db.query(`insert into public.sanctions (user_id, level, reason, starts_at) values ($1, 'ban', '테스트', now() - interval '2 years')`, [ids.c])
await db.query(`update public.sanctions set ends_at = now() - interval '2 years' where level = 'suspend'`)
await db.query(`update public.reports set resolved_at = now() - interval '2 years' where id = $1`, [reps[0].id])
await db.query(`select public.run_maintenance()`)
assert.deepEqual((await db.query(`select level from public.sanctions where user_id = $1`, [ids.c])).rows.map((r) => r.level), ['ban'])
assert.equal((await db.query(`select count(*)::int n from public.reports`)).rows[0].n, 0)
await db.query(`delete from public.sanctions where user_id = $1`, [ids.c])
// 경고 누적: 1회 7일 제한 → 2회 14일 제한 → 3회 계정 정지
const statusOf = async () => (await db.query(`select status from public.profiles where id = $1`, [ids.c])).rows[0].status
const daysLeft = async () => (await db.query(`select round(extract(epoch from max(ends_at) - now()) / 86400)::int d from public.sanctions where user_id = $1 and level = 'suspend' and ends_at > now()`, [ids.c])).rows[0].d
await as('b', `select public.admin_sanction($1, 'warning', '욕설')`, [ids.c])
assert.equal(await statusOf(), 'suspended'); assert.equal(await daysLeft(), 7)
await db.query(`update public.sanctions set ends_at = now() - interval '1 minute' where user_id = $1 and level = 'suspend'`, [ids.c])
await db.query(`select public.run_maintenance()`)
assert.equal(await statusOf(), 'active')
await as('b', `select public.admin_sanction($1, 'warning', '욕설')`, [ids.c])
assert.equal(await statusOf(), 'suspended'); assert.equal(await daysLeft(), 14)
assert.ok((await db.query(`select 1 from public.messages m join public.chat_members cm on cm.room_id = m.room_id where cm.user_id = $1 and m.body like '%경고 2회%14일%'`, [ids.c])).rows.length)
await as('b', `select public.admin_sanction($1, 'warning', '욕설')`, [ids.c])
assert.equal(await statusOf(), 'banned')
assert.deepEqual((await db.query(`select level from public.sanctions where user_id = $1 order by starts_at, level`, [ids.c])).rows.map((r) => r.level).filter((l) => l === 'ban'), ['ban'])
await db.query(`delete from public.sanctions where user_id = $1`, [ids.c])
await db.query(`update public.profiles set status = 'active' where id = $1`, [ids.c])

// 금칙어: 글·댓글·프로필은 거절, 채팅은 가리고 원문은 운영자만
const newPost = (body) => as('a', `insert into public.posts (author_id, title, body) values ($1, '제목', $2) returning id`, [ids.a, body])
for (const bad of ['야 씨발 진짜', '씨.발', '씨 발 진짜', '씨1발', 'ㅅㅂ', 'ＦＵＣＫ'])
  await assert.rejects(newPost(bad), /blocked_word/, bad)
const okPost = (await newPost('7시 발표 예정, 시발점, 등신대 굿즈, 다시 발매')).rows[0].id // 오탐 없음
await assert.rejects(as('a', `insert into public.comments (post_id, author_id, body) values ($1, $2, '병.신')`, [okPost, ids.a]), /blocked_word/)
await assert.rejects(as('a', `update public.profiles set nickname = '보지' where id = $1`, [ids.a]), /blocked_word/)
await as('a', `update public.profiles set bio = '보지 마세요' where id = $1`, [ids.a]) // exact 단어는 닉네임 전체일 때만
await as('a', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'ㅋㅋ 씨발 뭐야')`, [sr, ids.a])
await as('a', `insert into public.messages (room_id, sender_id, body) values ($1, $2, '씨 발')`, [sr, ids.a])
const masked = (await db.query(`select m.id, m.body, o.body as orig from public.messages m left join public.message_originals o on o.message_id = m.id
  where m.room_id = $1 and m.sender_id = $2 order by m.created_at, m.body`, [sr, ids.a])).rows.filter((r) => r.orig)
assert.deepEqual(masked.map((r) => r.body).sort(), ['* *', 'ㅋㅋ ** 뭐야'])
await assert.rejects(as('a', `select * from public.message_originals`)) // 당사자도 원문을 못 읽는다
await as('a', `insert into public.reports (reporter, message_id, reason) values ($1, $2, 'abuse')`, [ids.a, masked[0].id])
assert.equal((await db.query(`select content_snapshot from public.reports where message_id = $1`, [masked[0].id])).rows[0].content_snapshot, masked[0].orig)
// 목록은 운영자만 읽고 고친다. 넣을 때 정규화된다
await assert.rejects(as('c', `select * from public.banned_words`), /permission denied/)
await assert.rejects(as('c', `insert into public.banned_words (word) values ('x')`), /permission denied/)
await assert.rejects(as('c', `select * from public.admin_test_text('x')`), /forbidden/)
await assert.rejects(as('c', `select public.admin_words()`), /forbidden/)
await assert.rejects(as('c', `select public.admin_add_word('x', false)`), /forbidden/)
await as('b', `select public.admin_add_word(' 발 표 ', false)`)
await assert.rejects(as('b', `select public.admin_add_word('발표', false)`), /word_exists/) // 정규화 후 같은 단어
assert.equal((await as('b', `select * from public.admin_test_text('7시 발표')`)).rows[0].word, '발표')
const words = (await as('b', `select public.admin_words() as w`)).rows[0].w
assert.ok(words.banned.some((x) => x.word === '발표')); assert.ok(Array.isArray(words.allowed))
await as('b', `select public.admin_add_word('발표회', true)`)
await as('b', `select public.admin_delete_word(true, '발표회')`)
assert.ok(!(await as('b', `select public.admin_words() as w`)).rows[0].w.allowed.includes('발표회'))
// 단어가 늘어도 이미 있는 글을 가릴 수 있다 (바뀐 칸만 검사). 운영자도 글 표에 직접 쓰진 못하고, 숨김은 운영자 함수(서버 권한)로 한다
await assert.rejects(as('b', `update public.posts set status = 'hidden' where id = $1`, [okPost]), /permission denied/)
await db.query(`update public.posts set status = 'hidden' where id = $1`, [okPost])
await db.query(`delete from public.reports where message_id = $1`, [masked[0].id])

// 로그인 아이디: 이메일 가입자만 아이디 만들기 대상. 네이버·카카오(external_ids)·아이디 있음은 제외
assert.ok(prof.rows.find((p) => p.id === ids.a).nickname.startsWith('덕친'), '닉네임 기본값에 이메일이 들어가지 않는다')
await db.query(`insert into auth.identities (user_id, provider) values ($1, 'email'), ($2, 'email')`, [ids.a, ids.b])
assert.deepEqual((await as('a', `select * from public.my_login()`)).rows[0], { social: null, has_login_id: false, needs_login_id: true })
assert.equal((await as('c', `select * from public.my_login()`)).rows[0].needs_login_id, false) // 비회원
await db.query(`insert into public.login_ids (user_id, id_hmac, id_enc) values ($1, 'h-a', 'v1:x:y')`, [ids.a])
assert.deepEqual((await as('a', `select * from public.my_login()`)).rows[0], { social: null, has_login_id: true, needs_login_id: false })
await db.query(`insert into public.external_ids (provider, subject_hmac, subject_enc, user_id) values ('kakao', 'k-b', 'v1:x:y', $1)`, [ids.b])
assert.deepEqual((await as('b', `select * from public.my_login()`)).rows[0], { social: 'kakao', has_login_id: false, needs_login_id: false })
await assert.rejects(db.query(`insert into public.login_ids (user_id, id_hmac, id_enc) values ($1, 'h-a', 'v1:x:y')`, [ids.b]), /duplicate/)
// 아이디 로그인: 맞는 비밀번호만 사용자 id. 앱은 이 함수를 부를 수 없다
await db.query(`update auth.users set encrypted_password = 'h:pw1' where id = $1`, [ids.a])
// 메일 인증 전에는 비밀번호가 맞아도 로그인되지 않는다 (남의 이메일로 가입해 로그인하는 것을 막는다)
assert.equal((await db.query(`select public.check_login('h-a', 'pw1') as u`)).rows[0].u, null)
await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [ids.a])
assert.equal((await db.query(`select public.check_login('h-a', 'pw1') as u`)).rows[0].u, ids.a)
assert.equal((await db.query(`select public.check_login('h-a', 'pw2') as u`)).rows[0].u, null)
assert.equal((await db.query(`select public.check_login('nope', 'pw1') as u`)).rows[0].u, null)
assert.equal((await db.query(`select * from public.login_id_by_email('A@X.COM')`)).rows[0].user_id, ids.a)
await assert.rejects(as('a', `select public.check_login('h-a', 'pw1')`), /permission denied/)
await assert.rejects(as('a', `select * from public.login_id_by_email('a@x.com')`), /permission denied/)
// 앱(anon·authenticated)은 아이디·외부 식별값·토큰·실패 기록 표를 읽지도 쓰지도 못한다
assert.equal((await db.query(`select public.email_registered('A@X.com') as r`)).rows[0].r, true)
assert.equal((await db.query(`select public.email_registered('nobody@x.com') as r`)).rows[0].r, false)
await assert.rejects(as('a', `select public.email_registered('a@x.com')`), /permission denied/)
for (const t of ['login_ids', 'external_ids', 'provider_tokens', 'login_attempts', 'email_codes'])
  await assert.rejects(as('a', `select * from public.${t}`), /permission denied/)
await assert.rejects(as('a', `insert into public.login_attempts (key) values ('x')`), /permission denied/)

// account deletion: delete a only; b, c data untouched
await as('a', `insert into public.reports (reporter, target_user, reason) values ($1, $2, 'spam')`, [ids.a, ids.c]) // 신고자는 자기 신고를 읽을 수 없다(returning 불가)
const repByA = (await db.query(`select id from public.reports where reporter = $1`, [ids.a])).rows[0].id
const before = (await db.query(`select count(*)::int n from public.profiles`)).rows[0].n
await db.query(`delete from auth.users where id = $1`, [ids.a])
assert.equal((await db.query(`select count(*)::int n from public.profiles`)).rows[0].n, before - 1)
assert.equal((await db.query(`select count(*)::int n from public.comments`)).rows[0].n, 0)
assert.equal((await db.query(`select count(*)::int n from public.posts`)).rows[0].n, 1)
// 탈퇴한 a 가 낸 신고는 남고 신고자 연결만 끊긴다
assert.equal((await db.query(`select reporter from public.reports where id = $1`, [repByA])).rows[0].reporter, null)
assert.equal((await db.query(`select count(*)::int n from public.user_artists where user_id = $1`, [ids.b])).rows[0].n, 1)
assert.equal((await db.query(`select count(*)::int n from public.login_ids`)).rows[0].n, 0) // 탈퇴하면 아이디도 지워진다
// 예매 오픈일 제보: 회원만, 하루 10건, 같은 공연 대기 1건 → 운영자 승인 시 공연에 반영·제보자에게 알림
ids.d = (await db.query(`insert into auth.users (email) values ('d@x.com') returning id`)).rows[0].id
await db.query(`insert into auth.identities (user_id, provider) values ($1, 'email')`, [ids.d])
await db.query(`update public.profiles set is_guest = false where id = $1`, [ids.d])
const soon = new Date(Date.now() + 7 * 86400e3).toISOString()
await as('d', `select public.submit_ticket_tip($1, $2, 'https://example.com/notice')`, [con, soon])
await assert.rejects(as('d', `select public.submit_ticket_tip($1, $2, 'https://example.com/2')`, [con, soon]), /tip_exists/)
await assert.rejects(as('d', `select public.submit_ticket_tip($1, $2, 'javascript:alert(1)')`, [con, soon]), /tip_bad_url|tip_exists/)
await assert.rejects(as('d', `select public.submit_ticket_tip($1, now() + interval '3 years', 'https://e.com')`, [con]), /tip_bad_date/)
await assert.rejects(as('c', `select public.submit_ticket_tip($1, $2, 'https://e.com')`, [con, soon]), /members_only/)
await assert.rejects(as('d', `select * from public.ticket_open_tips`), /permission denied/)
await assert.rejects(as('d', `select * from public.admin_ticket_tips()`), /forbidden/)
const tips = (await as('b', `select * from public.admin_ticket_tips()`)).rows
assert.equal(tips.length, 1); assert.equal(tips[0].status, 'pending'); assert.equal(tips[0].current_open_at, null)
await as('b', `select public.admin_resolve_ticket_tip($1, true)`, [tips[0].id])
assert.equal(new Date((await db.query(`select ticket_open_at from public.concerts where id = $1`, [con])).rows[0].ticket_open_at).toISOString(), soon)
assert.equal((await db.query(`select status from public.ticket_open_tips where id = $1`, [tips[0].id])).rows[0].status, 'approved')
assert.ok((await db.query(`select 1 from public.messages m join public.chat_members cm on cm.room_id = m.room_id where cm.user_id = $1 and m.body like '%예매 오픈일%'`, [ids.d])).rows.length)
await assert.rejects(as('b', `select public.admin_resolve_ticket_tip($1, false)`, [tips[0].id]), /not_found/) // 이미 처리됨

// 운영자 전체 사용자: 검색·전체 수·로그인 방식, 운영자만
// 회원·비회원 칸 분리: 기본은 회원만, guests=true 면 비회원만
const users = (await as('b', `select * from public.admin_users('', 50, 0)`)).rows
assert.ok(users.length >= 2); assert.equal(Number(users[0].total), users.length)
assert.ok(users.every((u) => !u.is_guest))
assert.equal(users.find((u) => u.id === ids.d).login, 'email')
const guestRows = (await as('b', `select * from public.admin_users('', 50, 0, true)`)).rows
assert.ok(guestRows.length >= 1 && guestRows.every((u) => u.is_guest))
assert.equal(guestRows.find((u) => u.id === ids.c).login, 'guest')
assert.equal(users.find((u) => u.id === ids.b).is_admin, true)
const dNick = users.find((u) => u.id === ids.d).nickname
assert.deepEqual((await as('b', `select id from public.admin_users($1)`, [dNick])).rows.map((r) => r.id), [ids.d])
const stats = (await as('b', `select * from public.admin_user_stats()`)).rows[0]
assert.ok(Number(stats.members) >= 2 && Number(stats.guests) >= 1)
await assert.rejects(as('d', `select * from public.admin_users()`), /forbidden/)
// 비회원: 14일 무접속이면 정기 작업이 지운다. 회원·최근 접속 비회원은 그대로
const g1 = (await db.query(`insert into auth.users (is_anonymous) values (true) returning id`)).rows[0].id
const g2 = (await db.query(`insert into auth.users (is_anonymous) values (true) returning id`)).rows[0].id
await db.query(`update public.profiles set last_seen_at = now() - interval '15 days' where id = any($1)`, [[g1, ids.d]])
await db.query(`update public.profiles set last_seen_at = now() - interval '13 days' where id = $1`, [g2])
assert.equal((await db.query(`select public.cleanup_guests() as n`)).rows[0].n, 1)
assert.equal((await db.query(`select count(*)::int n from public.profiles where id = any($1)`, [[g1, g2, ids.d]])).rows[0].n, 2)
assert.ok((await db.query(`select nickname from public.profiles where id = $1`, [g2])).rows[0].nickname.startsWith('익명의 팬'))
await assert.rejects(as('d', `select public.cleanup_guests()`), /permission denied/)
// 운영자 글 삭제: 사유와 함께 지우고 작성자에게 알림, 대기 신고는 조치 완료. 일반 회원은 불가
await db.query(`update public.profiles set community_agreed_at = now(), profile_setup_done = true where id = $1`, [ids.d])
const dPost = (await as('d', `insert into public.posts (author_id, title, body) values ($1, '삭제될 글', '본문') returning id`, [ids.d])).rows[0].id
await db.query(`insert into public.reports (reporter, target_user, post_id, reason) values ($1, $2, $3, 'spam')`, [ids.b, ids.d, dPost])
await assert.rejects(as('d', `select public.admin_delete_post($1, '스팸')`, [dPost]), /forbidden/)
await assert.rejects(as('b', `select public.admin_delete_post($1, ' ')`, [dPost]), /bad_request/)
await as('b', `select public.admin_delete_post($1, '스팸·홍보')`, [dPost])
assert.equal((await db.query(`select count(*)::int n from public.posts where id = $1`, [dPost])).rows[0].n, 0)
assert.equal((await db.query(`select status from public.reports where target_user = $1 order by created_at desc limit 1`, [ids.d])).rows[0].status, 'resolved')
assert.ok((await db.query(`select 1 from public.messages m join public.chat_members cm on cm.room_id = m.room_id where cm.user_id = $1 and m.body like '%글이 삭제됐어요%삭제될 글%'`, [ids.d])).rows.length)
await assert.rejects(as('b', `select public.admin_delete_post($1, '스팸')`, [dPost]), /not_found/)

// 운영자 사용자 상세·제재 이력
const ud = (await as('b', `select * from public.admin_user($1)`, [ids.d])).rows[0]
assert.equal(ud.login, 'email'); assert.equal(ud.reports_against, 1); assert.equal(ud.posts, 0)
await as('b', `select public.admin_sanction($1, 'warning', '테스트')`, [ids.d])
assert.deepEqual((await as('b', `select level from public.admin_user_sanctions($1)`, [ids.d])).rows.map((r) => r.level).sort(), ['suspend', 'warning'])
await assert.rejects(as('d', `select * from public.admin_user($1)`, [ids.d]), /forbidden|account_restricted/)
// 대댓글: 한 단계로 붙고, 다른 글의 댓글에는 못 단다. 원 댓글을 지우면 답글도 지워진다
await db.query(`update public.profiles set status = 'active' where id = $1`, [ids.d])
await db.query(`delete from public.sanctions where user_id = $1`, [ids.d])
const rp = (await as('d', `insert into public.posts (author_id, title, body) values ($1, '대댓글 글', '본문') returning id`, [ids.d])).rows[0].id
const root = (await as('d', `insert into public.comments (post_id, author_id, body) values ($1, $2, '원 댓글') returning id`, [rp, ids.d])).rows[0].id
const r1 = (await as('d', `insert into public.comments (post_id, author_id, body, parent_id, reply_to) values ($1, $2, '답글', $3, $2) returning id, parent_id`, [rp, ids.d, root])).rows[0]
assert.equal(r1.parent_id, root)
const r2 = (await as('d', `insert into public.comments (post_id, author_id, body, parent_id, reply_to) values ($1, $2, '답글의 답글', $3, $2) returning parent_id, reply_to`, [rp, ids.d, r1.id])).rows[0]
assert.equal(r2.parent_id, root); assert.equal(r2.reply_to, ids.d)
const other = (await as('d', `insert into public.posts (author_id, title, body) values ($1, '다른 글', '본문') returning id`, [ids.d])).rows[0].id
await assert.rejects(as('d', `insert into public.comments (post_id, author_id, body, parent_id) values ($1, $2, 'x', $3)`, [other, ids.d, root]), /bad_request/)
assert.equal((await db.query(`select comment_count from public.posts where id = $1`, [rp])).rows[0].comment_count, 3)
await as('d', `delete from public.comments where id = $1`, [root])
assert.equal((await db.query(`select count(*)::int n from public.comments where post_id = $1`, [rp])).rows[0].n, 0)
// 글·댓글 수정: 작성자 본인만, 함수로만. 다른 회원(b)·비회원(c)은 못 고치고, 표 직접 수정도 막힌다
const ec = (await as('d', `insert into public.comments (post_id, author_id, body) values ($1, $2, '원래 댓글') returning id`, [rp, ids.d])).rows[0].id
await as('d', `select public.edit_post($1, '고친 제목', '고친 내용', '{후기}')`, [rp])
await as('d', `select public.edit_comment($1, '고친 댓글')`, [ec])
const edited = (await db.query(`select p.title, p.edited_at, c.body from public.posts p join public.comments c on c.post_id = p.id where c.id = $1`, [ec])).rows[0]
assert.equal(edited.title, '고친 제목'); assert.equal(edited.body, '고친 댓글'); assert.ok(edited.edited_at)
await assert.rejects(as('b', `select public.edit_post($1, 'x', 'x', '{}')`, [rp]), /not_found/)
await assert.rejects(as('b', `select public.edit_comment($1, 'x')`, [ec]), /not_found/)
await assert.rejects(as('c', `select public.edit_comment($1, 'x')`, [ec]), /members_only/)
const ep = (await as('d', `insert into public.posts (author_id, title, body) values ($1, '남의 글 테스트', '본문') returning id`, [ids.d])).rows[0].id
ids.e = (await db.query(`insert into auth.users (email) values ('e@x.com') returning id`)).rows[0].id
await db.query(`update public.profiles set is_guest = false, community_agreed_at = now(), profile_setup_done = true where id = $1`, [ids.e])
await assert.rejects(as('e', `update public.posts set title = 'hack' where id = $1`, [ep]), /permission denied/)
await assert.rejects(as('d', `update public.posts set title = 'direct' where id = $1`, [ep]), /permission denied/) // 본인도 표 직접 수정은 불가 (상태·추천 수 보호, 마이그 29 로 권한 자체 회수)
await assert.rejects(as('e', `update public.comments set body = 'hack' where id = $1`, [ec]), /permission denied/)
await assert.rejects(as('e', `select public.edit_post($1, 'x', 'x', '{}')`, [ep]), /not_found/)
await assert.rejects(as('d', `select public.edit_post($1, '씨발', '본문', '{}')`, [ep]), /blocked_word/)
await db.query(`update public.posts set status = 'hidden' where id = $1`, [ep])
await assert.rejects(as('d', `select public.edit_post($1, '가려진 글 수정', '본문', '{}')`, [ep]), /not_found/) // 운영자가 가린 글은 못 고친다
// 정지 계정: 캘린더(관심 공연·아티스트)와 문의는 되고, 친구·DM·커뮤니티는 안 된다
const dmReq = (await as('d', `select public.send_friend_request($1) as id`, [ids.e])).rows[0].id
const dm = (await as('e', `select public.respond_friend_request($1, true) as r`, [dmReq])).rows[0].r
await db.query(`update public.profiles set status = 'banned' where id = $1`, [ids.e])
await as('e', `insert into public.favorites (user_id, concert_id) values ($1, $2)`, [ids.e, cUp])
await as('e', `insert into public.user_artists (user_id, artist_id) values ($1, $2)`, [ids.e, art.rows[0].id])
const eSupport = (await as('e', `select public.ensure_support_room() as r`)).rows[0].r
await as('e', `insert into public.inquiries (user_id, category, body) values ($1, 'account', '제재 이의 제기')`, [ids.e])
await as('e', `insert into public.messages (room_id, sender_id, body) values ($1, $2, '문의 추가')`, [eSupport, ids.e])
await assert.rejects(as('e', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'dm')`, [dm, ids.e])) // 친구 DM 은 막힘
await assert.rejects(as('e', `select public.send_friend_request($1)`, [ids.b]), /account_restricted/)
await assert.rejects(as('e', `insert into public.comments (post_id, author_id, body) values ($1, $2, 'x')`, [rp, ids.e]))
await as('d', `insert into public.messages (room_id, sender_id, body) values ($1, $2, 'active dm')`, [dm, ids.d]) // 상대(활성 회원)는 그대로
// 비회원: 닉네임·사진·배너는 못 바꾸고 소개글은 된다. 운영자 SQL 정리(본인이 아닌 변경)는 된다
const g = (await db.query(`insert into auth.users (is_anonymous) values (true) returning id`)).rows[0].id
ids.g = g
await assert.rejects(as('g', `update public.profiles set nickname = '새닉네임' where id = $1`, [g]), /members_only/)
await assert.rejects(as('g', `update public.profiles set banner_url = 'https://evil.example/x.png' where id = $1`, [g]), /members_only/)
await assert.rejects(as('g', `update public.profiles set avatar_url = 'https://evil.example/x.png' where id = $1`, [g]), /members_only/)
await as('g', `update public.profiles set bio = '소개', last_seen_at = now() where id = $1`, [g])
await db.exec(`select set_config('request.uid', '', false)`) // SQL Editor 처럼 로그인 사용자 없음
await db.query(`update public.profiles set nickname = '익명의 팬0001' where id = $1`, [g])
// ── 2단계 (마이그 27) ──
// I2: 동의 시각은 직접 못 바꾸고, 함수는 동의 기록과 함께 찍는다
await assert.rejects(as('d', `update public.profiles set community_agreed_at = now() where id = $1`, [ids.d]), /permission denied/)
const consentCount = async () => (await db.query(`select count(*)::int n from public.consents where user_id = $1 and item = 'community'`, [ids.d])).rows[0].n
const consentsBefore = await consentCount()
await as('d', `select public.agree_community('v2')`)
assert.equal(await consentCount(), consentsBefore + 1)
// M7·M8: 운영자(b)가 musicbrainz 라고 보내도 admin 으로 저장되고, 누가 했는지 남는다. 운영 기록은 앱에서 못 읽는다
await assert.rejects(as('b', `insert into public.artists (name, source) values ('출처 위조', 'musicbrainz')`), /permission denied/) // 3단계: 표 직접 쓰기 불가
const fakeArtId = (await as('b', `select public.admin_save_artist(null, '출처 위조', null, null, '{}') as id`)).rows[0].id
const fakeArt = (await db.query(`select id, source, created_by from public.artists where id = $1`, [fakeArtId])).rows[0]
assert.equal(fakeArt.source, 'admin'); assert.equal(fakeArt.created_by, ids.b)
await as('b', `select public.admin_publish_concert($1, '{}', now())`, [cUp])
const stamped = (await db.query(`select source, updated_by from public.concerts where id = $1`, [cUp])).rows[0]
assert.equal(stamped.source, 'admin'); assert.equal(stamped.updated_by, ids.b)
const audits = (await db.query(`select table_name, action from public.admin_audit_log where actor = $1`, [ids.b])).rows
assert.ok(audits.some((r) => r.table_name === 'artists' && r.action === 'insert'))
assert.ok(audits.some((r) => r.table_name === 'concerts' && r.action === 'update'))
await assert.rejects(as('b', `select * from public.admin_audit_log`), /permission denied/)
await db.exec(`select set_config('request.uid', '', false)`) // 수집 함수처럼 로그인 사용자 없음 → 보낸 출처 그대로
await db.query(`update public.artists set name = '수집 갱신', source = 'musicbrainz' where id = $1`, [fakeArt.id])
assert.equal((await db.query(`select source from public.artists where id = $1`, [fakeArt.id])).rows[0].source, 'musicbrainz')
// L7: 내 메시지만 지운다. 화면엔 '삭제된 메시지예요', 원문은 운영자용으로 남아 나중에 신고해도 스냅숏에 원문이 들어간다
const dMsg = (await db.query(`select id from public.messages where room_id = $1 and sender_id = $2 and body = 'active dm'`, [dm, ids.d])).rows[0].id
await assert.rejects(as('e', `select public.delete_my_message($1)`, [dMsg]), /not_found/)
assert.equal((await as('d', `select public.delete_my_message($1) as p`, [dMsg])).rows[0].p, null)
const gone = (await db.query(`select body, deleted_at from public.messages where id = $1`, [dMsg])).rows[0]
assert.equal(gone.body, '삭제된 메시지예요'); assert.ok(gone.deleted_at)
await assert.rejects(as('d', `select public.delete_my_message($1)`, [dMsg]), /not_found/)
await db.query(`insert into public.reports (reporter, message_id, reason) values ($1, $2, 'abuse')`, [ids.e, dMsg])
assert.equal((await db.query(`select content_snapshot from public.reports where message_id = $1`, [dMsg])).rows[0].content_snapshot, 'active dm')
await db.query(`delete from public.reports where message_id = $1`, [dMsg])
// 정지 계정(e): 사용자 검색·추천 0건, 프로필 수정 불가(알림 설정은 됨), 친구 DM 방은 보낼 수 없음 표시, 운영팀 방은 가능
assert.equal((await as('e', `select * from public.search_users('')`)).rows.length, 0)
assert.equal((await as('e', `select * from public.recommend_friends(10)`)).rows.length, 0)
await assert.rejects(as('e', `update public.profiles set bio = '이의 있음' where id = $1`, [ids.e]), /account_restricted/)
await as('e', `update public.profiles set notify_like = false where id = $1`, [ids.e])
const eRooms = (await as('e', `select room_id, kind, can_send from public.list_my_rooms()`)).rows
assert.equal(eRooms.find((r) => r.room_id === dm).can_send, false)
assert.equal(eRooms.find((r) => r.kind === 'support').can_send, true)
// ── 마이그 30 ──
// 답변 완료 문의만 운영자가 지운다. 대기 중은 거절, 일반 회원은 forbidden, 지운 사실은 운영 기록에
const eInq = (await db.query(`select id from public.inquiries where user_id = $1 order by created_at desc limit 1`, [ids.e])).rows[0].id
await assert.rejects(as('b', `select public.admin_delete_inquiry($1)`, [eInq]), /not_answered/)
await db.query(`update public.inquiries set status = 'answered', answer = '답변', answered_at = now() where id = $1`, [eInq])
await assert.rejects(as('d', `select public.admin_delete_inquiry($1)`, [eInq]), /forbidden/)
await as('b', `select public.admin_delete_inquiry($1)`, [eInq])
assert.equal((await db.query(`select count(*)::int n from public.inquiries where id = $1`, [eInq])).rows[0].n, 0)
assert.equal((await db.query(`select count(*)::int n from public.admin_audit_log where table_name = 'inquiries' and action = 'delete' and actor = $1`, [ids.b])).rows[0].n, 1)
await assert.rejects(as('b', `select public.admin_delete_inquiry($1)`, [eInq]), /not_found/)
// 남의 차단 관계는 함수로도 알아낼 수 없다 (당사자만 true)
await db.query(`insert into public.blocks (blocker, blocked) values ($1, $2)`, [ids.d, ids.e])
assert.equal((await as('d', `select public.is_blocked_between($1, $2) as v`, [ids.d, ids.e])).rows[0].v, true)
assert.equal((await as('b', `select public.is_blocked_between($1, $2) as v`, [ids.d, ids.e])).rows[0].v, false)
await db.query(`delete from public.blocks where blocker = $1 and blocked = $2`, [ids.d, ids.e])
// 비로그인(anon) 요청은 회원 전용 함수를 못 부른다. 공연 공개 정책이 쓰는 is_admin() 은 그대로
await db.exec(`reset role; select set_config('request.uid', '', false); set role anon`)
try {
  await assert.rejects(db.query(`select public.my_profile()`), /permission denied/)
  await assert.rejects(db.query(`select public.is_member()`), /permission denied/)
  assert.ok((await db.query(`select count(*) from public.concerts where status = 'published'`)).rows.length)
} finally { await db.exec('reset role') }
// 마이그 32: 비밀번호 재설정 뒤 모든 로그인 끊기 — 서버 키만, 그 사람 세션만
await db.query(`insert into auth.sessions (user_id) values ($1), ($1), ($2)`, [ids.d, ids.b])
await assert.rejects(as('d', `select public.revoke_user_sessions($1)`, [ids.b]), /permission denied/)
await db.query(`select public.revoke_user_sessions($1)`, [ids.d])
assert.deepEqual((await db.query(`select user_id from auth.sessions`)).rows.map((r) => r.user_id), [ids.b])
// 알림 종류별 설정: 본인이 바꿀 수 있다
await as('d', `update public.profiles set notify_like = false, notify_concert = false where id = $1`, [ids.d])
assert.deepEqual((await db.query(`select notify_friend, notify_like, notify_comment, notify_concert from public.profiles where id = $1`, [ids.d])).rows[0],
  { notify_friend: true, notify_like: false, notify_comment: true, notify_concert: false })
// 마이그 33: 공지 — 운영자(b)만 올리고 지운다, 로그인한 누구나 읽는다, 직접 쓰기는 막힘
await assert.rejects(as('c', `select public.admin_post_notice('t', 'b')`), /forbidden/)
await assert.rejects(as('c', `insert into public.notices (title, body) values ('t', 'b')`), /permission denied/)
const nid = (await as('b', `select public.admin_post_notice(' 점검 안내 ', '내용') as id`)).rows[0].id
assert.equal((await as('c', `select title from public.notices where id = $1`, [nid])).rows[0].title, '점검 안내')
await assert.rejects(as('c', `select public.admin_delete_notice($1)`, [nid]), /forbidden/)
await as('b', `select public.admin_delete_notice($1)`, [nid])
assert.equal((await db.query(`select count(*)::int as n from public.notices`)).rows[0].n, 0)
// 마이그 34: 노출 기간 — 지난 시각은 거절, 앞으로의 시각은 저장
await assert.rejects(as('b', `select public.admin_post_notice('t', 'b', now() - interval '1 hour')`), /notice_bad_period/)
const nid2 = (await as('b', `select public.admin_post_notice('t', 'b', now() + interval '3 days') as id`)).rows[0].id
assert.ok((await db.query(`select ends_at from public.notices where id = $1`, [nid2])).rows[0].ends_at)
// 마이그 35: 업로드 예약 — 시각 전에는 운영자만 보고, publish_due_notices 가 시각이 되면 연다
await assert.rejects(as('b', `select public.admin_post_notice('t', 'b', now() + interval '1 hour', now() + interval '2 hours')`), /notice_bad_period/)
const sid = (await as('b', `select public.admin_post_notice('예약', 'b', null, now() + interval '1 hour') as id`)).rows[0].id
assert.equal((await as('c', `select id from public.notices where id = $1`, [sid])).rows.length, 0)
assert.equal((await as('b', `select id from public.notices where id = $1`, [sid])).rows.length, 1)
await assert.rejects(as('c', `select public.publish_due_notices()`), /permission denied/)
await db.query(`select public.publish_due_notices()`)
assert.equal((await as('c', `select id from public.notices where id = $1`, [sid])).rows.length, 0) // 아직 시각 전
await db.query(`update public.notices set starts_at = now() - interval '1 minute' where id = $1`, [sid])
await db.query(`select public.publish_due_notices()`)
assert.equal((await as('c', `select id from public.notices where id = $1`, [sid])).rows.length, 1)
// 마이그 36: 관리자 id 목록 — 로그인한 누구나(비회원 c 포함) 관리자 b 만 받는다, 로그인 안 한 요청은 못 부른다
assert.deepEqual((await as('c', `select public.admin_ids() as id`)).rows.map((r) => r.id), [ids.b])
await db.exec('set role anon')
try { await assert.rejects(db.query(`select public.admin_ids()`), /permission denied/) } finally { await db.exec('reset role') }
// 마이그 37: 메시지 수정 — 본인 글만, 금칙어는 가리고 원문 기록에 수정 내용이 붙는다
const dsr = (await as('d', `select public.ensure_support_room() as r`)).rows[0].r
const em = (await as('d', `insert into public.messages (room_id, sender_id, body) values ($1, $2, '처음') returning id`, [dsr, ids.d])).rows[0].id
await assert.rejects(as('b', `select public.edit_my_message($1, '남의 글')`, [em]), /not_found/)
await assert.rejects(as('d', `select public.edit_my_message($1, '  ')`, [em]), /bad_body/)
await as('d', `select public.edit_my_message($1, '고침 씨발')`, [em])
const editedMsg = (await db.query(`select m.body, m.edited_at, o.body as orig from public.messages m join public.message_originals o on o.message_id = m.id where m.id = $1`, [em])).rows[0]
assert.ok(editedMsg.edited_at && !editedMsg.body.includes('씨발'))
assert.equal(editedMsg.orig, '처음\n[수정] 고침 씨발')
// 마이그 38: 사진 칸은 chat-media 경로 또는 KLIPY 주소(+slug)만. 다른 외부 주소는 막는다, 공용 GIF 모음은 없어졌다
const img = (path, slug) => as('d', `insert into public.messages (room_id, sender_id, kind, image_path, gif_slug) values ($1, $2, 'image', $3, $4)`, [dsr, ids.d, path, slug])
await img(`${dsr}/${ids.d}/a.jpg`, null)
await img('https://static.klipy.com/ii/abc/def/x.webp', 'cat-dance-1')
await assert.rejects(img('https://evil.example.com/x.gif', 'cat-dance-1'), /messages_image_source/)
await assert.rejects(img('https://evil.example.com/x.gif', null), /messages_image_source/)
await assert.rejects(img('https://static.klipy.com/x.webp', null), /messages_image_source/) // slug 없는 KLIPY 주소 X
await assert.rejects(img(`${dsr}/${ids.d}/a.jpg`, 'cat'), /messages_image_source/) // slug 는 KLIPY 주소에만
assert.equal((await db.query(`select to_regclass('public.gifs') as t`)).rows[0].t, null)
// 마이그 39: 모든 FK 는 그 첫 컬럼으로 시작하는 (부분 인덱스 아닌) 인덱스가 있어야 한다 — 부모 삭제 때 자식 표 전체 스캔 방지
const fkNoIdx = (await db.query(`select c.conrelid::regclass || '.' || a.attname as col from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1] and i.indpred is null)`)).rows.map((r) => r.col)
assert.deepEqual(fkNoIdx, [], `FK 인덱스 없음: ${fkNoIdx.join(', ')}`)
// 마이그 40: 예매 링크 클릭 — 공연에 있는 링크만, 같은 사람·링크 10분 1회, 집계는 운영자만, 표 직접 접근 없음
await db.query(`insert into public.ticket_links (concert_id, vendor, url) values ($1, '예스24', 'https://ticket.yes24.com/x')`, [con])
for (const k of ['d', 'd', 'c']) await as(k, `select public.log_ticket_click($1, 'https://ticket.yes24.com/x')`, [con])
await as('d', `select public.log_ticket_click($1, 'https://evil.example.com')`, [con]) // 없는 링크는 무시
const clk = (await as('b', `select * from public.admin_ticket_clicks(30)`)).rows
assert.deepEqual(clk.map((r) => [r.vendor, Number(r.clicks), Number(r.users)]), [['예스24', 2, 2]])
await assert.rejects(as('d', `select * from public.admin_ticket_clicks(30)`), /forbidden/)
await assert.rejects(as('d', `select * from public.ticket_link_clicks`), /permission denied/)
await db.exec('set role anon')
try { await assert.rejects(db.query(`select public.log_ticket_click($1, 'https://ticket.yes24.com/x')`, [con]), /permission denied/) } finally { await db.exec('reset role') }

// ── 마이그 42: 내 문의 내역 — 본인 문의만, 답변까지 보인다 ──
const myInq = await db.query(`insert into public.inquiries (user_id, category, body) values ($1, 'bug', '문의 하나') returning id`, [ids.d])
await db.query(`insert into public.inquiries (user_id, category, body, status, answer, answered_at) values ($1, 'etc', '문의 둘', 'answered', '답변이에요', now())`, [ids.d])
const dInq = (await as('d', `select * from public.my_inquiries()`)).rows
assert.deepEqual(dInq.map((r) => [r.body, r.status, r.answer]).sort(), [['문의 둘', 'answered', '답변이에요'], ['문의 하나', 'open', null]])
assert.ok(!(await as('c', `select * from public.my_inquiries()`)).rows.some((r) => r.id === myInq.rows[0].id)) // 남의 문의는 안 보인다
await db.exec('set role anon')
try { await assert.rejects(db.query(`select * from public.my_inquiries()`), /permission denied/) } finally { await db.exec('reset role') }
console.log('ALL OK')
