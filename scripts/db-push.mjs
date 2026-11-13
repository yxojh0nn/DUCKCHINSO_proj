// 마이그레이션 적용 전 백업 확인: pnpm db:push [--backup | --no-backup] [supabase db push 옵션...]
// 1) 실제 DB 에 아직 안 올라간 마이그레이션을 찾고 2) 위험한 변경(drop·truncate·delete·rename·타입 변경)을 표시한 뒤
// 3) 백업할지 묻고(Y 기본) 백업이 성공해야만 4) supabase db push 를 실행한다
import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const RISKY = /\b(drop\s+(table|column|function|policy|index|trigger|type|schema|view)|truncate|delete\s+from|rename|alter\s+column\s+\S+\s+(set\s+data\s+)?type)\b/i
export const risky = (sql) => RISKY.test(sql.replace(/--.*$/gm, '')) // 주석 속 단어는 무시

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })

async function main() {
  const args = process.argv.slice(2)
  const flag = args.includes('--backup') ? 'y' : args.includes('--no-backup') ? 'n' : null
  const pushArgs = args.filter((a) => a !== '--backup' && a !== '--no-backup')
  if (!process.env.SUPABASE_DB_URL) throw new Error('.env 에 SUPABASE_DB_URL 이 없습니다 (docker/backup 설정 참고)')

  // 실제 DB 에 적용된 버전 (비밀번호는 명령줄이 아니라 환경 변수로만 컨테이너에 넘긴다)
  const q = spawnSync('docker', ['run', '--rm', '-e', 'SUPABASE_DB_URL', 'postgres:17-alpine', 'sh', '-c',
    'psql "$SUPABASE_DB_URL" -XAt -c "select version from supabase_migrations.schema_migrations"'], { encoding: 'utf8' })
  if (q.status !== 0) throw new Error('적용된 마이그레이션 목록을 못 읽었습니다: ' + q.stderr.trim())
  const applied = new Set(q.stdout.split(/\s+/).filter(Boolean))
  const pending = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && !applied.has(f.split('_')[0])).sort()

  if (!pending.length) return console.log('적용할 새 마이그레이션이 없습니다.')
  console.log('\n적용할 마이그레이션:')
  let anyRisky = false
  for (const f of pending) {
    const r = risky(readFileSync(`supabase/migrations/${f}`, 'utf8'))
    anyRisky ||= r
    console.log(`  ${r ? '⚠ 데이터 삭제·변경 포함' : '  '}  ${f}`)
  }

  let answer = flag
  if (!answer) {
    if (!process.stdin.isTTY) throw new Error('터미널이 아니라 물어볼 수 없습니다. --backup 또는 --no-backup 을 붙여 실행하세요')
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    answer = ((await rl.question(`\n${anyRisky ? '⚠ 위험한 변경이 있습니다. ' : ''}적용 전에 백업할까요? [Y/n/q(취소)] `)).trim().toLowerCase() || 'y')[0]
    rl.close()
  }
  if (answer === 'q') return console.log('취소했습니다.')
  if (answer === 'y') {
    const b = run('docker', ['compose', '--env-file', '.env', '-f', 'docker/backup/compose.yml', 'run', '--rm', 'backup'])
    if (b.status !== 0) throw new Error('백업 실패 — 마이그레이션을 적용하지 않았습니다')
  } else console.log('백업 없이 진행합니다.')

  const p = run('npx', ['supabase', 'db', 'push', ...pushArgs])
  process.exitCode = p.status ?? 1
}

if (import.meta.main) main().catch((e) => { console.error('✖ ' + e.message); process.exitCode = 1 })
