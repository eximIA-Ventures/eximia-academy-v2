# Story 13.5: Ingestion Wizard UI (Upload, Processamento, Preview)

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 8
**Priority:** P0 (user-facing interface)
**Blocked By:** Story 13.2, Story 13.3, Story 13.4
**Blocks:** Story 13.6
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** a step-by-step wizard interface to upload content and see AI processing in real-time,
**so that** the content ingestion experience is intuitive and transparent.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 6.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management) |
| **Stack** | Next.js 15, React 19, @eximia/ui, Tailwind v4, SSE |
| **DB Tables** | `content_ingestions` (read status) |
| **QA Notes** | Testar fluxo completo E2E, responsividade |

---

## Acceptance Criteria

- [ ] **AC1:** Pagina `/courses/new` atualizada com seletor de modo
  - Card 1: "Criar manualmente" — icone de formulario, redireciona para fluxo atual
  - Card 2: "Importar com IA" — icone de upload/AI, redireciona para `/courses/new/ingest`
  - Design usando Card component de @eximia/ui
- [ ] **AC2:** Wizard Step 1 — Fonte do Conteudo (`/courses/new/ingest`)
  - Tabs component: "Upload Arquivo" | "Colar Texto" | "URL de Video"
  - **Upload Arquivo:**
    - Dropzone com drag & drop (visual: borda dashed, icone de upload)
    - Aceita: PDF, DOCX, TXT (com labels visuais)
    - Aceita: MP3, WAV, M4A, OGG (area separada ou auto-detect)
    - Validacao visual: formato invalido mostra erro, tamanho mostra limite
    - Preview do arquivo selecionado (nome, tamanho, icone)
  - **Colar Texto:**
    - Textarea com placeholder explicativo
    - Contador de caracteres (min 200, visual verde/vermelho)
    - Campo titulo opcional
  - **URL de Video:**
    - Input de URL com validacao inline
    - Preview do video (reutilizar VideoPreview component)
    - Suporte: YouTube
  - Botao "Processar com IA" (disabled ate input valido)
- [ ] **AC3:** Wizard Step 2 — Processamento
  - Tela de loading com steps visuais:
    1. "Enviando arquivo..." (se upload)
    2. "Extraindo texto..." (ou "Transcrevendo audio...")
    3. "Organizando conteudo com IA..."
  - Progress indicator (ProgressBar de @eximia/ui)
  - Icone animado ou spinner
  - Estimativa: "Isso pode levar ate X segundos"
  - Botao "Cancelar" sempre disponivel
  - SSE para atualizacao em tempo real do status
- [ ] **AC4:** Wizard Step 3 — Preview do Curso
  - Header com titulo e descricao editaveis (Input + Textarea)
  - Metadata: complexidade, topicos principais, numero de capitulos
  - Lista de capitulos em cards:
    - Titulo editavel (click to edit)
    - Objetivo de aprendizagem visivel
    - Conteudo colapsavel (Accordion)
    - Key concepts como badges
    - Tempo estimado de leitura
    - Botao deletar capitulo (com confirmacao)
  - Drag & drop para reordenar capitulos
  - Botao "Adicionar capitulo" (abre form manual)
  - Botao "Regenerar" com campo de instrucoes (modal)
  - Warnings da IA exibidos (se houver)
- [ ] **AC5:** Todos os componentes usam `@eximia/ui`
  - Card, Button, Tabs, Input, Textarea, Badge, Accordion, Modal, ProgressBar
  - Tailwind theme tokens (bg-bg-card, text-text-primary, etc.)
  - Zero hardcoded colors
- [ ] **AC6:** Responsivo (funcional em mobile >= 375px)
- [ ] **AC7:** Loading states e error states para cada step
- [ ] **AC8:** Breadcrumb: Cursos > Novo Curso > Importar com IA

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Component usage patterns, accessibility, responsive design, @eximia/ui compliance.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Atualizar pagina /courses/new
  - [ ] Adicionar seletor de modo (2 cards)
  - [ ] Manter redirecionamento para fluxo manual existente
  - [ ] Novo redirect para /courses/new/ingest

