#!/usr/bin/env bash
# Weekly encrypted database backup to Tigris.
#
#   pg_dump -Fc (direct URL, read-only session)  ->  age (owner's public key)
#   ->  t3://nexa-lms-backups/db/YYYY-MM-DD.dump.age  (+ .sha256)
#
# The plaintext dump never touches disk: pg_dump pipes straight into age.
# Nothing is printed that contains a URL, password, key or token.
#
# Runbook: docs/revamp/a/ops/backup-runbook.md
#
# Usage:
#   scripts/db-backup.sh --dry-run     # checks env names and tools, prints the plan; no network.
#                                      # Exits 3 if a variable or tool is missing.
#   scripts/db-backup.sh               # real backup (owner approval needed: it reads production)
#
# Flags:
#   --dry-run          no network at all: no database, no Tigris
#   --date YYYY-MM-DD  object name date (default: today, UTC)
#   --overwrite        replace an existing object for that date (default: refuse)
#
# Env:
#   BACKUP_DATABASE_URL   Postgres URL, DIRECT (non-pooled) endpoint. A read-only role is best.
#   AGE_RECIPIENT         the owner's age public key (age1...). Or AGE_RECIPIENTS_FILE: a file of keys.
#   TIGRIS_STORAGE_ACCESS_KEY_ID, TIGRIS_STORAGE_SECRET_ACCESS_KEY
#                         Tigris access key scoped to the bucket. Not needed if `tigris configure`
#                         or `tigris login` already ran on this machine.
#   BACKUP_BUCKET         default nexa-lms-backups
#   BACKUP_PREFIX         default db
#   TIGRIS_BIN            default: tigris
#   PG_DUMP_BIN           default: pg_dump (must be version 17 or newer)

set -euo pipefail
umask 077

DRY_RUN=0
OVERWRITE=0
DATE="$(date -u +%Y-%m-%d)"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --overwrite) OVERWRITE=1 ;;
    --date) shift; DATE="${1:-}" ;;
    -h|--help) sed -n '2,31p' "$0"; exit 0 ;;
    *) echo "db-backup: unknown flag $1" >&2; exit 2 ;;
  esac
  shift
done

BUCKET="${BACKUP_BUCKET:-nexa-lms-backups}"
PREFIX="${BACKUP_PREFIX:-db}"
TIGRIS="${TIGRIS_BIN:-tigris}"
PG_DUMP="${PG_DUMP_BIN:-pg_dump}"
OBJECT="t3://${BUCKET}/${PREFIX}/${DATE}.dump.age"

log()  { printf '%s  %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die()  { printf 'db-backup: %s\n' "$*" >&2; exit 1; }
warn() { printf 'db-backup: warning: %s\n' "$*" >&2; }

# ---------------------------------------------------------------- checks (no network)

[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "--date must be YYYY-MM-DD"

problems=0
need_env() {
  if [ -z "${!1:-}" ]; then
    if [ "$DRY_RUN" = 1 ]; then warn "$1 is not set"; else die "$1 is not set"; fi
    problems=$((problems + 1))
  else
    log "env $1: set"
  fi
}
need_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    if [ "$DRY_RUN" = 1 ]; then warn "tool '$1' not found on PATH"; else die "tool '$1' not found on PATH"; fi
    problems=$((problems + 1))
    return 1
  fi
  log "tool $1: found"
}

need_env BACKUP_DATABASE_URL
if [ -n "${AGE_RECIPIENTS_FILE:-}" ]; then
  [ -s "$AGE_RECIPIENTS_FILE" ] || die "AGE_RECIPIENTS_FILE does not exist or is empty"
  log "env AGE_RECIPIENTS_FILE: set"
  AGE_ARGS=(-R "$AGE_RECIPIENTS_FILE")
else
  need_env AGE_RECIPIENT
  AGE_ARGS=(-r "${AGE_RECIPIENT:-}")
  if [ -n "${AGE_RECIPIENT:-}" ] && [[ ! "$AGE_RECIPIENT" =~ ^age1[0-9a-z]{58}$ ]]; then
    die "AGE_RECIPIENT does not look like an age public key (age1 followed by 58 characters). Never use the private key (AGE-SECRET-KEY-...) here."
  fi
fi
if [ -z "${TIGRIS_STORAGE_ACCESS_KEY_ID:-}" ] || [ -z "${TIGRIS_STORAGE_SECRET_ACCESS_KEY:-}" ]; then
  log "env TIGRIS_STORAGE_*: not set; relying on 'tigris configure' or 'tigris login' on this machine"
else
  log "env TIGRIS_STORAGE_*: set"
fi

# The URL must be the direct endpoint: pg_dump through a transaction pooler is unsupported.
if [ -n "${BACKUP_DATABASE_URL:-}" ]; then
  host="$(printf '%s' "$BACKUP_DATABASE_URL" | sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#')"
  case "$host" in
    *-pooler.*|*pgbouncer*) die "BACKUP_DATABASE_URL points at a pooled endpoint. Use the direct (non-pooled) URL." ;;
  esac
  log "database host: $host"
