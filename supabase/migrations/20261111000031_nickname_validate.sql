-- 닉네임 허용 문자 규칙(마이그 21 profiles_nickname_chars)을 기존 행까지 적용 (2026-11-11, 보안 점검 L5 마무리)
--   적용 직전 운영 DB 위반 행은 0건이었다. 그 사이 생겼을 경우를 대비해 위반 닉네임은 기본 닉네임으로 바꾼 뒤 검증한다.
--   기본 닉네임 = 비회원 '익명의 팬' / 회원 '덕친' + 계정 id 앞 6자리(16진수, 허용 문자이고 계정마다 달라 중복되지 않는다)
update public.profiles
   set nickname = case when is_guest then '익명의 팬' else '덕친' end || substr(replace(id::text, '-', ''), 1, 6)
 where nickname !~ '^[가-힣ㄱ-ㅎㅏ-ㅣぁ-ゖァ-ヺー一-龯A-Za-z0-9 _.\-]+$';

alter table public.profiles validate constraint profiles_nickname_chars;
