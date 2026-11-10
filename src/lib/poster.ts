// KOPIS 포스터 주소는 http://www.kopis.or.kr/… 라서 https 사이트에서는 브라우저가 https://www… 로 바꿔 요청하고,
// KOPIS 가 https://kopis.or.kr/… 로 한 번 더 넘긴다(1초 이상). 처음부터 최종 주소로 요청한다
export const posterUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?kopis\.or\.kr\//, 'https://kopis.or.kr/')

// 배포된 웹(Vercel)에서는 썸네일 크기로 줄인 webp 를 받는다(vercel.json images, 30일 캐시). 로컬·앱은 원본
// shortcut: Vercel 무료 플랜의 이미지 변환 한도를 넘으면 실패 → Poster 가 원본으로 다시 받는다. 한도가 문제면 Pro 또는 수집 때 썸네일 저장으로
const resizable = typeof location !== 'undefined' && location.protocol === 'https:' && location.hostname !== 'localhost'
export const posterThumb = (url: string) =>
  resizable ? `/_vercel/image?url=${encodeURIComponent(posterUrl(url))}&w=256&q=75` : posterUrl(url)
