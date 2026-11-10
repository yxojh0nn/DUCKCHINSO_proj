import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { kstDayKey } from '@/lib/date'

// KOPIS 이용 조건: 서비스 화면에 아래 고지 문구를 함께 명시 (문구는 KOPIS 안내 그대로)
const KOPIS_NOTICE = [
  '집계대상 : 모든 공연 데이터 전송기관',
  '아래 집계 데이터는 공연예술통합전산망 연계기관의 티켓판매시스템에서 발권된 분량을 기준으로 제공하므로 해당 공연의 전체 관객 수와 차이가 있을 수 있습니다.',
  'Api 인증키는 신청 직후 기재된 이메일 주소로 발급됩니다. 인증키 사용 유효기간은 발급일로부터 1년으로 자동 설정되어 있으며, 3개월 이상 미사용시 사용 승인이 취소됩니다. 유효기간 만료 또는 승인 취소 관련 안내는 kopis@gokams.or.kr 메일로 발송되며, 유효기간 연장 희망시 해당 메일로 신청해 주시기 바랍니다.',
]

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="w-16 shrink-0 t-sub text-graphite">{label}</dt>
      <dd className="t-sub">{children}</dd>
    </div>
  )
}

// MY > 설정 > 앱 정보 > 오픈 API: 앱이 쓰는 무료 오픈 API와 출처·이용 조건
export default function OpenApiInfo() {
  const updated = useQuery({ queryKey: ['openDataUpdatedAt'], queryFn: () => api.openDataUpdatedAt() })
  const day = updated.data ? kstDayKey(updated.data).replace(/-/g, '.') : '-'
  return (
    <>
      <AppHeader back title="오픈 API" />
      <section className="px-5 pt-3">
        <h2 className="t-head">공연예술통합전산망(KOPIS) 오픈 API</h2>
        <dl className="mt-2">
          <Info label="제공">(재)예술경영지원센터</Info>
          <Info label="쓰는 정보">공연 일정, 공연장, 가격, 포스터, 예매처 링크</Info>
        </dl>
        <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3 t-sub text-graphite">
          <li className="num">· 집계기간 : 최종집계 {day}</li>
          {KOPIS_NOTICE.map((t) => <li key={t}>· {t}</li>)}
        </ul>
      </section>
      <section className="mt-8 px-5 pb-8">
        <h2 className="t-head">MusicBrainz</h2>
        <dl className="mt-2">
          <Info label="제공">MetaBrainz Foundation</Info>
          <Info label="쓰는 정보">아티스트 이름(한국어·일본어·영어)과 별칭</Info>
          <Info label="라이선스">CC0 (퍼블릭 도메인)</Info>
        </dl>
      </section>
    </>
  )
}
