# Architecture Review — exímIA Academy

**Versão:** 2.0
**Data:** 2026-02-07
**Autor:** Quinn (QA Agent)
**Status:** Re-Review Complete (v1.1 validation)
**Inputs:** `docs/architecture.md` v1.1, `docs/prd.md` v1.0, `docs/benchmark-agentes-socraticos.md` v1.0

---

## Review History

| Versão | Data | Escopo | Resultado |
|--------|------|--------|-----------|
| 1.0 | 2026-02-07 | Review de `architecture.md` v1.0 | 25 findings (4C, 6H, 10M, 5L) — Score 7/10 |
| 2.0 | 2026-02-07 | Re-review de `architecture.md` v1.1 — validação dos 4 CRITICAL fixes + 3 bonus HIGH fixes aplicados por Aria | Score 8.3/10 |

---

## Executive Summary

A v1.1 da arquitetura resolve com sucesso **todos os 4 issues CRITICAL** e **3 dos 6 issues HIGH** da review anterior. A qualidade da implementação dos fixes é alta — uso de `claim_session_turn` para atomicidade, DataStream protocol para streaming, denormalization com triggers para RLS, e schema completo vs PRD.

Porém, a re-review identificou **1 novo issue HIGH** introduzido pelos fixes (RLS policies permissivas demais — estudantes podem ver/modificar sessões de outros alunos no mesmo tenant) e confirma que **3 HIGH, 10 MEDIUM e 5 LOW** do review original permanecem abertos.

| Severidade | v1.0 | Resolvidos | Novos | **v1.1 Abertos** |
|-----------|------|-----------|-------|------------------|
| CRITICAL | 4 | 4 | 0 | **0** |
| HIGH | 6 | 3 (H2, H5, H6) | 1 (N1) | **4** |
| MEDIUM | 10 | 0 | 1 (N2) | **11** |
| LOW | 5 | 0 | 0 | **5** |
| **Total** | **25** | **7** | **2** | **20** |

---

## CRITICAL Issues — Validation

### C1: Streaming ~~não implementado~~ — RESOLVED

**Fix aplicado:** Seção 10.2 reescrita com `ReadableStream` + Vercel AI SDK DataStream protocol.

**Validação:**
- API route agora retorna `new Response(stream, { headers: { 'X-Vercel-AI-Data-Stream': 'v1' } })` — compatível com `useChat()`
- Text chunks usam protocolo `0:"text"\n` (correto para DataStream)
- Session metadata enviado como data annotation `2:[data]\n` (correto)
- Palavras são streamed com 25ms delay simulando typing natural

**Nota:** O streaming é "deferred" — o pipeline completo (Analyst + Socrates + Editor + Tester) executa server-side ANTES de iniciar o stream. Isso é correto arquiteturalmente: o Tester precisa validar a resposta antes de enviar ao aluno. O aluno verá um loading state por ~10-15s e depois a resposta aparece word-by-word. Isso é um trade-off aceitável dado o quality gate do Tester.

**Veredicto: RESOLVED**

---

### C2: Race condition ~~no contador de interações~~ — RESOLVED

**Fix aplicado:** PostgreSQL function `claim_session_turn` com `UPDATE...WHERE...RETURNING` atômico.

**Validação:**
- A function executa um único `UPDATE` com condições `WHERE s.status = 'active' AND s.interactions_remaining > 0`
- Se dois requests chegam simultaneamente, apenas um obtém rows (o segundo recebe NULL → 409)
- O `SECURITY DEFINER` é necessário para bypass de RLS (a function valida ownership via `s.student_id = p_user_id`)
- `turn_number` calculado corretamente como `max_interactions - interactions_remaining` (counting UP)
- Status auto-transiciona para `completed` quando `interactions_remaining - 1 <= 0`

**Validação do cálculo turn_number:**
- Turn 1: `remaining` 3→2, `turn = 3 - 2 = 1` (correto)
- Turn 2: `remaining` 2→1, `turn = 3 - 1 = 2` (correto)
- Turn 3: `remaining` 1→0, `turn = 3 - 0 = 3` (correto)

**Veredicto: RESOLVED**

---

### C3: RLS ~~não funcional~~ — RESOLVED

**Fix aplicado:** `tenant_id` adicionado a todas as 5 tabelas faltantes + triggers de auto-populate + `auth_tenant_id()` helper + policies em todas as 9 tabelas.

