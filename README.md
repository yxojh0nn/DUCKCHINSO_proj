# 덕친소 (가칭)

J-pop 공연을 한 캘린더에 모아 보고, 취향이 비슷한 덕친과 커뮤니티·1:1 채팅으로 이어지는 앱입니다. 웹(React 19 + Vite)으로 만들고 Capacitor 8로 Android·iOS에 배포합니다. 백엔드는 Supabase(Postgres + Auth + Realtime + Storage + Edge Functions)입니다.

## 진행 상황 (2026-11-15 기준)

| 영역 | 상태 | 내용 |
| --- | --- | --- |
| 공연·캘린더 | 완료 | 월 캘린더(점·선 표시), 공연 상세, 공연/아티스트 검색, 예매 링크(클릭 집계), 예매 팁 |
| 공연 수집 | 완료 | KOPIS 대중음악 수집(`sync-concerts`, 점수제 J-pop 판별 → 애매하면 검수 대기), MusicBrainz 아티스트 수집(`sync-artists`), 운영자 수동 등록(`import-concert`) |
| 로그인·계정 | 대부분 완료 | 구글(Supabase OAuth), 네이버·카카오(`social-login` 함수), 이메일 가입 + 별도 아이디, 비회원 시작, 아이디/비밀번호 찾기, 동의서·동의 이력, 회원탈퇴. Cloudflare Turnstile 캡차(선택) |
| 커뮤니티 | 완료 | 게시글·댓글·답글, 지난 공연 후기, 공지(기간·예약), 커뮤니티 규칙, 프로필, 친구 요청, 신고·차단 |
| 채팅 | 완료 | 1:1 실시간 채팅, 사진·영상, GIF(KLIPY, 키가 있을 때만) |
| MY | 완료 | 내 정보·프로필·취향·즐겨찾기·후기, 친구, 설정, 문의, 비밀번호 변경, 오픈 API 안내 |
| 운영자(`/admin`) | 완료 | 공연 검수, 신고·문의 처리(답변 메일), 제재·경고 누적, 금칙어, 아티스트 편집, 예매 팁·클릭 통계, 공지 작성, 회원 조회 |
| 보안 | 완료 | 전 테이블 RLS, 비회원 권한 범위 제한, 개인정보 암호화·검색용 블라인드 인덱스, 감사 기록, 세션 강제 종료, 금칙어 DB 트리거, Vercel 보안 헤더(CSP 등) |
| 운영 | 완료 | 정기 작업(보존기간 정리·비회원 정리), DB 백업(`docker/backup`), DB 마이그레이션 푸시 스크립트 |
| 앱 패키징 | 진행 중 | Android·iOS 프로젝트 생성됨(`com.duckchinso.app`, 번들 ID 미확정) |

### 남은 일

**앱 배포 시작 전**

- [ ] BM 설계 및 적용: 결제창, 카드 결제 연동, 결제 관련 보안(서버 검증·위변조 방지·카드정보 비저장)
- [ ] 포스터 화질: 크게 보기는 원본 포스터만 보여 줌(소개 이미지 제거). KOPIS 원본이 대부분 430×602라 고해상도 폰에서 흐림 → 수집 때 AI 업스케일 사본을 Storage에 저장하는 방안 **보류**. 2026-11-15 시험: Real-ESRGAN `realesrgan-x4plus`로 3장(일러스트 포스터) 처리 시 글자·선이 확실히 선명해짐, 2배 webp 장당 73~154KB, 작은 손글씨 로고는 약간 뭉개짐. anime 모델은 점선을 지워서 제외. Edge Function에서는 못 돌리므로 PC 스크립트로 처리 후 업로드해야 함. 사진 포스터는 미시험, KOPIS 변형 허용 여부 미확인
- [ ] UX 수정사항 탐색

**그 외**

