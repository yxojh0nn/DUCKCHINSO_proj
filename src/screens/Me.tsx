import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ARTISTS, MOCK_USERS, REGIONS } from '@/data/mock'
import { kstDayKey } from '@/lib/date'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { Avatar } from '@/components/MatchCard'
import { Chevron, List, Row } from '@/components/List'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'

// 내 정보·설정 (기획서 5.5, 10장)
export default function Me() {
  const nav = useNavigate()
  const s = useAppStore()
  const now = s.now()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nick = (id: string) => MOCK_USERS.find((u) => u.id === id)?.nickname ?? '알 수 없음'
  const openRooms = s.rooms.filter((r) => !r.partnerLeftAt)
  const artistNames = s.myArtists.map((id) => ARTISTS.find((a) => a.id === id)?.name).join(', ')

  return (
    <>
      <AppHeader title="내 정보" large />
      <div className="flex-1 pb-10">
        <div className="flex items-center gap-4 px-5 pb-2 pt-3">
          <Avatar name={s.nickname} size={60} />
          <div className="min-w-0">
            <p className="t-title">{s.nickname}</p>
            <p className="t-sub text-graphite">임시 계정. 앱을 지우거나 기기를 바꾸면 복구할 수 없어요.</p>
          </div>
        </div>

        <List header="취향">
          <li>
            <Link to="/me/artists" className="flex min-h-11 items-center gap-3 px-5 py-2.5 active:bg-mist">
              <span className="shrink-0 t-body">관심 아티스트</span>
              <span className="min-w-0 flex-1 truncate text-right t-body text-graphite">{artistNames || '고르지 않음'}</span>
              <Chevron />
            </Link>
          </li>
        </List>

        <List header="공개 범위" footer="켜면 다른 사람에게 내 지역이 보이지 않아요. 지역은 시·도까지만 저장해요.">
          <Row>
            <label htmlFor="region" className="flex-1 t-body">지역</label>
            <select
              id="region"
              value={s.region ?? ''}
              onChange={(e) => s.setRegion(e.target.value || null)}
              className="-mr-1 bg-transparent text-right t-body text-graphite outline-none"
            >
              <option value="">선택 안 함</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Row>
          <Row>
            <span className="flex-1 t-body">내 정보 비공개</span>
            <Toggle label="내 정보 비공개" checked={!s.regionPublic} onChange={(v) => s.setRegionPublic(!v)} />
          </Row>
        </List>
        <p className="px-5 pt-2 t-sub text-graphite">
          다른 사람에게는 <span className="text-ink">{s.nickname}, {s.regionPublic ? (s.region ?? '지역 미설정') : '지역 비공개'}</span>(으)로 보여요.
        </p>

        <List header="차단한 사람" footer={s.blocks.length ? '해제해도 상대에게 알리지 않아요.' : undefined}>
          {s.blocks.length === 0 && <Row><span className="t-body text-graphite">차단한 사람이 없어요</span></Row>}
          {s.blocks.map((b) => (
            <Row key={b.userId}>
              <span className="flex-1 t-body">{nick(b.userId)}</span>
              <span className="t-sub text-graphite num">{kstDayKey(b.at)}</span>
              <Button variant="secondary" size="sm" onClick={() => { s.unblock(b.userId); s.showToast('차단을 해제했어요') }}>해제</Button>
            </Row>
          ))}
        </List>

        <List header="계정" footer="이메일, 구글, 카카오, 애플 가입은 다음 버전에서 제공해요. 가입하면 지금 기록이 그대로 이어져요.">
          <Row>
            <span className="flex-1 t-body">회원가입</span>
            <span className="t-body text-graphite">준비 중</span>
          </Row>
          <Row>
            <span className="flex-1 t-body">동의 내역</span>
            <span className="t-body text-graphite num">{s.consentVersion} 버전</span>
          </Row>
          <li>
            <button onClick={() => setConfirmDelete(true)} className="flex min-h-11 w-full items-center px-5 py-2.5 t-body text-danger active:bg-mist">
              계정 삭제
            </button>
          </li>
        </List>

        <List header="데모 도구" footer="프로토타입 확인용이에요. 수락하는 상대는 요청 후 2~3초 뒤 대화방이 열려요.">
          <Row>
            <span className="flex-1 t-body">대화 요청 받기</span>
            <Button variant="secondary" size="sm" onClick={s.demoIncoming}>받기</Button>
          </Row>
          <Row>
            <span className="flex-1">
              <span className="block t-body">하루 지나기</span>
              <span className="block t-sub text-graphite num">지금 {kstDayKey(now)}</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => { s.demoAdvanceDay(); s.showToast('하루가 지났어요') }}>+1일</Button>
          </Row>
          <Row>
            <span className="flex-1">
              <span className="block t-body">상대가 대화방 나가기</span>
              <span className="block t-sub text-graphite">가장 최근 대화방에 적용</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={!openRooms.length}
              onClick={() => { s.demoPartnerLeave(openRooms[0].id); s.showToast(`${nick(openRooms[0].partnerId)} 님이 나갔어요`) }}
            >
              실행
            </Button>
          </Row>
        </List>
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="계정을 삭제할까요?"
        message="관심 아티스트, 대화, 차단 기록이 모두 지워지고 복구할 수 없어요."
        actions={[{ label: '계정 삭제', destructive: true, onClick: () => { s.reset(); nav('/consent', { replace: true }) } }]}
      />
    </>
  )
}
