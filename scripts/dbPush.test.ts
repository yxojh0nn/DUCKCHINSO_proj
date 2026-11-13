// pnpm db:push 의 '위험한 변경' 판별 확인
import assert from 'node:assert/strict'
import { risky } from './db-push.mjs'

assert.ok(risky('drop table public.gifs;'))
assert.ok(risky('alter table public.x drop column y;'))
assert.ok(risky('delete from public.reports where true;'))
assert.ok(risky('truncate public.logs;'))
assert.ok(risky('alter table public.t rename column a to b;'))
assert.ok(risky('alter table public.t alter column a type bigint;'))
assert.ok(!risky('create index if not exists a_idx on public.t (a);'))
assert.ok(!risky('alter table public.messages add column gif_slug text;'))
assert.ok(!risky('-- drop table 은 주석이라 무시\ncreate table public.t (id int);'))
console.log('dbPush ok')
