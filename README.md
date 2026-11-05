# 덕친소 (가칭)

J-pop 공연을 한 캘린더에 모아 보고, 취향이 비슷한 덕친과 커뮤니티·1:1 채팅으로 이어지는 앱입니다. 웹(React + Vite)으로 만들고 Capacitor로 Android·iOS에 배포합니다. 백엔드는 Supabase(Postgres + Auth + Realtime + Storage + Edge Functions)입니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [기획서](docs/공연캘린더_취향매칭앱_기획서.md) | 서비스 개요, 툴 체계와 충돌 방지 규칙, 법률 대응 |
| 인앱 상세 기획 (`인앱 상세 기획.hwpx`) | 화면·흐름 상세 (로그인, 4개 탭, 커뮤니티, MY) |
| [보안·회원정보 처리 기획서](docs/보안_및_회원정보_처리_기획서.md) | 회원정보 저장·삭제 방식, RLS, 동의서, 암호화 |
| [오픈 API 조사](docs/오픈API_조사.md) | KOPIS·MusicBrainz 적용, 유료·불가 API 기록과 대안 |
| [배포 가이드](docs/배포_가이드.md) | Supabase·Vercel·Android·iOS 배포 순서 |
| [앱 배포 계획](docs/앱_배포_계획.md) | Google Play·App Store 출시까지 남은 일, 심사 준비, 순서, 비용 |
| [푸시 알림 설계](docs/푸시_알림_설계.md) | 보낼 알림 종류·시간·수신 조건, FCM 발송 구조 |
| [금칙어 필터 설계](docs/금칙어_필터_설계.md) | Apple 1.2 대응, DB 트리거 검사, 정규화·허용어, 운영자 목록 관리 |
| [반응형 레이아웃 설계](docs/반응형_레이아웃_설계.md) | 폭 구간, 왼쪽 메뉴·두 칸 배치, iPhone 전용·세로 고정 권장 |
| [디자인 기획안 v2](docs/디자인_기획안.md) | 블랙·화이트 토큰, 다크 테마, 자체 아이콘, 캘린더 표시 규칙 |
| [UI/UX 검토 문제점](docs/UIUX_검토_문제점.md) | arena 1라운드에서 나온 문제 목록 |

## 실행

```bash
pnpm install
```
```bash
pnpm dev
```

`.env`가 비어 있으면 **데모 모드**로 돕니다. 데이터는 이 브라우저(localStorage)에만 저장되고, 가상 사용자가 친구 요청을 수락하거나 채팅에 답장합니다. 공연은 이번 달 기준의 샘플 데이터입니다. `.env.example`을 참고해 Supabase 값을 넣으면 실제 백엔드로 동작합니다.

```bash
pnpm test
```

테스트는 캘린더 점·선 배치, KOPIS 응답 파싱, DB 스키마(RLS·친구·채팅·차단·탈퇴 범위)를 검사합니다.

## 구조

| 위치 | 내용 |
| --- | --- |
| `src/api` | 백엔드 계약(`types.ts`)과 구현 2개: `supabaseApi.ts`(실서비스), `demoApi.ts`(데모) |
| `src/styles` → `src/components/ui` → `src/components` → `src/screens` | 토큰 → 기본 부품 → 조합 부품 → 화면 (기획서 13장) |
| `src/screens/{auth,calendar,community,chat,my}` | 로그인·동의 / 공연·캘린더 / 커뮤니티 / 채팅 / MY |
| `supabase/migrations` | 테이블, RLS, 함수, 저장소 정책, 정기 작업 |
| `supabase/functions` | 회원탈퇴, 문의 답변 메일, KOPIS 공연 수집, MusicBrainz 아티스트 수집 |
| `android/`, `ios/` | Capacitor 네이티브 프로젝트 (Android 8.0+, iOS 16+) |

## 작업 규칙 (요약)

- main에 직접 푸시하지 않고, 작업 브랜치(`feat/` `fix/` `chore/` `docs/`) → PR → Squash merge
- 패키지 매니저는 pnpm만 사용 (`pnpm-lock.yaml`만 커밋)
- 비밀키는 커밋하지 않음. 앱에는 Supabase anon 키만 들어갑니다 (`.env.example`)
