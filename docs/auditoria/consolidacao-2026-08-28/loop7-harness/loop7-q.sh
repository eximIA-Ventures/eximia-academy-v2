#!/bin/bash
# Consulta SOMENTE-LEITURA contra o Postgres de produção do eximia-academy-v2
# via Management API. Recusa qualquer verbo de escrita antes de enviar.
set -euo pipefail

PROJ="vaguswivhqnlbgqvnjch"
RAW=$(security find-generic-password -s "Supabase CLI" -a supabase -w)
PAT=$(printf '%s' "${RAW#go-keyring-base64:}" | base64 --decode)

SQL=$(cat "$1")

# Poka-yoke: o guarda fica fora do alcance de quem escreve a consulta.
if printf '%s' "$SQL" | grep -qiE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on|refresh|vacuum|copy)\b'; then
  echo "RECUSADO: a consulta contém verbo de escrita." >&2
  exit 2
fi

curl -sS -X POST "https://api.supabase.com/v1/projects/$PROJ/database/query" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  --data "$(jq -Rn --arg q "$SQL" '{query:$q}')"
echo
