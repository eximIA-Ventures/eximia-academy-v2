# Epic 15: Chapter Ingestion Fixes (Correcoes do Fluxo de Ingestion de Capitulos)

**Version:** 1.0
**Created:** 2026-02-11
**Updated:** 2026-02-11
**Author:** Morgan (PM) com analise de Atlas (Analyst) e Aria (Architect)
**Status:** Done
**PRD Reference:** `docs/prd.md` — FR2 (Course Management), FR3 (Content Ingestion)
**Architecture Reference:** `docs/architecture.md` — Sections 3.1, 5.2

---

## Epic Goal

Corrigir todos os gaps identificados na feature de chapter ingestion (criacao de capitulos via IA), garantindo que dados da IA sejam persistidos corretamente, erros sejam tratados adequadamente e o fluxo funcione end-to-end sem perda de informacao.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, AI SDK 6.0, Claude Sonnet 4.5 |
| **DB Tables** | `chapters` (existente, requer novas colunas), `content_ingestions` (existente) |
| **AI Agent** | Organizer Agent (`packages/agents/src/organizer.ts`) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Roles Impactados** | manager, admin |
| **Dependencia Pacote** | Nenhuma nova |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Chapter ingestion wizard UI | Implementado | `apps/web/.../chapters/new/ingest/_components/chapter-ingestion-wizard.tsx` |
| Chapter preview UI | Implementado | `apps/web/.../chapters/new/ingest/_components/chapter-preview.tsx` |
| Chapter mode selector | Implementado | `apps/web/.../chapters/new/_components/chapter-mode-selector.tsx` |
| Approve-chapter API route | Implementado (incompleto) | `apps/web/src/app/api/ingestion/[id]/approve-chapter/route.ts` |
| Ingestion API routes (upload, paste, video-url, process) | Implementado | `apps/web/src/app/api/ingestion/` |
| ProcessingStatus component (SSE) | Implementado | `apps/web/.../courses/new/ingest/_components/processing-status.tsx` |
| ChapterEditorClient (manual creation) | Implementado | `apps/web/.../chapters/[chapterId]/edit/_components/chapter-editor-client.tsx` |
| Organizer Agent | Implementado | `packages/agents/src/organizer.ts` |
| content_ingestions table + RLS | Implementado | Migration `20260211000004` |

### Current Chapter Ingestion Flow

```
Manager navega para /courses/{id}/chapters/new
    → Escolhe modo: Manual ou Importar com IA
    → Se IA:
        → Upload/Paste/Video URL
        → AI processa conteudo (Organizer Agent, modo 1 capitulo)
        → Preview com titulo, objetivo, key_concepts, reading_time
        → Aprova → Capitulo criado
    → Se Manual:
        → ChapterEditorClient (formulario)
```

### What This Epic Fixes

```
ANTES (bugs):
  - key_concepts e estimated_reading_time_min gerados pela IA → DESCARTADOS
  - content_blocks, video_url, audio_url → NAO SALVOS
  - created_by → NAO RASTREADO
  - Pagina nao atualiza apos aprovacao (sem revalidatePath)
  - Sem error boundary → crash em erros nao tratados
  - SSE error handler silencioso → UI trava em "processando"
  - .single() no calculo de order → falha no primeiro capitulo manual
  - Validators nao aceitam campos da IA

DEPOIS (corrigido):
  - Todos os campos da IA persistidos no banco
  - created_by rastreado em todos os capitulos
  - Revalidacao automatica apos aprovacao
  - Error boundaries em todas as paginas de criacao
  - SSE com tratamento de erro adequado
  - Calculo de order robusto
  - Validators alinhados com output da IA
```

### Success Criteria

- [x] Capitulo criado via IA tem key_concepts e estimated_reading_time_min salvos no banco
- [x] content_blocks, video_url e audio_url sao salvos quando disponíveis
- [x] created_by preenchido em todos os capitulos (IA e manual)
- [x] Pagina do curso atualiza automaticamente apos aprovacao de capitulo
- [x] Erros na pagina de criacao mostram error boundary (nao crash)
- [x] Falha SSE notifica usuario (nao trava silenciosamente)
- [x] Criar primeiro capitulo manualmente funciona sem erro

---

## Stories

---

### Story 15.1: Migration — Novas Colunas na Tabela chapters

**As a** developer,
**I want** to add `created_by`, `key_concepts`, and `estimated_reading_time_min` columns to chapters,
**so that** AI-generated metadata and authorship are properly persisted.

