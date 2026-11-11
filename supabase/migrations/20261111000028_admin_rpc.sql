-- 보안 점검 3단계-1 (2026-11-11) — L2: 운영자 쓰기를 서버 함수로
--   지금까지 운영자 화면이 artists·concerts·concert_artists·jpop_promoters·banned_words·allowed_words·kopis_inbox 에
--   브라우저에서 직접 읽고 썼다(막는 건 RLS 뿐). 같은 동작을 운영자 함수로 옮긴다.
--   표 권한 회수는 앱을 이 함수들로 바꿔 배포한 뒤 마이그 29 에서 한다 (먼저 회수하면 배포 전 운영자 화면이 깨진다).
--   모든 함수는 첫 줄에서 require_admin() → 아니면 forbidden. 변경 기록은 마이그 27 의 audit 트리거가 그대로 남긴다.

-- 아티스트 저장 (id 가 없으면 새로). 출처·작성자는 마이그 27 트리거가 정한다
create or replace function public.admin_save_artist(p_id uuid, p_name text, p_name_ja text, p_name_en text, p_aliases text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  perform public.require_admin();
  if coalesce(btrim(p_name), '') = '' then raise exception 'bad_request'; end if;
  if p_id is null then
    insert into public.artists (name, name_ja, name_en, aliases)
    values (btrim(p_name), nullif(btrim(p_name_ja), ''), nullif(btrim(p_name_en), ''), coalesce(p_aliases[1:30], '{}'))
    returning id into rid;
  else
    update public.artists set name = btrim(p_name), name_ja = nullif(btrim(p_name_ja), ''), name_en = nullif(btrim(p_name_en), ''),
           aliases = coalesce(p_aliases[1:30], '{}')
     where id = p_id returning id into rid;
    if rid is null then raise exception 'not_found'; end if;
  end if;
  return rid;
end $$;

-- 공연 게시: 상태·예매 오픈일, 출연 아티스트 교체, 그 공연의 기획사를 J-pop 기획사 목록에 쌓는다(다음 수집의 판별 근거)
create or replace function public.admin_publish_concert(p_id uuid, p_artist_ids uuid[], p_ticket_open_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare prom text;
begin
  perform public.require_admin();
  update public.concerts set status = 'published', ticket_open_at = p_ticket_open_at where id = p_id returning promoter into prom;
  if not found then raise exception 'not_found'; end if;
  delete from public.concert_artists where concert_id = p_id;
  insert into public.concert_artists (concert_id, artist_id)
  select p_id, a from unnest(coalesce(p_artist_ids, '{}')) a on conflict do nothing;
  insert into public.jpop_promoters (name)
  select distinct btrim(n) from unnest(string_to_array(coalesce(prom, ''), ',')) n
   where char_length(btrim(n)) between 2 and 60
  on conflict (name) do nothing;
end $$;

create or replace function public.admin_hide_concert(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.concerts set status = 'hidden' where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

-- KOPIS 수집함 검색 (제목 부분 일치, 50건)
create or replace function public.admin_search_inbox(q text)
returns table (kopis_id text, title text, venue text, start_date date, end_date date)
language plpgsql stable security definer set search_path = '' as $$
declare term text := btrim(regexp_replace(coalesce(q, ''), '[%_\\]', '', 'g'));
begin
  perform public.require_admin();
  if term = '' then return; end if;
  return query
  select i.kopis_id, i.title, i.venue, i.start_date, i.end_date from public.kopis_inbox i
   where i.title ilike '%' || term || '%' order by i.start_date limit 50;
end $$;

-- 금칙어·허용어 목록
create or replace function public.admin_words() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'banned', coalesce((select jsonb_agg(jsonb_build_object('word', word, 'match', match, 'category', category) order by created_at desc)
                        from public.banned_words), '[]'),
    'allowed', coalesce((select jsonb_agg(word order by created_at desc) from public.allowed_words), '[]'));
end $$;

create or replace function public.admin_add_word(p_word text, p_allowed boolean, p_match text default 'contains', p_category text default 'abuse')
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if coalesce(btrim(p_word), '') = '' then raise exception 'bad_request'; end if;
  if p_allowed then
    insert into public.allowed_words (word) values (p_word);
  else
    insert into public.banned_words (word, match, category) values (p_word, coalesce(p_match, 'contains'), coalesce(p_category, 'abuse'));
  end if;
exception when unique_violation then raise exception 'word_exists';
end $$;

create or replace function public.admin_delete_word(p_allowed boolean, p_word text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_allowed then delete from public.allowed_words where word = p_word;
  else delete from public.banned_words where word = p_word; end if;
end $$;

revoke execute on function public.admin_save_artist(uuid, text, text, text, text[]), public.admin_publish_concert(uuid, uuid[], timestamptz),
  public.admin_hide_concert(uuid), public.admin_search_inbox(text), public.admin_words(), public.admin_add_word(text, boolean, text, text),
  public.admin_delete_word(boolean, text) from public, anon;
grant execute on function public.admin_save_artist(uuid, text, text, text, text[]), public.admin_publish_concert(uuid, uuid[], timestamptz),
  public.admin_hide_concert(uuid), public.admin_search_inbox(text), public.admin_words(), public.admin_add_word(text, boolean, text, text),
  public.admin_delete_word(boolean, text) to authenticated;
