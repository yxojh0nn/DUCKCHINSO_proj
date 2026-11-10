-- 금칙어 필터 (docs/금칙어_필터_설계.md, Apple 1.2)
-- 글·댓글·프로필: 금칙어가 있으면 저장을 거절한다 ('blocked_word')
-- 채팅: 금칙어가 든 낱말을 *** 로 가려 보내고, 원문은 운영자만 보는 message_originals 에 남긴다 (신고 처리용)

-- 비교용 형태: 전각·대소문자 통일, 기호 삭제(씨.발 → 씨발). 한글·자모·영문·숫자·일본어만 남긴다.
-- 띄어쓰기는 남기고 한 글자씩 띄워 쓴 것(씨 발)만 붙인다. 띄어쓰기를 모두 지우면 "7시 발표"가 '시발'에 걸린다
create or replace function public.norm_text(t text) returns text
language plpgsql immutable set search_path = '' as $$
declare tok text; res text := ''; prev_one boolean := false;
begin
  foreach tok in array regexp_split_to_array(
    regexp_replace(lower(normalize(coalesce(t, ''), nfkc)), '[^가-힣ᄀ-ᇿㄱ-ㆎa-z0-9ぁ-ゟァ-ヿ一-鿿\s]', '', 'g'), '\s+') loop
    continue when tok = '';
    if char_length(tok) = 1 and prev_one then res := res || tok;
    else res := res || case when res = '' then '' else ' ' end || tok; end if;
    prev_one := char_length(tok) = 1;
  end loop;
  return res;
end $$;

create table public.banned_words (
  word text primary key,
  match text not null default 'contains' check (match in ('contains', 'exact')), -- exact: 닉네임 전체가 그 단어일 때만
  category text not null default 'abuse' check (category in ('abuse', 'sexual', 'hate', 'scam')),
  created_at timestamptz not null default now()
);
create table public.allowed_words ( -- 금칙어를 품은 정상 단어 (예: 시발점, 등신대)
  word text primary key,
  created_at timestamptz not null default now()
);
-- 가려서 보낸 채팅의 원문. 대화 당사자도 못 읽는다 (정책 없음 → 운영자 함수·신고 스냅숏만)
create table public.message_originals (
  message_id uuid primary key references public.messages (id) on delete cascade deferrable initially deferred,
  body text not null,
  created_at timestamptz not null default now()
);

-- 운영자가 넣은 단어도 같은 정규화로 저장한다 (씨 발 → 씨발)
create or replace function public.norm_word() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.word := replace(public.norm_text(new.word), ' ', '');
  if char_length(new.word) < 1 then raise exception 'bad_request'; end if;
  return new;
end $$;
create trigger banned_words_norm before insert or update on public.banned_words for each row execute function public.norm_word();
create trigger allowed_words_norm before insert or update on public.allowed_words for each row execute function public.norm_word();

alter table public.banned_words enable row level security;
alter table public.allowed_words enable row level security;
alter table public.message_originals enable row level security;
create policy "admin banned_words" on public.banned_words for all using (public.is_admin()) with check (public.is_admin());
create policy "admin allowed_words" on public.allowed_words for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.banned_words, public.allowed_words to authenticated;

-- 걸린 금칙어(가장 긴 것)를 돌려준다. 없으면 null. exact_too: 닉네임처럼 칸 전체 일치 단어까지 볼 때
create or replace function public.blocked_word(t text, exact_too boolean default false) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  n text := public.norm_text(t);
  a text; hit text;
  n2 text; -- 숫자를 끼운 변형(씨1발)용: 숫자를 지운 형태
begin
  if n = '' then return null; end if;
  if exact_too then
    select word into hit from public.banned_words where match = 'exact' and word = replace(n, ' ', '');
    if hit is not null then return hit; end if;
  end if;
  n2 := regexp_replace(n, '[0-9]', '', 'g');
  for a in select word from public.allowed_words order by char_length(word) desc loop
    n := replace(n, a, '|'); n2 := replace(n2, a, '|'); -- | 로 바꿔 앞뒤 글자가 붙어 새 단어가 되지 않게
  end loop;
  select word into hit from public.banned_words
   where match = 'contains' and (strpos(n, word) > 0 or strpos(n2, word) > 0)
   order by char_length(word) desc limit 1;
  return hit;
