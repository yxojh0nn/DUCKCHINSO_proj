// 겹치는 아티스트 비율 (Jaccard). 기획서 5.3
export const jaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0
  const sa = new Set(a)
  const inter = b.filter((x) => sa.has(x)).length
  return inter / new Set([...a, ...b]).size
}
