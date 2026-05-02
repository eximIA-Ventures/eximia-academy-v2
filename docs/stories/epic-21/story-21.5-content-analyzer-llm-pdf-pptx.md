# Story 21.5: Content Analyzer — LLM-only PDF/PPTX (D15)

**Epic:** [Epic 21 — WS2: Orchestrator, API & Database](../../epics/epic-21-ws2-orchestrator-api-database.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (enhancement — wizard funciona sem Content Analyzer)
**Blocked By:** Story 21.1
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** fazer upload de PDFs e slides para que a IA extraia topicos e competencias automaticamente,
**so that** o preenchimento do wizard seja assistido com material existente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 13 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, TypeScript, AI SDK 6.0, Supabase, Drizzle ORM, Zod |
| **Package** | `@eximia/course-designer` (content-analyzer), `apps/web` (API route) |
| **Existing Pattern** | `packages/course-designer/src/` (pipeline agents from Epic 20) |
| **Risk** | MEDIUM — qualidade da extracao depende do LLM, PDFs variam muito |

---

## Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/analyze-content` em `apps/web/src/app/api/course-designer/analyze-content/route.ts`
  - Aceita: PDF, PPTX, DOCX, TXT
  - Max file size: 10MB
  - Retorna: `ContentAnalysisResult`
- [ ] **AC2:** `analyzeContent(file)` em `packages/course-designer/src/content-analyzer.ts`
  - Envia arquivo diretamente ao LLM (PDF support nativo)
  - Extrai: topicos principais, conceitos-chave, nivel Bloom estimado, estrutura (capitulos/secoes)
  - Output Zod-validated
- [ ] **AC3:** Schema `ContentAnalysisResult`
  - `topics_extracted[]`: titulo, descricao, bloom_estimate
  - `competencies_suggested[]`: competencia sugerida
  - `structure_detected`: capitulos/secoes encontrados
  - `content_summary`: resumo de 200-500 palavras
  - `confidence`: 0-1
- [ ] **AC4:** Output pre-preenche campos do wizard: `topics_outline`, `core_competencies` sugeridas
  - Instrutor revisa, aceita, edita ou descarta cada sugestao
- [ ] **AC5:** Sem engine de extracao adicional — LLM-only (D15)
- [ ] **AC6:** Rate limiting: max 5 analises por hora por tenant

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 3) Definir schema `ContentAnalysisResult` com Zod
  - [ ] Criar ou estender schemas em `packages/course-designer/src/schemas/`
  - [ ] Definir `topicExtractedSchema`: titulo, descricao, bloom_estimate
  - [ ] Definir `competencySuggestedSchema`: competencia sugerida
  - [ ] Definir `structureDetectedSchema`: capitulos/secoes encontrados
  - [ ] Definir `contentAnalysisResultSchema`: topics_extracted[], competencies_suggested[], structure_detected, content_summary (200-500 palavras), confidence (0-1)
  - [ ] Exportar types via `z.infer`

- [ ] **Task 2** (AC: 2, 5) Implementar `analyzeContent` function
  - [ ] Criar `packages/course-designer/src/content-analyzer.ts`
  - [ ] Receber arquivo (Buffer + metadata)
  - [ ] Enviar ao LLM via Model Router (gpt-4.1 preferido)
  - [ ] Se gpt-4.1 nao suporta PDF nativo: usar `pdf-parse` para extrair texto como pre-processamento
  - [ ] Extrair: topicos principais, conceitos-chave, nivel Bloom estimado, estrutura
  - [ ] Validar output com Zod schema `ContentAnalysisResult`
  - [ ] Zero dependencia em libraries de analise semantica (apenas extracao de texto se necessario)

- [ ] **Task 3** (AC: 1) Implementar POST /api/course-designer/analyze-content
  - [ ] Criar `apps/web/src/app/api/course-designer/analyze-content/route.ts`
  - [ ] Aceitar multipart/form-data com arquivo
  - [ ] Validar tipo de arquivo: PDF, PPTX, DOCX, TXT
  - [ ] Validar tamanho maximo: 10MB
  - [ ] Chamar `analyzeContent` e retornar `ContentAnalysisResult`
  - [ ] Auth: verificar role manager ou admin
  - [ ] RLS: verificar tenant

- [ ] **Task 4** (AC: 4) Garantir output pre-preenche wizard
  - [ ] Mapear `topics_extracted` -> `topics_outline` do wizard
  - [ ] Mapear `competencies_suggested` -> `core_competencies` do wizard
  - [ ] Retornar estrutura compativel com o formato esperado pelo Wizard (Epic 22)

- [ ] **Task 5** (AC: 6) Implementar rate limiting
  - [ ] Contar analises na ultima hora por tenant
  - [ ] Bloquear se >= 5 analises por hora
  - [ ] Retornar 429 Too Many Requests com mensagem descritiva

- [ ] **Task 6** Validar typecheck
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

**Resolucao D15 (modelo para PDF):** A decisao D15 originalmente referenciava "PDF nativo do Claude", mas o projeto opera com Zero Claude em producao. **Validar antes de implementar**: se gpt-4.1 suporta PDF upload nativo com qualidade suficiente, usar gpt-4.1. Caso contrario, adicionar `pdf-parse` como pre-processamento (texto extraido -> LLM analisa texto). A premissa "LLM-only" refere-se a nao ter engine de analise propria — um parser de texto e aceitavel.

Zero dependencia em libraries de analise semantica (apenas extracao de texto se necessario).

Consider `pdf-parse` for text extraction preprocessing if needed.

### File Locations

```
packages/course-designer/src/
├── content-analyzer.ts          # NOVO

apps/web/src/app/api/course-designer/
├── analyze-content/route.ts     # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Paths atualizados: @eximia/agents → @eximia/course-designer (D19 modularizacao) | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
