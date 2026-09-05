# Harness de verificação — migration de convergência (Aprendizagem do Time)

Instrumentos usados para testar `supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql`
**sem tocar em produção**. Estão versionados porque um verificador que só existe
na máquina de quem escreveu não é verificador, é anedota.

## O que cada arquivo é

| Arquivo | O que faz |
|---|---|
| `loop7-q.sh` | Consulta **somente-leitura** ao Postgres de produção via Management API. Recusa, antes de enviar, qualquer consulta que contenha verbo de escrita. Foi como o terreno real foi levantado. |
| `harness.mjs` | Aplica a migration em **PGlite** (PostgreSQL real compilado para WASM) nos dois terrenos: réplica do schema vivo com dado dentro, e banco virgem. Verifica preservação de dado, backfills, estrutura, RLS, o `upsert` real do pipeline e a reaplicação. |
| `mutacao.mjs` | O contrapeso. (1) roda o par obsoleto nos dois terrenos para confirmar a premissa; (2) prova os 4 bloqueios independentes do `upsert` no terreno vivo; (3) sabota a migration em 4 pontos e exige que algo quebre; (4) roda a sequência completa das 4 migrations em ordem de timestamp. |
| `saida-harness.txt`, `saida-mutacao.txt` | Saídas literais da execução de 2026-08-28. |

## Como rodar

PGlite não é dependência deste repositório de propósito — o harness roda fora
dele, para não alterar `package.json`.

```bash
mkdir -p /tmp/pglite && cd /tmp/pglite && npm init -y && npm i @electric-sql/pglite
cp <repo>/docs/auditoria/consolidacao-2026-08-28/loop7-harness/{harness,mutacao}.mjs .
node harness.mjs
node mutacao.mjs
```

`mutacao.mjs` lê os corpos das migrations obsoletas via `git show d2b8083:…`,
então continua reproduzível depois de elas terem sido neutralizadas.

## Limite honesto deste instrumento

PGlite é **PostgreSQL 18.3**; produção é **PostgreSQL 17.6**. Nenhuma construção
usada pela migration mudou entre as duas versões (`ADD COLUMN IF NOT EXISTS`,
`DROP NOT NULL`, índice único não-parcial com `NULLS DISTINCT`, `DO $$`, RLS),
mas a diferença existe e está registrada.

E o andaime NÃO é produção: as tabelas-pai (`tenants`, `courses`, `chapters`,
`users`) são stubs mínimos, e os helpers de RLS (`auth_tenant_id()`,
`auth_user_role()`, `is_super_admin()`, `auth.uid()`) são funções constantes.
Isso testa a **estrutura e a aplicabilidade do DDL**, não o comportamento das
policies contra dado real de tenant. A prova de RLS com dado real exige
`BEGIN … SET LOCAL ROLE … RESET ROLE … ROLLBACK` contra o banco de verdade, e
está descrita no passo 5 do plano de aplicação, não aqui.
