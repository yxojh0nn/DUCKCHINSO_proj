// node --experimental-strip-types scripts/judge.test.ts [--show]
// 2026-11-04 KOPIS 후보 100건(scripts/fixtures)에 사람이 붙인 정답으로 판별 규칙을 채점한다
// 기준: J-pop 이 아닌 공연은 게시되면 안 되고(오인 0), J-pop 공연은 제외되면 안 된다(누락 0, 검수 대기는 허용)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { judgeConcert } from '../supabase/functions/_shared/kopis.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'))
const { artists, items } = read('kopis-candidates.json')
const labels: Record<string, boolean | null> = read('kopis-labels.json')

const rows = items.map((it: { id: string; title: string }) => ({ it, label: labels[it.id], v: judgeConcert(it as never, artists) }))
const count = (label: boolean, decision: string) => rows.filter((r: any) => r.label === label && r.v.decision === decision).length
const table = {
  'J-pop → 게시': count(true, 'publish'), 'J-pop → 검수 대기': count(true, 'review'), 'J-pop → 제외(누락)': count(true, 'skip'),
  '아님 → 게시(오인)': count(false, 'publish'), '아님 → 검수 대기': count(false, 'review'), '아님 → 제외': count(false, 'skip'),
}
if (process.argv.includes('--show')) {
  console.table(table)
  for (const r of rows) console.log(r.label === null ? '?' : r.label ? 'O' : 'X', r.v.decision.padEnd(7), String(r.v.score).padStart(3), r.it.title.slice(0, 50), '|', r.v.reasons.join(', '))
}
const wrong = rows.filter((r: any) => (r.label === false && r.v.decision === 'publish') || (r.label === true && r.v.decision === 'skip'))
assert.deepEqual(wrong.map((r: any) => `${r.it.title} → ${r.v.decision}`), [])
console.log(`judge ok (게시 ${table['J-pop → 게시']}, 검수 대기 ${table['J-pop → 검수 대기'] + table['아님 → 검수 대기']}, 오인 0, 누락 0)`)
