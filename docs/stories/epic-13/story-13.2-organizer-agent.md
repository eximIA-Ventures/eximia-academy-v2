# Story 13.2: Organizer Agent (Prompt, Schema e Testes)

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 8
**Priority:** P0 (core AI logic)
**Blocked By:** Story 13.1
**Blocks:** Story 13.5
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** an AI Organizer Agent that structures raw text into course chapters,
**so that** uploaded content is automatically organized with titles, objectives, and formatted content.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 5.3 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management), FR3 (Content Delivery) |
| **Stack** | Vercel AI SDK 6.0, @ai-sdk/anthropic, Claude Sonnet 4.5, Zod |
| **DB Tables** | `content_ingestions` (reads raw_text, writes ai_output) |
| **QA Notes** | Seguir padrao do Creator Agent existente |

---

## Acceptance Criteria

- [ ] **AC1:** Organizer Agent em `packages/agents/src/organizer.ts`
  - Funcao `organizeContent(input: OrganizerInput): Promise<OrganizerOutput>`
  - Usa `generateObject()` do Vercel AI SDK com Claude Sonnet 4.5
  - Retry logic: 1 retry em caso de falha
- [ ] **AC2:** System Prompt em `packages/agents/src/prompts/organizer.ts`
  - Analisa texto bruto e identifica temas/topicos
  - Divide em 3-15 capitulos logicos (configuravel via max_chapters)
  - Gera titulo + objetivo de aprendizagem por capitulo
  - Formata conteudo em Markdown limpo
  - Sugere titulo e descricao do curso
  - Ordena progressivamente (simples → complexo)
  - Circuit breakers:
    - Texto curto (<500 palavras): gera 1-3 capitulos + warning
    - Texto muito longo (>100k chars): divide em secoes logicas
    - Sem estrutura clara: usa paragrafos como delimitadores
- [ ] **AC3:** Schema Zod em `packages/agents/src/schemas/organizer.ts`
  - `organizerInputSchema` com validacoes de min/max
  - `organizerOutputSchema` com chapters array (1-20)
  - Types exportados: `OrganizerInput`, `OrganizerOutput`, `OrganizedChapter`
- [ ] **AC4:** Export no `packages/agents/src/index.ts`
- [ ] **AC5:** Testes unitarios
  - Teste de schema validation (input valido, input invalido)
  - Teste de schema output (output valido, output invalido)
- [ ] **AC6:** Output de qualidade
  - Titulos claros e descritivos (nao genericos como "Capitulo 1")
  - Objetivos de aprendizagem especificos e mensuaveis
  - Conteudo mantendo fidelidade ao texto original
  - Markdown formatado com headings, paragrafos, listas quando apropriado

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Zod schema correctness, prompt quality, error handling patterns, retry logic.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 3) Criar Zod schemas
  - [ ] Criar `packages/agents/src/schemas/organizer.ts`
  - [ ] Definir `organizerInputSchema` com validacoes
  - [ ] Definir `organizerOutputSchema` com nested chapters
  - [ ] Exportar types: `OrganizerInput`, `OrganizerOutput`, `OrganizedChapter`

- [ ] **Task 2** (AC: 2) Criar System Prompt
  - [ ] Criar `packages/agents/src/prompts/organizer.ts`
  - [ ] Definir identidade, missao, regras
  - [ ] Definir processo de organizacao (4 steps)
  - [ ] Definir circuit breakers
  - [ ] Definir invariantes (regras inquebraveis)
  - [ ] Definir validacao final (checklist)

- [ ] **Task 3** (AC: 1, 6) Implementar Agent
  - [ ] Criar `packages/agents/src/organizer.ts`
  - [ ] Implementar `organizeContent()` com generateObject
  - [ ] Adicionar retry logic (1 retry)
  - [ ] Testar com texto real de diferentes fontes

- [ ] **Task 4** (AC: 4) Exportar no index
  - [ ] Atualizar `packages/agents/src/index.ts`

- [ ] **Task 5** (AC: 5) Testes
  - [ ] Criar `packages/agents/tests/schemas/organizer.test.ts`
  - [ ] Testar input schema (valido + invalido)
  - [ ] Testar output schema (valido + invalido)

