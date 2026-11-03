// 마이그레이션 검증: Supabase auth·storage 를 흉내 낸 Postgres(PGlite)에 스키마를 올리고 권한·탈퇴 범위를 확인한다
// 실행: pnpm test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const db = new PGlite()
const stub = `
create role anon; create role authenticated; create role supabase_auth_admin;
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
for (const f of ['20261103000001_init.sql', '20261103000002_rls_and_rpc.sql'])
  await db.exec(readFileSync(`${repo}supabase/migrations/${f}`, 'utf8'))
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`)
await db.exec(`grant update (nickname, bio, avatar_url, banner_url, profile_setup_done, community_agreed_at, notify_enabled, last_seen_at) on public.profiles to authenticated;`)
await db.exec(`revoke update on public.profiles from authenticated; grant update (nickname, bio, avatar_url, banner_url, profile_setup_done, community_agreed_at, notify_enabled, last_seen_at) on public.profiles to authenticated;`)

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

// account deletion: delete a only; b, c data untouched
const before = (await db.query(`select count(*)::int n from public.profiles`)).rows[0].n
await db.query(`delete from auth.users where id = $1`, [ids.a])
assert.equal((await db.query(`select count(*)::int n from public.profiles`)).rows[0].n, before - 1)
assert.equal((await db.query(`select count(*)::int n from public.comments`)).rows[0].n, 0)
assert.equal((await db.query(`select count(*)::int n from public.posts`)).rows[0].n, 1)
assert.equal((await db.query(`select count(*)::int n from public.reports`)).rows[0].n, 1)
assert.equal((await db.query(`select count(*)::int n from public.user_artists where user_id = $1`, [ids.b])).rows[0].n, 1)
console.log('ALL OK')
