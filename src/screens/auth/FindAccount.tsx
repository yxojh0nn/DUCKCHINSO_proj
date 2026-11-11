import { useState } from 'react'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { Captcha, captchaOn } from '@/components/Captcha'
import { toast } from '@/store/ui'

// 아이디 찾기(가입한 이메일로 아이디 발송) · 비밀번호 재설정(가입한 이메일로 재설정 링크)
// 가입 여부는 화면에 알려 주지 않는다 (남의 이메일로 가입 여부를 확인하지 못하게)
export default function FindAccount() {
  const [tab, setTab] = useState<'id' | 'pw'>('id')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null) // 비밀번호 재설정(Supabase 기본 경로)만 필요
  const [tries, setTries] = useState(0)
  const [done, setDone] = useState<string | null>(null)
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      if (tab === 'id') {
        const r = await api.findLoginId(email)
        if (!r.mailReady) return toast('아이디 찾기 메일은 아직 준비 중이에요. 문의하기로 연락해 주세요.')
        setDone('가입된 이메일이면 아이디를 메일로 보냈어요.')
      } else {
        await api.resetPassword(email, captcha ?? undefined)
        setDone('가입된 이메일이면 비밀번호 재설정 메일을 보냈어요.')
      }
    } catch (err) {
      toast(errorText(err))
      setCaptcha(null); setTries((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="아이디·비밀번호 찾기" />
      <TextTabs label="찾을 항목" value={tab} onChange={(v) => { setTab(v); setDone(null) }}
        tabs={[{ value: 'id', label: '아이디 찾기' }, { value: 'pw', label: '비밀번호 재설정' }]} />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <p className="t-body text-graphite">이메일로 가입할 때 쓴 주소를 넣어 주세요. 네이버·카카오·구글·Apple로 가입했다면 그 버튼으로 로그인하면 돼요.</p>
        <TextField className="mt-6" label="가입한 이메일" type="email" autoComplete="email" inputMode="email" value={email}
          onChange={(e) => { setEmail(e.target.value.trim()); setDone(null) }}
          error={email && !ok ? '이메일 형식을 확인해 주세요.' : undefined} />
        {tab === 'pw' && <Captcha key={tries} onToken={setCaptcha} />}
        {done && <p role="status" className="mt-3 t-sub text-graphite">{done}</p>}
        <Button type="submit" block className="mt-auto" disabled={!ok || busy || (tab === 'pw' && captchaOn && !captcha)}>
          {busy ? '보내는 중…' : tab === 'id' ? '아이디 메일 받기' : '재설정 메일 받기'}
        </Button>
      </form>
    </div>
  )
}
