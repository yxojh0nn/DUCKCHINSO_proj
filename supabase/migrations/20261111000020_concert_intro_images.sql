-- KOPIS 공연 상세의 소개 이미지(styurls) 주소. 포스터(약 430px)보다 큰 원본(폭 700~1000px)이라 "공연 상세 이미지"로 보여 준다
-- KOPIS 이용 조건(2026-11-11 확인): 출처 표시 필수, 상업적 이용 가능(타인 권리 침해 금지). 이미지는 복사하지 않고 KOPIS 주소를 그대로 쓴다
alter table public.concerts add column intro_urls text[] not null default '{}';