**Validação:**
- **Tabelas:** `chapters`, `questions`, `messages`, `analyses`, `qa_reports` agora têm `tenant_id UUID NOT NULL REFERENCES tenants(id)`
- **Triggers (5):** `trg_chapters_tenant_id` (copia de `courses`), `trg_questions_tenant_id` (copia de `chapters`), `trg_messages_tenant_id`, `trg_analyses_tenant_id`, `trg_qa_reports_tenant_id` (copiam de `sessions`)
- **Helper:** `auth_tenant_id()` — `SECURITY DEFINER STABLE` — usa `auth.uid()` para lookup de tenant
- **Policies:** `tenant_isolation ON {table} FOR ALL USING (tenant_id = auth_tenant_id())` em todas as 9 tabelas
- **Indexes:** Todos os novos `tenant_id` têm indexes dedicados

**Issue novo identificado: ver N1 abaixo (policies permissivas demais)**

**Veredicto: RESOLVED (mas ver N1 para refinamento de policies)**

---

### C4: Schema ~~incompleto vs PRD~~ — RESOLVED

**Fix aplicado:** Adicionados todos os campos faltantes ao SQL e TypeScript.

**Validação checklist:**

| Campo | Status | Evidência |
|-------|--------|-----------|
| `questions.status` | Added | `CHECK (status IN ('pending', 'active', 'rejected'))`, default `'pending'` |
| `questions.approved_by` | Added | `UUID REFERENCES users(id)` |
| `chapters.tenant_id` | Added | Com trigger `trg_chapters_tenant_id` |
| `questions.tenant_id` | Added | Com trigger `trg_questions_tenant_id` |
| `messages.tenant_id` | Added | Com trigger `trg_messages_tenant_id` |
| `analyses.tenant_id` | Added | Com trigger `trg_analyses_tenant_id` |
| `qa_reports.tenant_id` | Added | Com trigger `trg_qa_reports_tenant_id` |
| `updated_at` em tabelas mutáveis | Added | `tenants`, `users`, `courses`, `chapters`, `questions`, `enrollments`, `sessions` — com triggers `update_updated_at()` |
| `enrollment.progress` CHECK | Added | `CHECK (progress >= 0 AND progress <= 100)` |
| Partial index sessões ativas | Added | `idx_sessions_active ON sessions(student_id, chapter_id) WHERE status = 'active'` |
| Partial index questions ativas | Added | `idx_questions_active ON questions(chapter_id, status) WHERE status = 'active'` |

**TypeScript models sincronizados:** Chapter, Question, Message, Analysis, QAReport — todos com `tenant_id` e campos extras.

**Veredicto: RESOLVED**

---

## HIGH Issues — Status Update

### H1: Editor Agent schema mismatch com benchmark — STILL OPEN

**Status:** Not addressed in v1.1.
**Seção 7.3** ainda mostra apenas o `socratesStep` como exemplo. O `PipelineContext` não demonstra como o `raw_response` + `context` fluem para o Editor, conforme contrato I/O do benchmark.

**Impacto:** Implementador pode não passar dados corretos para o Editor, causando respostas de baixa qualidade.

---

### H2: `turn_number` ~~com semântica invertida~~ — RESOLVED

**Fix:** `claim_session_turn` calcula `turn_number` counting UP (1, 2, 3). API route usa `turn.turn_number`. Message interface comment atualizado: `// 1, 2, 3 (counting UP)`.

---

### H3: Cascading deletes sem proteção — STILL OPEN

**Status:** Not addressed in v1.1. Todas as tabelas filhas ainda usam `ON DELETE CASCADE`. Deletar um `course` ainda cascadeia destruição de chapters → questions → sessions → messages → analyses → qa_reports.

---

### H4: Vercel Functions timeout — STILL OPEN

**Status:** Not addressed in v1.1. Seção 12.1 (Prerequisites) lista Node.js 22, pnpm, Supabase CLI, Vercel CLI mas não menciona Vercel Pro plan como requisito. Seção 15 ainda não documenta que o pipeline de 4 LLM calls pode exceder 60s.

---

### H5: ~~Falta index composto para sessões ativas~~ — RESOLVED

**Fix:** `CREATE INDEX idx_sessions_active ON sessions(student_id, chapter_id) WHERE status = 'active'` adicionado à seção 10.3.

---