---

## Dev Notes

### Schema Zod

```typescript
// packages/agents/src/schemas/organizer.ts
import { z } from "zod"

export const organizerInputSchema = z.object({
  raw_text: z.string()
    .min(200, "Conteudo deve ter no minimo 200 caracteres")
    .max(200000, "Conteudo deve ter no maximo 200000 caracteres"),
  source_filename: z.string().optional(),
  source_type: z.enum(["pdf", "docx", "txt", "audio", "video_url", "paste"]),
  language: z.string().default("pt-br"),
  max_chapters: z.number().int().min(1).max(20).default(15),
  instructions: z.string().optional(),
})

const organizedChapterSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(50),
  learning_objective: z.string().min(10),
  order: z.number().int().min(0),
  key_concepts: z.array(z.string()).min(1),
  estimated_reading_time_min: z.number().min(1),
})

export const organizerOutputSchema = z.object({
  suggested_title: z.string().min(5),
  suggested_description: z.string().min(20),
  chapters: z.array(organizedChapterSchema).min(1).max(20),
  metadata: z.object({
    total_chapters: z.number().int(),
    content_complexity: z.enum(["baixa", "media", "alta"]),
    main_topics: z.array(z.string()),
    suggested_area: z.string().optional(),
  }),
  warnings: z.array(z.string()).optional(),
})

export type OrganizerInput = z.infer<typeof organizerInputSchema>
export type OrganizerOutput = z.infer<typeof organizerOutputSchema>
export type OrganizedChapter = z.infer<typeof organizedChapterSchema>
```

### System Prompt Guidelines

O prompt do Organizer deve:
- Manter fidelidade ao conteudo original (nao inventar informacao)
- Usar Markdown com hierarquia clara (##, ###, listas, negrito)
- Gerar objetivos no formato "Ao final deste capitulo, o aluno sera capaz de..."
- Ordenar capitulos do mais basico ao mais avancado
- Incluir key_concepts como array de termos-chave por capitulo

### Agent Implementation

```typescript
// packages/agents/src/organizer.ts
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { ORGANIZER_SYSTEM_PROMPT } from "./prompts/organizer"
import { type OrganizerInput, type OrganizerOutput, organizerOutputSchema } from "./schemas/organizer"

export async function organizeContent(input: OrganizerInput): Promise<OrganizerOutput> {
  const userMessage = [
    `Tipo de fonte: ${input.source_type}`,
    input.source_filename ? `Arquivo: ${input.source_filename}` : "",
    input.instructions ? `Instrucoes do professor: ${input.instructions}` : "",
    `Idioma: ${input.language}`,
    `Maximo de capitulos: ${input.max_chapters}`,
    "",
    "Conteudo bruto:",
    input.raw_text,
  ].filter(Boolean).join("\n")

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: ORGANIZER_SYSTEM_PROMPT,
    prompt: userMessage,
    schema: organizerOutputSchema,
  })

  return object
}
```

### File Locations

```
packages/agents/
├── src/
│   ├── organizer.ts                 # NEW
│   ├── prompts/
│   │   └── organizer.ts             # NEW
│   ├── schemas/
│   │   └── organizer.ts             # NEW
│   └── index.ts                     # UPDATED
└── tests/
    └── schemas/
        └── organizer.test.ts        # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Schema compila, types corretos, lint passa | Yes |
| Pre-PR | Testes passam, output coerente para 3+ tipos de conteudo | Yes |

---

## Definition of Done

- [ ] Agent implementado com generateObject + retry
- [ ] System Prompt com circuit breakers e invariantes
- [ ] Zod schemas com validacao completa
- [ ] Testes unitarios passando
- [ ] Exportado no index.ts
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar agent, prompt, schema, testes |
| **@architect (Aria)** | Revisar prompt para qualidade pedagogica |
| **@qa (QA)** | Testar com diferentes tipos/tamanhos de conteudo |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Prompt gera output de baixa qualidade | High | Iterar no prompt, testar com conteudos reais |
| Texto muito longo excede context window | Medium | Truncar a 200k chars, alertar usuario |
| Output nao segue schema Zod | Medium | generateObject valida automaticamente, retry |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