**Story Points:** 2
**Priority:** P0 (foundation — bloqueia stories 15.2 e 15.3)
**Risk:** LOW — additive migration, nao quebra existente

#### Acceptance Criteria

- [x] **AC1:** Coluna `created_by UUID REFERENCES users(id)` adicionada (nullable para nao quebrar existentes)
- [x] **AC2:** Coluna `key_concepts TEXT[]` adicionada
- [x] **AC3:** Coluna `estimated_reading_time_min INTEGER` adicionada
- [x] **AC4:** Migration SQL funcional e reversivel
- [x] **AC5:** Supabase types regenerado (`pnpm supabase gen types`)

#### Technical Notes

```sql
-- supabase/migrations/20260211100000_chapter_ingestion_fixes.sql
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS key_concepts TEXT[];
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS estimated_reading_time_min INTEGER;

-- Backfill created_by from course creator for existing chapters
UPDATE chapters c
SET created_by = co.created_by
FROM courses co
WHERE c.course_id = co.id
AND c.created_by IS NULL;
```

#### Dev Notes

- Colunas nullable para compatibilidade retroativa
- Backfill usa created_by do curso como fallback
- Nao requer alteracao de RLS (herda do tenant via trigger existente)

---

### Story 15.2: Approve-Chapter Route — Persistir Todos os Campos da IA

**As a** manager,
**I want** all AI-generated metadata saved when I approve a chapter,
**so that** key_concepts, reading time, and media fields are preserved.

**Story Points:** 3
**Priority:** P0 (dados sendo perdidos em producao)
**Risk:** LOW — apenas expande insert existente

#### Acceptance Criteria

- [x] **AC1:** `created_by` incluido no insert de chapters (`user.id`)
- [x] **AC2:** `key_concepts` extraido do AI output e salvo
- [x] **AC3:** `estimated_reading_time_min` extraido do AI output e salvo
- [x] **AC4:** `content_blocks` salvo quando disponivel no AI output
- [x] **AC5:** `video_url` e `audio_url` salvos quando disponiveis no ingestion record
- [x] **AC6:** Validacao explicita de `ingestion.course_id IS NOT NULL` antes de prosseguir
- [x] **AC7:** `revalidatePath(/courses/${courseId})` chamado apos insercao
- [x] **AC8:** Testes unitarios para os novos campos

#### Technical Notes

```typescript
// approve-chapter/route.ts — insert expandido
.insert({
  course_id: ingestion.course_id,
  tenant_id: ingestion.tenant_id,
  created_by: user.id,
  title,
  content,
  learning_objective,
  key_concepts: chapterData.key_concepts ?? [],
  estimated_reading_time_min: chapterData.estimated_reading_time_min ?? null,
  content_blocks: chapterData.content_blocks ?? null,
  video_url: ingestion.source_type === "video_url" ? ingestion.source_url : null,
  order: nextOrder,
  status: "draft",
})
```

#### Dev Notes

- Importar `revalidatePath` de `next/cache`
- Validar que `ingestion.course_id` nao e null (retornar 400 se for)
- Extrair campos do `ai_output` parseado (JSON)

---

### Story 15.3: Validators — Alinhar Schema com Output da IA

**As a** developer,
**I want** the chapter validators to accept AI-generated fields,
**so that** validation doesn't reject valid AI output.

**Story Points:** 1
**Priority:** P1 (feature incompleta)
**Risk:** LOW — apenas adiciona campos opcionais ao schema

#### Acceptance Criteria

- [x] **AC1:** `createChapterSchema` aceita `key_concepts: z.array(z.string()).optional()`
- [x] **AC2:** `createChapterSchema` aceita `estimated_reading_time_min: z.number().int().positive().optional()`
- [x] **AC3:** Testes do validator atualizados
- [x] **AC4:** Nenhuma regressao nos fluxos existentes

#### Technical Notes

```typescript
// packages/shared/src/validators/chapters.ts
export const createChapterSchema = z.object({
  // ... campos existentes ...
  key_concepts: z.array(z.string()).optional(),
  estimated_reading_time_min: z.number().int().positive().optional(),
})
```

---

### Story 15.4: Error Handling — Error Boundaries e SSE Resilience

**As a** manager,
**I want** proper error handling during chapter creation,
**so that** errors don't crash the page and I'm notified of connection failures.