end $$;

-- 금칙어가 든 낱말을 같은 길이의 * 로 바꾼다. 띄어 쓴 욕설(씨 발)처럼 낱말 단위로 못 찾으면 글 전체를 가린다
create or replace function public.mask_text(t text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare tok text; res text := ''; hit boolean := false;
begin
  if public.blocked_word(t) is null then return t; end if;
  for tok in select m[1] from regexp_matches(t, '(\s+|\S+)', 'g') as m loop
    if tok !~ '^\s+$' and public.blocked_word(tok) is not null then
      res := res || repeat('*', char_length(tok)); hit := true;
    else
      res := res || tok;
    end if;
  end loop;
  return case when hit then res else regexp_replace(t, '\S', '*', 'g') end;
end $$;

create or replace function public.check_banned_words() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ins boolean := tg_op = 'INSERT'; masked text;
begin
  if tg_table_name = 'profiles' then
    if (ins or new.nickname is distinct from old.nickname) and public.blocked_word(new.nickname, true) is not null
       or (ins or new.bio is distinct from old.bio) and public.blocked_word(new.bio) is not null then
      raise exception 'blocked_word';
    end if;
  elsif tg_table_name = 'posts' then
    -- 바뀐 칸만 본다: 운영자가 글을 가릴 때(status 변경) 막히지 않게
    if (ins or new.title is distinct from old.title) and public.blocked_word(new.title) is not null
       or (ins or new.body is distinct from old.body) and public.blocked_word(new.body) is not null
       or (ins or new.tags is distinct from old.tags) and public.blocked_word(array_to_string(new.tags, ' ')) is not null then
      raise exception 'blocked_word';
    end if;
  elsif tg_table_name = 'comments' then
    if public.blocked_word(new.body) is not null then raise exception 'blocked_word'; end if;
  elsif tg_table_name = 'messages' then
    -- 운영팀·시스템 메시지(sender 없음)와 사진은 보지 않는다
    if new.sender_id is not null and new.kind = 'text' then
      masked := public.mask_text(new.body);
      if masked <> new.body then
        insert into public.message_originals (message_id, body) values (new.id, new.body);
        new.body := masked;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_words before insert or update on public.profiles for each row execute function public.check_banned_words();
create trigger posts_words before insert or update on public.posts for each row execute function public.check_banned_words();
create trigger comments_words before insert or update on public.comments for each row execute function public.check_banned_words();
create trigger messages_words before insert on public.messages for each row execute function public.check_banned_words();

-- 채팅 신고 스냅숏은 가리기 전 원문으로 남긴다 (운영자가 무엇을 썼는지 봐야 한다)
create or replace function public.fill_report_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.target_user := coalesce(
    (select author_id from public.posts where id = new.post_id),
    (select author_id from public.comments where id = new.comment_id),
    (select sender_id from public.messages where id = new.message_id),
    new.target_user);
  new.content_snapshot := coalesce(
    (select title || E'\n' || body from public.posts where id = new.post_id),
    (select body from public.comments where id = new.comment_id),
    (select coalesce(o.body, nullif(m.body, ''), m.image_path) from public.messages m
       left join public.message_originals o on o.message_id = m.id where m.id = new.message_id),
    (select nickname || E'\n' || bio from public.profiles where id = new.target_user));
  return new;
end $$;

-- 운영자 시험 칸: 걸린 단어와 채팅에서 가려지는 모습
create or replace function public.admin_test_text(t text) returns table (word text, masked text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select public.blocked_word(t, true), public.mask_text(t);
end $$;

revoke execute on function public.blocked_word(text, boolean), public.mask_text(text), public.check_banned_words()
  from public, anon, authenticated;
revoke execute on function public.admin_test_text(text) from public, anon;
grant execute on function public.admin_test_text(text) to authenticated;

-- 초기 목록: ZIZUN/korean-malicious-comments-dataset(MIT) 의 악성 댓글 5,000건에서
-- 정상 댓글보다 6배 이상 자주 나온 2~3글자 표현을 뽑아 사람이 고른 것 + 자모·영문 변형. 운영자 화면에서 고친다
insert into public.banned_words (word, category) values
  -- 욕설
  ('씨발','abuse'),('시발','abuse'),('씨바','abuse'),('씨팔','abuse'),('시팔','abuse'),('씨빨','abuse'),('쉬발','abuse'),('씌발','abuse'),
  ('ㅆㅂ','abuse'),('ㅅㅂ','abuse'),('ㅂㅅ','abuse'),('ㅄ','abuse'),('ㅈㄹ','abuse'),
  ('병신','abuse'),('븅신','abuse'),('빙신','abuse'),('등신','abuse'),('새끼','abuse'),('새키','abuse'),('개색기','abuse'),('개세끼','abuse'),
  ('십새','abuse'),('씹새','abuse'),('씹창','abuse'),('씹년','abuse'),('개씹','abuse'),('좆','abuse'),('좃','abuse'),
  ('존나','abuse'),('졸라','abuse'),('존니','abuse'),('지랄','abuse'),('염병','abuse'),('썅','abuse'),('닥쳐','abuse'),
  ('아가리','abuse'),('대가리','abuse'),('쳐먹','abuse'),('처먹','abuse'),('쳐맞','abuse'),
  ('니애미','abuse'),('애미','abuse'),('니애비','abuse'),('니에미','abuse'),('느금','abuse'),('엠창','abuse'),
  ('미친놈','abuse'),('미친년','abuse'),('개년','abuse'),('또라이','abuse'),('찐따','abuse'),('저능아','abuse'),('정신병자','abuse'),
  ('개소리','abuse'),('개돼지','abuse'),('기레기','abuse'),
  ('fuck','abuse'),('shit','abuse'),('bitch','abuse'),('cunt','abuse'),('asshole','abuse'),
  -- 성적 표현
  ('섹스','sexual'),('꼴리','sexual'),('딸딸이','sexual'),('야동','sexual'),('창녀','sexual'),('화냥','sexual'),
  ('보슬아치','sexual'),('보빨','sexual'),('자댕이','sexual'),
  -- 혐오 표현
  ('짱깨','hate'),('짱개','hate'),('쪽바리','hate'),('쪽발이','hate'),('조센징','hate'),('깜둥이','hate'),('nigger','hate'),('nigga','hate'),
  ('한남충','hate'),('한녀충','hate'),('김치녀','hate'),('된장녀','hate'),('메갈','hate'),('일베충','hate'),('일게이','hate'),
  ('맘충','hate'),('급식충','hate'),('틀딱','hate'),('빨갱이','hate'),('좌빨','hate'),('수꼴','hate'),('대깨문','hate'),('문재앙','hate');

-- 닉네임 전체가 이 단어일 때만 (보지 마, 자지 마 같은 정상 문장을 막지 않게)
insert into public.banned_words (word, match, category) values
  ('보지','exact','sexual'),('자지','exact','sexual'),('dick','exact','sexual'),('pussy','exact','sexual');

insert into public.allowed_words (word) values
  ('시발점'),('시발역'),('수박씨발라'),('등신대'),('새끼손가락'),('새끼발가락'),('새끼고양이'),('새끼강아지'),('새끼오리'),('새끼줄'),
  ('졸라맨'),('졸라매'),('섹스피스톨즈'),('sexpistols'),('메갈로돈'),
  -- 붙여 쓴 '…시 발…' (출시발표, 동시발매)
  ('시발표'),('시발매'),('시발송'),('시발권'),('시발행'),('시발생'),('시발견'),('시발전'),('시발사');
