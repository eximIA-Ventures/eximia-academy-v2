# Migrations — Aprendizagem do Time

Duas migrations novas, para o domínio "Aprendizagem do Time" do Analytics do gestor (complementar a "Ativação da Jornada", já em produção). Este README existe para quem for aplicar/revisar essas duas migrations e não acompanhou o trabalho — provavelmente você.

## Os dois arquivos

| Arquivo | O que faz | Idempotente? |
|---|---|---|
| `20260821000000_aprendizagem_time_schema.sql` | Cria 8 tabelas novas (schema genérico de capacidades curriculares) + RLS | Sim (`CREATE TABLE IF NOT EXISTS`) |
| `20260821010000_aprendizagem_time_seed_analise_problemas.sql` | Semeia 5 capacidades + critérios pro curso "Análise e Solução de Problemas" | Sim (`ON CONFLICT DO UPDATE`, e é no-op silencioso — só um `RAISE NOTICE` — se esse curso ainda não existir no ambiente) |

Nenhuma tabela existente é alterada. Nenhuma escrita nessas 8 tabelas é permitida pro client autenticado — só o service client escreve (pipeline de classificação, fora do caminho de render).

## As 8 tabelas (schema)

1. **`concepts`** — conceito curricular, ancorado a um módulo (`chapter_id`, opcional) e a um curso (`course_id`, obrigatório).
2. **`capabilities`** — capacidade curricular, sempre ancorada a um curso.
3. **`capability_concepts`** — join N:N entre as duas acima.
4. **`capability_criteria`** — critério observável fixo por capacidade (nunca gerado em runtime).
5. **`capability_evidence`** — avaliação **por evidência individual** (compreensão / profundidade 1-7 / aplicação), pré-agregação. `concept_id` OU `capability_id` tem que estar preenchido (CHECK).
6. **`capability_assessments`** — maturidade **agregada** aluno×capacidade, uma linha por transição (nunca UPDATE — histórico completo).
7. **`capability_assessment_evidence`** — quais evidências embasaram qual avaliação.
8. **`capability_assessment_criteria`** — quais critérios foram/não foram atendidos em cada avaliação.

RLS: tabelas de currículo (`concepts`/`capabilities`/`capability_concepts`/`capability_criteria`) são de leitura ampla no tenant. `capability_evidence`/`capability_assessments` só o próprio aluno ou `instructor`/`admin`/`super_admin` — **de propósito, não há policy pra `manager`**. O gestor lê essas duas via `createServiceClient()` (service role), dentro da camada de leitura do Analytics — nunca direto do client autenticado. Isso é a mesma lição já aplicada em `20260703003114_fix_manager_privacy_gates.sql`.

## O que você precisa decidir/fazer

1. **Aplicar as duas migrations** no banco (`supabase db push`, ou colar no SQL editor do dashboard, na ordem dos nomes). São aditivas e seguras — não tocam em tabela existente.
2. **Conferir se o curso "Análise e Solução de Problemas" existe** nesse tenant antes de rodar o seed — se não existir, o seed roda sem erro mas não semeia nada (`RAISE NOTICE` avisa isso no log).
3. **`concepts` não é semeado por nenhuma migration.** Sem isso, os blocos que agrupam por "módulo" nas Telas 2/3 do Analytics (Padrões e Evolução, Mapa de Capacidades) mostram estado vazio honesto ("selecione um curso" / amostra insuficiente) em vez de dado — não é bug, é ausência de dado curado.
4. **`capability_evidence`/`capability_assessments` só populam via pipeline de classificação** (roda a partir de reflexões/quizzes/cenários já existentes, fora destas migrations). Sem rodar o pipeline pelo menos uma vez, essas tabelas ficam vazias e as telas do Analytics mostram "amostra insuficiente" em todo bloco.

## Como verificar que aplicou certo

Tem um script pronto em `apps/web/scripts/_diag-schema.mjs` — roda contra o Supabase real (precisa de `SUPABASE_SERVICE_ROLE_KEY` em `apps/web/.env.local`) e reporta: tenants existentes, se as 8 tabelas existem com as colunas certas, se o curso-alvo existe, e quanto dado real já tem em `capability_evidence`/`capability_assessments`.

```bash
cd apps/web
node scripts/_diag-schema.mjs
```

## Onde está o resto

A camada de leitura (`apps/web/src/lib/analytics/aprendizagem-time/`), os componentes de UI e as rotas do Analytics que consomem esse schema (3 telas: Visão Geral, Padrões e Evolução, Mapa de Capacidades) vieram num commit separado, na mesma branch — este README documenta só a parte de banco.