**Story Points:** 2
**Priority:** P1 (qualidade UX)
**Risk:** LOW — adiciona componentes de error handling

#### Acceptance Criteria

- [x] **AC1:** `error.tsx` criado em `/courses/[courseId]/chapters/new/`
- [x] **AC2:** Error boundary exibe mensagem amigavel com botao "Tentar novamente"
- [x] **AC3:** SSE `onerror` handler chama `onError()` ao inves de falhar silenciosamente
- [x] **AC4:** Toast de erro exibido ao usuario quando conexao SSE falha
- [x] **AC5:** UI nao fica presa em "processando" apos falha SSE

#### Technical Notes

```tsx
// chapters/new/error.tsx
"use client"
import { Button } from "@eximia/ui"

export default function ChapterCreationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h2 className="text-lg font-semibold text-text-primary">
        Erro ao criar capitulo
      </h2>
      <p className="text-sm text-text-secondary">{error.message}</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
```

```typescript
// processing-status.tsx — fix SSE error handler
eventSource.onerror = () => {
  eventSource.close()
  onError?.("Conexao perdida com o servidor. Tente novamente.")
}
```

---

### Story 15.5: Fix — Calculo de Order e createChapter Action

**As a** manager,
**I want** manual chapter creation to work even for the first chapter,
**so that** I can create chapters regardless of the course state.

**Story Points:** 1
**Priority:** P1 (bug)
**Risk:** LOW — troca `.single()` por `.maybeSingle()`

#### Acceptance Criteria

- [x] **AC1:** `actions.ts` usa `.maybeSingle()` no calculo de max order
- [x] **AC2:** `created_by` incluido no insert de `createChapter` action
- [x] **AC3:** Criar primeiro capitulo de um curso vazio funciona sem erro
- [x] **AC4:** Teste cobrindo cenario de curso vazio (0 capitulos)

#### Technical Notes

```typescript
// chapters/actions.ts — fix order calculation
const { data: maxOrder } = await supabase
  .from("chapters")
  .select("order")
  .eq("course_id", courseId)
  .order("order", { ascending: false })
  .limit(1)
  .maybeSingle()  // era .single() — falha quando nao ha capitulos

const nextOrder = (maxOrder?.order ?? 0) + 1
```

---

## Dependency Map

```
Story 15.1 (Migration)
    ├──▶ Story 15.2 (Approve-Chapter — depende das novas colunas)
    └──▶ Story 15.3 (Validators — depende dos novos campos)

Story 15.4 (Error Handling) — independente
Story 15.5 (Fix Order + created_by) — depende de 15.1 (para created_by)
```

```
Ordem recomendada:
  15.1 → 15.2 + 15.3 (paralelo) → 15.4 + 15.5 (paralelo)
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration falha em producao | Baixa | Alto | Colunas nullable, backfill seguro |
| Regressao no fluxo de curso (Epic 13) | Baixa | Medio | Testes existentes cobrem fluxo de curso |
| AI output sem campos esperados | Media | Baixo | Defaults (`?? null`, `?? []`) em todos os campos |
| SSE fix quebra fluxo existente | Baixa | Medio | Testar ambos fluxos (curso e capitulo) |

---

## Estimated Effort

| Story | Points | Estimativa |
|-------|--------|-----------|
| 15.1 — Migration | 2 | Rapida |
| 15.2 — Approve-Chapter | 3 | Media |
| 15.3 — Validators | 1 | Rapida |
| 15.4 — Error Handling | 2 | Rapida |
| 15.5 — Fix Order | 1 | Rapida |
| **Total** | **9** | |

---

## Files Impacted

| File | Stories | Change |
|------|---------|--------|
| `supabase/migrations/20260211100000_*.sql` | 15.1 | Nova migration |
| `packages/database/src/types/supabase.ts` | 15.1 | Regenerado |
| `apps/web/src/app/api/ingestion/[id]/approve-chapter/route.ts` | 15.2 | Expandir insert + revalidatePath |
| `packages/shared/src/validators/chapters.ts` | 15.3 | Novos campos opcionais |
| `apps/web/.../chapters/new/error.tsx` | 15.4 | Novo arquivo |
| `apps/web/.../courses/new/ingest/_components/processing-status.tsx` | 15.4 | Fix SSE onerror |
| `apps/web/.../courses/[courseId]/chapters/actions.ts` | 15.5 | Fix .single() + created_by |
