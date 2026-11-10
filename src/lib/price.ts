// KOPIS 가격 안내 원문("VIP석 160,000원, GA석  110,000원")을 좌석별 한 줄씩으로 나눈다
// 숫자 안의 쉼표(160,000)에서는 자르지 않는다. 형식이 다르면 원문 한 줄 그대로
export function priceLines(text: string): { seat: string; price: string }[] {
  return text.split(/\s*[,/]\s*(?=\D)/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(.+?)\s*([\d,]+원)$/)
    return m ? { seat: m[1], price: m[2] } : { seat: s, price: '' }
  })
}
