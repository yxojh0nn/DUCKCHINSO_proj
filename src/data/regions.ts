// 활동 지역(시·도). DB public.regions(마이그 45)와 이름·좌표를 같게 둔다
export const REGIONS = [
  { name: '서울', lat: 37.5665, lng: 126.978 }, { name: '부산', lat: 35.1796, lng: 129.0756 }, { name: '대구', lat: 35.8714, lng: 128.6014 },
  { name: '인천', lat: 37.4563, lng: 126.7052 }, { name: '광주', lat: 35.1595, lng: 126.8526 }, { name: '대전', lat: 36.3504, lng: 127.3845 },
  { name: '울산', lat: 35.5384, lng: 129.3114 }, { name: '세종', lat: 36.48, lng: 127.289 }, { name: '경기', lat: 37.4138, lng: 127.5183 },
  { name: '강원', lat: 37.8228, lng: 128.1555 }, { name: '충북', lat: 36.8, lng: 127.7 }, { name: '충남', lat: 36.5184, lng: 126.8 },
  { name: '전북', lat: 35.7175, lng: 127.153 }, { name: '전남', lat: 34.8679, lng: 126.991 }, { name: '경북', lat: 36.4919, lng: 128.8889 },
  { name: '경남', lat: 35.4606, lng: 128.2132 }, { name: '제주', lat: 33.4996, lng: 126.5312 },
] as const

const rad = (d: number) => (d * Math.PI) / 180
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// 기기 위치에서 가장 가까운 시·도 (기기 안에서만 계산, 좌표는 어디에도 보내지 않는다)
// shortcut: 시·도 중심점 거리로 고른다, 경계 근처는 옆 지역이 나올 수 있다 → 사람이 확인하고 바꿀 수 있게 둔다
export const nearestRegion = (lat: number, lng: number) =>
  REGIONS.reduce((best, r) => (km({ lat, lng }, r) < km({ lat, lng }, best) ? r : best)).name

// 서버 region_near 와 같은 식 (데모 추천용): 같은 지역 1, 300km 이상 0
export function regionNear(a: string | null, b: string | null) {
  const ra = REGIONS.find((r) => r.name === a)
  const rb = REGIONS.find((r) => r.name === b)
  return ra && rb ? Math.max(0, 1 - km(ra, rb) / 300) : 0
}
