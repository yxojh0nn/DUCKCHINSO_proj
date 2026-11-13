#!/bin/sh
# public·auth·storage 스키마를 custom 포맷(.dump)으로 받는다. 권한(GRANT·RLS)은 남기고 소유자만 뺀다
# storage 는 파일 메타데이터만 — 실제 사진 파일(버킷)은 이 백업에 없다
set -eu
: "${SUPABASE_DB_URL:?.env 에 SUPABASE_DB_URL 이 없습니다}"
out="/backups/duckchinso-$(date +%Y%m%d-%H%M%S).dump"

pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner \
  --schema=public --schema=auth --schema=storage --file="$out.part"
pg_restore --list "$out.part" > /dev/null   # 목차를 못 읽으면 깨진 파일 → set -e 로 중단, .part 로 남는다
mv "$out.part" "$out"

find /backups -name 'duckchinso-*.dump*' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
echo "백업 완료: $out ($(du -h "$out" | cut -f1))"
