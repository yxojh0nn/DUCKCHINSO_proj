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
create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean default false, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema public, storage, auth to authenticated, anon;
`
await db.exec(stub)
// 표 권한은 실제 Supabase 처럼 자동으로 주지 않고 마이그레이션(20261104000004_grants)이 준 것만 쓴다
for (const f of ['20261103000001_init.sql', '20261103000002_rls_and_rpc.sql', '20261104000004_grants.sql', '20261105000006_admin_review.sql', '20261105000007_admin_moderation.sql', '20261105000008_retention.sql', '20261105000009_report_fixes.sql', '20261106000010_word_filter.sql'])
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
  await as(k, `update public.profiles set profile_setup_done = true, community_agreed_at = now() where id = $1`, [ids[k]])
}
// cannot escalate status
await assert.rejects(as('a', `update public.profiles set status = 'banned' where id = $1`, [ids.b]))
await assert.rejects(as('a', `update public.profiles set is_guest = true where id = $1`, [ids.a]))
// a cannot update b's bio (RLS filters → 0 rows)
const upd = await as('a', `update public.profiles set bio = 'hack' where id = $1`, [ids.b])
assert.equal(upd.affectedRows, 0)

const rec = await as('a', `select * from public.recommend_friends(10)`)
assert.equal(rec.rows.length, 2)

// friend flow
const req = await as('a', `select public.send_friend_request($1) as id`, [ids.b])
await assert.rejects(as('a', `select public.send_friend_request($1)`, [ids.b]), /duplicate/)
await assert.rejects(as('c', `select public.respond_friend_request($1, true)`, [req.rows[0].id]), /not_found/)
const room = (await as('b', `select public.respond_friend_request($1, true) as r`, [req.rows[0].id])).rows[0].r
assert.ok(room)
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
const post = await as('c', `insert into public.posts (author_id, title, body, tags) values ($1, 't', 'b', '{후기}') returning id`, [ids.c])
const pid = post.rows[0].id
assert.equal((await as('a', `select public.toggle_post_like($1) as v`, [pid])).rows[0].v, true)
assert.equal((await as('a', `select public.toggle_post_like($1) as v`, [pid])).rows[0].v, false)
await as('a', `insert into public.comments (post_id, author_id, body) values ($1, $2, 'c')`, [pid, ids.a])
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
assert.equal((await as('c', `select * from public.kopis_inbox`)).rows.length, 0)
assert.equal((await as('c', `update public.concerts set status = 'published' where id = $1`, [con])).affectedRows, 0)
await assert.rejects(as('c', `insert into public.jpop_promoters (name) values ('가짜기획')`))
await assert.rejects(as('c', `insert into public.artists (name, source) values ('가짜', 'admin')`))
await db.query(`insert into public.admins (user_id) values ($1)`, [ids.b])
assert.equal((await as('b', `select * from public.kopis_inbox`)).rows.length, 1)
assert.equal((await as('b', `update public.concerts set status = 'published', source = 'admin' where id = $1`, [con])).affectedRows, 1)
await as('b', `insert into public.concert_artists (concert_id, artist_id) values ($1, $2)`, [con, art.rows[0].id])
await as('b', `insert into public.jpop_promoters (name) values ('테스트기획')`)
await as('b', `update public.artists set aliases = '{레갈릴리}', source = 'admin' where id = $1`, [art.rows[1].id])
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
assert.equal((await as('c', `select * from public.banned_words`)).rows.length, 0)
await assert.rejects(as('c', `insert into public.banned_words (word) values ('x')`))
await assert.rejects(as('c', `select * from public.admin_test_text('x')`), /forbidden/)
await as('b', `insert into public.banned_words (word) values (' 발 표 ')`)
assert.equal((await as('b', `select * from public.admin_test_text('7시 발표')`)).rows[0].word, '발표')
// 단어가 늘어도 이미 있는 글을 운영자가 가릴 수 있다 (바뀐 칸만 검사)
await as('b', `update public.posts set status = 'hidden' where id = $1`, [okPost])
await db.query(`delete from public.reports where message_id = $1`, [masked[0].id])

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
console.log('ALL OK')