- [ ] **Task 2** (AC: 2, 8) Implementar Step 1 — Fonte
  - [ ] Criar `apps/web/src/app/(platform)/courses/new/ingest/page.tsx`
  - [ ] Criar `_components/ingestion-wizard.tsx` (container principal)
  - [ ] Criar `_components/file-dropzone.tsx` (drag & drop)
  - [ ] Criar `_components/text-paste-input.tsx` (textarea)
  - [ ] Criar `_components/video-url-input.tsx` (URL input)
  - [ ] Integrar Tabs component para alternar entre fontes

- [ ] **Task 3** (AC: 3) Implementar Step 2 — Processamento
  - [ ] Criar `_components/processing-status.tsx`
  - [ ] Integrar SSE com `/api/ingestion/[id]/status`
  - [ ] Steps visuais com progress bar
  - [ ] Botao cancelar funcional

- [ ] **Task 4** (AC: 4) Implementar Step 3 — Preview
  - [ ] Criar `_components/course-preview.tsx` (container)
  - [ ] Criar `_components/chapter-preview-card.tsx` (card por capitulo)
  - [ ] Campos editaveis (titulo, descricao)
  - [ ] Accordion para conteudo colapsavel
  - [ ] Drag & drop para reorder
  - [ ] Delete com confirmacao
  - [ ] Modal de regeneracao com instrucoes

- [ ] **Task 5** (AC: 5, 6, 7) Polish
  - [ ] Verificar todos componentes @eximia/ui
  - [ ] Testar responsividade
  - [ ] Loading/error states

---

## Dev Notes

### Wizard State Management

```typescript
// _components/ingestion-wizard.tsx
type WizardStep = "source" | "processing" | "preview"

const [step, setStep] = useState<WizardStep>("source")
const [ingestionId, setIngestionId] = useState<string | null>(null)
const [aiOutput, setAiOutput] = useState<OrganizerOutput | null>(null)

// Step transitions:
// 1. User submits source → call API → setIngestionId → setStep("processing")
// 2. SSE reports status="review" → setAiOutput(data) → setStep("preview")
// 3. User clicks "Criar Curso" → call approve API → redirect
```

### Dropzone Component

```typescript
// _components/file-dropzone.tsx
// Uses native HTML5 drag & drop API
// Visual states: idle, dragover, uploading, error
// File type icons based on extension
```

### SSE Integration

```typescript
// In processing-status.tsx
useEffect(() => {
  if (!ingestionId) return
  const eventSource = new EventSource(`/api/ingestion/${ingestionId}/status`)

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    setStatus(data.status)
    if (data.status === "review" && data.ai_output) {
      onComplete(data.ai_output)
    }
    if (data.status === "failed") {
      onError(data.error)
    }
  }

  return () => eventSource.close()
}, [ingestionId])
```

### File Locations

```
apps/web/src/app/(platform)/courses/
├── new/
│   ├── page.tsx                         # UPDATED: mode selector
│   └── ingest/
│       ├── page.tsx                     # NEW: wizard server page
│       └── _components/
│           ├── ingestion-wizard.tsx      # NEW: main wizard
│           ├── file-dropzone.tsx         # NEW: drag & drop
│           ├── text-paste-input.tsx      # NEW: textarea
│           ├── video-url-input.tsx       # NEW: URL input
│           ├── processing-status.tsx     # NEW: SSE progress
│           ├── course-preview.tsx        # NEW: preview container
│           └── chapter-preview-card.tsx  # NEW: chapter card
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck, sem hardcoded colors | Yes |
| Pre-PR | Wizard completo testavel, drag-drop funcional, responsive | Yes |

---

## Definition of Done

- [ ] Seletor de modo na pagina /courses/new
- [ ] Step 1: 3 fontes de input funcionais
- [ ] Step 2: Progress com SSE em tempo real
- [ ] Step 3: Preview editavel com drag & drop
- [ ] Todos componentes @eximia/ui
- [ ] Responsivo (mobile >= 375px)
- [ ] Loading e error states
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar wizard UI completo |
| **@ux-design-expert (Uma)** | Revisar UX do wizard flow |
| **@qa (QA)** | Testar fluxo completo E2E, responsividade |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Drag & drop complexo | Medium | Usar biblioteca leve ou HTML5 nativo |
| SSE connection drop | Low | Auto-reconnect + polling fallback |
| Mobile UX ruim | Medium | Testar early no mobile, simplificar se necessario |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
