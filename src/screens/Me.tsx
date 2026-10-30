import { Link, useNavigate } from 'react-router-dom'
import { ARTISTS, MOCK_USERS, REGIONS } from '@/data/mock'
import { kstDayKey } from '@/lib/date'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Toggle } from '@/components/ui/Toggle'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 px-1 text-xs font-semibold text-muted">{title}</h2>
      <div className="rounded-2xl border border-line bg-surface px-4">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 border-b border-line py-3 text-sm last:border-0">{children}</div>
}

// 내 정보·설정 (기획서 5.5, 10장)
export default function Me() {
  const nav = useNavigate()
  const s = useAppStore()
  const now = s.now()
  const nick = (id: string) => MOCK_USERS.find((u) => u.id === id)?.nickname ?? '알 수 없음'
  const openRooms = s.rooms.filter((r) => !r.partnerLeftAt)

  return (
    <>
      <AppHeader title="내 정보" />
      <div className="flex-1 px-4 py-4">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">{s.nickname[0] ?? '덕'}</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{s.nickname}</p>
            <p className="text-xs text-muted">임시 계정 · 기기를 바꾸면 복구할 수 없어요</p>
          </div>
        </div>

        <Section title="취향">
          <Link to="/me/artists" className="flex items-center gap-3 py-3 text-sm">
            <span className="w-20 shrink-0">관심 아티스트</span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {s.myArtists.length
                ? s.myArtists.map((id) => <Tag key={id} tone="accent">{ARTISTS.find((a) => a.id === id)?.name}</Tag>)
                : <span className="text-muted">지정 안 함</span>}
            </span>
            <span className="text-muted">›</span>
          </Link>
        </Section>

        <Section title="지역·공개 범위">
          <Row>
            <span className="flex-1">지역 (시·도)</span>
            <select
              value={s.region ?? ''}
              onChange={(e) => s.setRegion(e.target.value || null)}
              className="rounded-lg border border-line bg-chip px-2 py-1.5 text-sm"
            >
              <option value="">선택 안 함</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Row>
          <Row>
            <span className="flex-1">
              내 정보 비공개
              <span className="block text-xs text-muted">켜면 다른 사람에게 지역이 "비공개"로 보여요</span>
            </span>
            <Toggle label="내 정보 비공개" checked={!s.regionPublic} onChange={(v) => s.setRegionPublic(!v)} />
          </Row>
          <Row>
            <span className="text-xs text-muted">다른 사람에게 보이는 모습: <b className="text-ink">{s.nickname} · {s.regionPublic ? (s.region ?? '지역 미설정') : '지역 비공개'}</b></span>
          </Row>
        </Section>

        <Section title="차단 목록">
          {s.blocks.length === 0 && <Row><span className="text-muted">차단한 사람이 없어요</span></Row>}
          {s.blocks.map((b) => (
            <Row key={b.userId}>
              <span className="flex-1">{nick(b.userId)} <span className="text-xs text-muted">{kstDayKey(b.at)}</span></span>
              <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => { s.unblock(b.userId); s.showToast('차단을 해제했어요') }}>해제</Button>
            </Row>
          ))}
        </Section>

        <Section title="계정">
          <Row>
            <span className="flex-1">회원가입 <span className="text-xs text-muted">(이메일·구글·카카오·애플)</span></span>
            <Tag>2차 개발</Tag>
          </Row>
          <Row>
            <span className="flex-1">동의 내역</span>
            <span className="text-xs text-muted">버전 {s.consentVersion}</span>
          </Row>
          <Row>
            <button className="text-crit" onClick={() => { if (confirm('임시 계정과 모든 기록을 삭제할까요? 복구할 수 없어요.')) { s.reset(); nav('/consent', { replace: true }) } }}>
              계정 삭제
            </button>
          </Row>
        </Section>

        <Section title="데모 도구 (프로토타입 전용)">
          <Row>
            <span className="flex-1">대화 요청 받기</span>
            <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={s.demoIncoming}>받기</Button>
          </Row>
          <Row>
            <span className="flex-1">하루 지나기 <span className="block text-xs text-muted">요청 한도 초기화·3일 만료 확인용 (현재 {kstDayKey(now)})</span></span>
            <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => { s.demoAdvanceDay(); s.showToast('하루가 지났어요') }}>+1일</Button>
          </Row>
          <Row>
            <span className="flex-1">상대가 대화방 나가기 <span className="block text-xs text-muted">열린 대화방 {openRooms.length}개 중 가장 최근 방</span></span>
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 !text-xs"
              disabled={!openRooms.length}
              onClick={() => { s.demoPartnerLeave(openRooms[0].id); s.showToast(`${nick(openRooms[0].partnerId)} 님이 나갔어요`) }}
            >
              실행
            </Button>
          </Row>
          <Row>
            <span className="text-xs text-muted">요청 수락 여부는 상대마다 정해져 있어요. 수락하는 상대는 2~3초 뒤 채팅방이 열려요.</span>
          </Row>
        </Section>
      </div>
    </>
  )
}