fi

if need_tool "$PG_DUMP"; then
  major="$("$PG_DUMP" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
  if [ "${major:-0}" -lt 17 ]; then
    if [ "$DRY_RUN" = 1 ]; then warn "pg_dump $major is older than the server (17)"; problems=$((problems + 1));
    else die "pg_dump $major is older than the server (17). Install the PostgreSQL 17 client."; fi
  fi
fi
need_tool age || true
need_tool "$TIGRIS" || true
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || need_tool sha256sum || true

if [ "$DRY_RUN" = 1 ]; then
  cat <<EOF

DRY RUN: nothing was contacted. A real run would:
  1. ${TIGRIS} stat ${OBJECT}            (refuse if it exists, unless --overwrite)
  2. ${PG_DUMP} --format=custom --no-owner --no-privileges   (read-only session, direct URL)
       | age ${AGE_ARGS[0]} <owner public key>  >  <temp dir>/${DATE}.dump.age
  3. check the file starts with the age header and is not tiny
  4. ${TIGRIS} cp <temp>/${DATE}.dump.age ${OBJECT}
     ${TIGRIS} cp <temp>/${DATE}.dump.age.sha256 ${OBJECT}.sha256
  5. ${TIGRIS} stat ${OBJECT}            (confirm the upload), then delete the temp dir
Problems found: ${problems}
EOF
  [ "$problems" -eq 0 ] || exit 3
  exit 0
fi

# ---------------------------------------------------------------- real run

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FILE="$WORK/${DATE}.dump.age"

log "checking ${OBJECT} does not exist yet"
if "$TIGRIS" stat "$OBJECT" >/dev/null 2>&1; then
  [ "$OVERWRITE" = 1 ] || die "${OBJECT} already exists. Pass --overwrite to replace it, or --date for another name."
  warn "${OBJECT} exists and will be replaced (--overwrite)"
fi

log "dumping (pg_dump -Fc, read-only session) and encrypting with age"
# default_transaction_read_only makes the session refuse writes, belt and braces.
PGOPTIONS="-c default_transaction_read_only=on" PGCONNECT_TIMEOUT=20 PGAPPNAME=nexa-db-backup \
  "$PG_DUMP" --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" \
  | age "${AGE_ARGS[@]}" -o "$FILE"

header="$(head -c 21 "$FILE")"
[ "$header" = "age-encryption.org/v1" ] || die "output is not an age file; stopping"
bytes="$(wc -c < "$FILE" | tr -d ' ')"
[ "$bytes" -gt 10000 ] || die "encrypted dump is only ${bytes} bytes; that is too small for this database"
log "encrypted dump: ${bytes} bytes"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$WORK" && sha256sum "${DATE}.dump.age" > "${DATE}.dump.age.sha256")
else
  (cd "$WORK" && shasum -a 256 "${DATE}.dump.age" > "${DATE}.dump.age.sha256")
fi

log "uploading to ${OBJECT}"
"$TIGRIS" cp "$FILE" "$OBJECT" --yes >/dev/null
"$TIGRIS" cp "$FILE.sha256" "${OBJECT}.sha256" --yes >/dev/null
"$TIGRIS" stat "$OBJECT" >/dev/null || die "upload could not be confirmed with tigris stat"

log "done: ${OBJECT} (${bytes} bytes). The temp copy is deleted on exit."
