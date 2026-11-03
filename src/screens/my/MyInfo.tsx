import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { useMe } from '@/lib/queries'

// 내 정보: 프로필 편집, 관심 아티스트·장르, 관심 공연 관리, 공연 후기 모아보기
export default function MyInfo() {
  const me = useMe().data
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
          <MenuRow label="로그인 방식" right={<span className="t-sub text-graphite">{me.isGuest ? '비회원(익명)' : me.email ?? '소셜 로그인'}</span>} />
        </MenuGroup>
      )}
    </>
  )
}
