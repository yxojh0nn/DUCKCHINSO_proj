import { useQuery } from '@tanstack/react-query'
import { api, type LoginMethod } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { useMe } from '@/lib/queries'

const METHOD: Record<LoginMethod, string> = {
  guest: '비회원(익명)', email: '아이디', google: 'Google', apple: 'Apple', kakao: '카카오', naver: '네이버',
}

// 내 정보: 프로필 편집, 관심 아티스트·장르, 관심 공연 관리, 공연 후기 모아보기, 계정(로그인 방식·아이디·비밀번호)
export default function MyInfo() {
  const me = useMe().data
  const email = me?.loginMethod === 'email'
  // 아이디는 서버 함수가 본인에게만 복호화해 준다. 이메일 가입 계정일 때만 묻는다
  const loginId = useQuery({ queryKey: ['my-login-id', me?.id], queryFn: () => api.myLoginId(), enabled: email, staleTime: Infinity })
  return (
    <>
      <AppHeader back title="내 정보" />
      <MenuGroup>
        <MenuRow label="프로필 편집" to="/my/info/profile" />
        <MenuRow label="관심 아티스트·장르" to="/my/info/prefs"
          right={me && <span className="t-sub text-graphite num">{me.artistIds.length + me.genreIds.length}개</span>} />
        <MenuRow label="관심 공연 관리" to="/my/info/favorites"
          right={me && <span className="t-sub text-graphite num">{me.favoriteIds.length}개</span>} />
        <MenuRow label="공연 후기 모아보기" to="/my/info/reviews" />
      </MenuGroup>
      {me && (
        <MenuGroup title="계정">
          <MenuRow label="로그인 방식" right={<span className="t-sub text-graphite">{METHOD[me.loginMethod] ?? '소셜 로그인'}</span>} />
          {email && <MenuRow label="아이디" right={<span className="t-sub text-graphite">{loginId.data ?? (loginId.isLoading ? '…' : '없음')}</span>} />}
          {me.email && me.loginMethod !== 'guest' && <MenuRow label="이메일" right={<span className="t-sub text-graphite">{me.email}</span>} />}
          {email && <MenuRow label="비밀번호 바꾸기" to="/my/password" />}
        </MenuGroup>
      )}
    </>
  )
}
