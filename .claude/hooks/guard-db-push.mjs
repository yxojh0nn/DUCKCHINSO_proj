// PreToolUse 훅: Claude 가 supabase db push 를 직접 부르면 막고, 사용자에게 백업 여부를 물은 뒤 pnpm db:push 로 하게 한다
let input = ''
for await (const chunk of process.stdin) input += chunk
const cmd = JSON.parse(input || '{}').tool_input?.command ?? ''
// 명령 자리(줄 맨 앞, ; && | ( 뒤)에 올 때만 — 커밋 메시지·echo 속 문구는 통과
if (/(^|[;&|(])\s*(npx\s+|pnpm\s+(dlx|exec)\s+|bunx\s+)?supabase(\.exe)?\s+db\s+push/im.test(cmd)) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: '마이그레이션 적용은 백업 확인을 거쳐야 합니다. 사용자에게 "적용 전에 DB 백업을 할까요?" 라고 먼저 묻고, 답에 따라 `pnpm db:push -- --backup` 또는 `pnpm db:push -- --no-backup` 으로 실행하세요.',
    },
  }))
}