### H6: ~~Enrollment.progress permite valores inválidos~~ — RESOLVED

**Fix:** `CHECK (progress >= 0 AND progress <= 100)` adicionado ao schema.

---

## NEW Issues (Introduced by v1.1 Fixes)

### N1 (HIGH): RLS policies permissivas demais — students podem ver sessões de outros alunos

**Seção:** 10.3 (RLS Policies, linhas 1284-1305)
**Problema:** A policy `tenant_isolation ON sessions FOR ALL USING (tenant_id = auth_tenant_id())` concede **todas as operações** (SELECT, INSERT, UPDATE, DELETE) a **qualquer usuário** do mesmo tenant. A policy adicional `student_own_sessions` (FOR SELECT) é **redundante** porque PostgreSQL faz OR de policies para a mesma operação.

**Resultado prático:**
- Um student pode SELECT todas as sessões de todos os alunos do tenant (não só as suas)
- Um student pode UPDATE/DELETE sessões de outros alunos
- Um student pode SELECT todas as messages de outros alunos (mesma issue em `student_own_messages`)

**Impacto:** Violação de privacidade entre alunos do mesmo tenant. Em ambiente corporativo, um colaborador veria as interações de outro.

**Recomendação:** Refatorar as policies em 2 camadas:
```sql
-- Layer 1: Tenant boundary (todas as operações passam por aqui)
-- Usar WITH CHECK para INSERT/UPDATE
CREATE POLICY tenant_boundary ON sessions
  FOR ALL USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Layer 2: Role-based access (mais restritivo)
-- Students: apenas suas próprias sessões
CREATE POLICY student_sessions ON sessions
  FOR SELECT USING (
    student_id = auth.uid()
  );
-- Teachers/admins: todas do tenant
CREATE POLICY staff_sessions ON sessions
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher', 'admin', 'manager')
  );
```

Ou usar a abordagem single-policy:
```sql
CREATE POLICY sessions_access ON sessions
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND (
      student_id = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher', 'admin', 'manager')
    )
  );
```

---

### N2 (MEDIUM): `auth_tenant_id()` helper definida 2x no documento

**Seção:** 8.1 (linha ~587) e 10.3 (linha ~1279)
**Problema:** A function `auth_tenant_id()` aparece definida em duas seções diferentes do documento. Embora sejam idênticas e no SQL real seria apenas uma, pode confundir o implementador sobre qual é a "versão oficial".

**Recomendação:** Manter a definição apenas na seção 10.3 (SQL Schema) e referenciar de 8.1 com "ver seção 10.3".

---

## MEDIUM Issues — Status (All Still Open)

| ID | Issue | Status |
|----|-------|--------|
| M1 | Sem versionamento de prompts | Open |
| M2 | Sem paginação definida para APIs | Open |
| M3 | Supabase Realtime vs SSE — transporte misto | Open |
| M4 | Sem middleware de rate limiting | Open |
| M5 | Sem fallback se LLM down | Open |
| M6 | Falta `response_time_seconds` no frontend → backend | **Partially addressed** — v1.1 API route agora aceita `response_time_seconds` no POST body e passa para `runAnalyst()`, mas o frontend component (`SocraticChat`) não captura nem envia esse campo |
| M7 | Sem LGPD prática | Open |
| M8 | Biome vs ESLint coverage | Open |
| M9 | TypeScript vs SQL divergem | **Improved** — M9 parcialmente resolvido: `Question` agora tem `status` no TypeScript, mas `Session.status` no TS ainda não inclui `exported/export_failed` do benchmark |
| M10 | Sem connection pooling documentado | Open |

---

## LOW Issues — Status (All Still Open)

L1 (PostHog + LGPD), L2 (Backups), L3 (Meta tags/SEO), L4 (packages/ui vs components/ui), L5 (Health check endpoint) — nenhum endereçado em v1.1.

---

## Updated PRD Coverage Matrix