- [ ] 애플 로그인 (애플 키 받은 뒤 탈퇴 시 토큰 철회도 함께 — Apple 5.1.1(v))
- [ ] 푸시 알림(FCM) — 아직 코드 없음
- [ ] 번들 ID 확정 후 스토어 등록 (Google Play·App Store 심사)
- [ ] CI(GitHub Actions)·Dependabot 설정 — 레포에 `.github/` 없음
- [ ] 코드 안의 `shortcut:` 메모 정리: 비회원이 올린 `public-media` 파일 정리, 공지 읽음 서버 저장, 이메일 로그인(아이디 이전 계정용) 제거, 수집 5000명 한도

## 문서

| 문서 | 내용 |
| --- | --- |
| [개발 환경·GitHub 운영 가이드](docs/개발환경_및_GitHub_운영가이드.md) | 설치, 버전 고정, 브랜치·PR 규칙, 충돌 방지 |
| 인앱 상세 기획 (`인앱 상세 기획.hwpx`) | 화면·흐름 상세 (로그인, 4개 탭, 커뮤니티, MY) |

## 실행

```bash
pnpm install
```
```bash
pnpm dev
```

`.env`가 비어 있으면 **데모 모드**로 돕니다. 데이터는 이 브라우저(localStorage)에만 저장되고, 가상 사용자가 친구 요청을 수락하거나 채팅에 답장합니다. 공연·아티스트는 `src/api/openData.json`(오픈 API에서 받아 둔 실제 데이터)을 씁니다. `.env.example`을 참고해 Supabase 값을 넣으면 실제 백엔드로 동작합니다.

```bash
pnpm test
```

테스트는 캘린더 점·선 배치, KLIPY 응답, KOPIS 파싱, 암호화, 오픈 데이터 변환, J-pop 판별 채점(사람이 붙인 정답 100건), DB 푸시 스크립트, DB 스키마(RLS·친구·채팅·차단·탈퇴 범위)를 검사합니다.

| 명령 | 용도 |
| --- | --- |
| `pnpm db:push` | `supabase/migrations`를 DB에 반영 |
| `pnpm fetch:opendata` | 데모용 `openData.json`을 MusicBrainz·KOPIS에서 새로 받기 (`KOPIS_API_KEY` 필요) |
| `pnpm dump:kopis` | KOPIS 후보 덤프 (판별 규칙 점검용) |
| `pnpm cap:sync` | 웹 빌드 후 Android·iOS에 반영 |
| `docker compose --env-file .env -f docker/backup/compose.yml run --rm backup` | DB 백업 (`SUPABASE_DB_URL` 필요) |

## 구조

| 위치 | 내용 |
| --- | --- |
| `src/api` | 백엔드 계약(`types.ts`)과 구현 2개: `supabaseApi.ts`(실서비스), `demoApi.ts`(데모) |
| `src/styles` → `src/components/ui` → `src/components` → `src/screens` | 토큰 → 기본 부품 → 조합 부품 → 화면 |
| `src/screens/{auth,calendar,community,chat,my,admin,legal}` | 로그인·동의 / 공연·캘린더 / 커뮤니티 / 채팅 / MY / 운영자 / 약관 |
| `supabase/migrations` | 테이블, RLS, 함수, 저장소 정책, 정기 작업 (40개) |
| `supabase/functions` | `sync-concerts`·`sync-artists`·`import-concert`(공연·아티스트), `social-login`·`login-id`(로그인), `answer-inquiry`(문의 답변 메일), `delete-account`(탈퇴) |
| `scripts` | 오픈 데이터 수집, DB 푸시, 아이콘 생성 |
| `design` | 로고·아이콘 시안, OG 이미지 |
| `docker/backup` | Supabase DB 백업 |
| `android/`, `ios/` | Capacitor 네이티브 프로젝트 (Android 8.0+, iOS 16+) |

## 작업 규칙 (요약)

- main에 직접 푸시하지 않고, 작업 브랜치(`feat/` `fix/` `chore/` `docs/`) → PR → Squash merge
- 패키지 매니저는 pnpm만 사용 (`pnpm-lock.yaml`만 커밋)
- 비밀키는 커밋하지 않음. 앱에는 Supabase anon 키와 공개 키(Turnstile 사이트 키, KLIPY 앱 키)만 들어갑니다 (`.env.example`). KOPIS·Resend 키 등은 Edge Function 비밀값으로만 등록
