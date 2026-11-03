// 프로필 사진. 사진이 없으면 닉네임 첫 글자
export function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full bg-mist object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-mist font-semibold text-graphite"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim().charAt(0) || '?'}
    </span>
  )
}