| Req | v1.0 | v1.1 | Delta |
|-----|------|------|-------|
| FR1 | Parcial | Parcial | — |
| FR2 | Sim | Sim | — |
| FR3 | Sim | Sim | — |
| FR4 | Sim | Sim | — |
| FR5 | Sim | Sim | — |
| FR6 | Sim | Sim | — |
| FR7 | Sim | Sim | — |
| FR8 | Sim | Sim | — |
| FR9 | Sim | Sim | — |
| FR10 | Sim | Sim | — |
| FR11 | Sim | Sim | — |
| FR12 | Sim | Sim | — |
| FR13 | Sim | Sim | — |
| FR14 | Sim | Sim | — |
| FR15 | Sim | Sim | — |
| FR16 | Parcial | Parcial | — |
| FR17 | Parcial | Parcial | — |
| FR18 | Parcial | Parcial | — |
| FR19 | Parcial | Parcial | — |
| FR20 | Parcial | Parcial | — |
| NFR1 | Em risco | **Sim** | Streaming implementado via DataStream |
| NFR2 | Sim | Sim | — |
| NFR3 | Sim | Sim | — |
| NFR4 | **Falha** | **Sim*** | RLS funcional, mas policies precisam refinamento (N1) |
| NFR5 | Parcial | Parcial | — |
| NFR6 | Sim | Sim | — |
| NFR7 | Sim | Sim | — |
| NFR8 | Sim | Sim | — |
| NFR9 | Sim | Sim | — |
| NFR10 | N/A | N/A | — |
| NFR11 | Parcial | Parcial | — |
| NFR12 | Sim | Sim | — |

**v1.1 Score: 24/32 (75%) totalmente cobertos, 7 parciais, 0 em falha** (vs v1.0: 69%)

---

## Recomendações Prioritárias (Updated)

### Antes de iniciar implementação (Story 1.1):

1. ~~Atualizar SQL schema com tenant_id em TODAS as tabelas~~ **DONE**
2. ~~Definir RLS policies para todas as 9 tabelas~~ **DONE (mas ver N1)**
3. ~~Documentar estratégia de streaming~~ **DONE**
4. ~~Adicionar decremento atômico~~ **DONE**
5. **NEW: Refatorar RLS policies** para restringir students a seus próprios dados (N1)

### Durante Epic 1:

6. Adicionar soft delete strategy (H3 — still open)
7. Definir padrão de paginação para API routes (M2)
8. Validar Biome vs ESLint coverage (M8)
9. Documentar Vercel Pro como requisito (H4 — still open)

### Durante Epic 2-3:

10. Garantir contratos I/O completos no pipeline (H1)
11. Definir circuit breaker para LLM downtime (M5)
12. Implementar rate limiting no middleware (M4)
13. Capturar `response_time_seconds` no frontend (M6)
14. Definir versionamento de prompts (M1)

---

## Veredicto v1.1

| Aspecto | v1.0 | v1.1 | Delta |
|---------|------|------|-------|
| Visão geral | 9/10 | 9/10 | — |
| Data model | 6/10 | **8.5/10** | +2.5 — Schema completo, triggers, indexes |
| Agent integration | 8/10 | 8/10 | — |
| Security | 5/10 | **7/10** | +2 — RLS funcional (mas policies precisam de refinamento) |
| Performance | 7/10 | **8.5/10** | +1.5 — Streaming, atomic claim, partial indexes |
| Code examples | 6/10 | **8.5/10** | +2.5 — API route completo com streaming + atomic claim |
| Completeness vs PRD | 7/10 | **7.5/10** | +0.5 — NFR1 e NFR4 resolvidos |
| **Overall** | **7/10** | **8.3/10** | **+1.3 — Pronta para implementação com refinamento de RLS** |

### Assessment

A arquitetura v1.1 é **significativamente mais sólida** que a v1.0. Os 4 CRITICAL fixes foram implementados com qualidade:

- **Streaming (C1):** Implementação pragmática — pipeline completo server-side + stream do resultado. Trade-off correto.
- **Atomicidade (C2):** `claim_session_turn` é elegante — single UPDATE atômico com cálculo de turn_number inline.
- **RLS (C3):** Denormalization com triggers é o pattern recomendado para Supabase multi-tenant. Completo e consistente.
- **Schema (C4):** Todos os campos faltantes adicionados. TypeScript e SQL agora sincronizados.

**Blocker restante antes de Story 1.1:** Apenas **N1** (refatorar RLS policies para restringir acesso student-to-student). As demais issues (H1, H3, H4, M1-M10, L1-L5) podem ser endereçadas durante implementação sem risco de retrabalho.

**Gate decision: CONCERNS** — Aprovar com a condição de resolver N1 antes de implementar as RLS policies no Supabase.

---

*Re-review gerada por Quinn (QA Agent) — exímIA Academy Architecture Review v2.0*
