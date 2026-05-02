# Story 13.3: File Upload e Text Extraction (PDF, DOCX, TXT, Paste)

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 5
**Priority:** P0 (extraction pipeline)
**Blocked By:** Story 13.1
**Blocks:** Story 13.5
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to upload PDF, DOCX, TXT files or paste text directly,
**so that** the system can extract the raw text content for AI processing.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 4.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management) |
| **Stack** | Next.js API Routes, Supabase Storage, pdf-parse, mammoth |
| **DB Tables** | `content_ingestions` (write) |
| **QA Notes** | Testar com PDFs reais de diferentes complexidades |

---

## Acceptance Criteria

- [ ] **AC1:** API Route `POST /api/ingestion/upload`
  - Aceita FormData com campo `file` + campo `title` (opcional)
  - Valida formato: pdf, docx, txt
  - Valida tamanho: PDF<=20MB, DOCX<=10MB, TXT<=5MB
  - Upload para Supabase Storage: `{tenantId}/ingestions/{ingestionId}/{filename}`
  - Cria registro `content_ingestions` com status='uploading'
  - Inicia extracao automatica
  - Retorna `{ ingestionId, status }`
- [ ] **AC2:** API Route `POST /api/ingestion/paste`
  - Aceita JSON: `{ text: string, title?: string }`
  - Valida tamanho (min 200 chars, max 200k chars)
  - Cria registro com source_type='paste', raw_text preenchido, status='processing'
  - Retorna `{ ingestionId, status }`
- [ ] **AC3:** Extractors funcionais
  - PDF: `pdf-parse` extrai texto preservando paragrafos
  - DOCX: `mammoth` converte para texto puro
  - TXT/MD: leitura direta do buffer
  - Texto extraido salvo em raw_text
  - Status atualizado: uploading → extracting → processing (se OK) ou failed (se erro)
- [ ] **AC4:** Auth guard em ambas rotas (managers/admins)
- [ ] **AC5:** Rate limiting: 3 uploads por 5 minutos por usuario
- [ ] **AC6:** Error handling amigavel
  - Arquivo corrompido → "Nao foi possivel ler o arquivo. Verifique se nao esta corrompido."
  - Formato invalido → "Formato nao suportado. Use PDF, DOCX ou TXT."
  - Tamanho excedido → "Arquivo muito grande. Limite maximo: X MB"
  - Texto muito curto → "Conteudo muito curto. Minimo de 200 caracteres."
- [ ] **AC7:** Packages `pdf-parse` e `mammoth` instalados como dependencias

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: File upload security (type validation, size limits), error handling, injection prevention.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 7) Instalar dependencias
  - [ ] `pnpm add pdf-parse mammoth --filter @eximia/web`
  - [ ] `pnpm add -D @types/pdf-parse --filter @eximia/web`
  - [ ] Verificar que sao server-only (nao entram no bundle client)

- [ ] **Task 2** (AC: 3) Implementar extractors
  - [ ] Criar `apps/web/src/lib/extractors/pdf-extractor.ts`
  - [ ] Criar `apps/web/src/lib/extractors/docx-extractor.ts`
  - [ ] Criar `apps/web/src/lib/extractors/index.ts` (dispatcher)
  - [ ] Testar com arquivos reais

- [ ] **Task 3** (AC: 1, 4, 5, 6) Implementar upload route
  - [ ] Criar `apps/web/src/app/api/ingestion/upload/route.ts`
  - [ ] Auth guard (manager/admin)
  - [ ] Validacao de formato e tamanho
  - [ ] Upload para Supabase Storage
  - [ ] Criar registro em content_ingestions
  - [ ] Iniciar extracao
  - [ ] Rate limiting

- [ ] **Task 4** (AC: 2, 4, 5, 6) Implementar paste route
  - [ ] Criar `apps/web/src/app/api/ingestion/paste/route.ts`
  - [ ] Auth guard
  - [ ] Validacao de tamanho
  - [ ] Criar registro com raw_text direto

---

## Dev Notes

### Extractors

```typescript
// apps/web/src/lib/extractors/pdf-extractor.ts
import pdfParse from "pdf-parse"

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  if (!data.text || data.text.trim().length < 50) {
    throw new Error("PDF parece estar vazio ou conter apenas imagens escaneadas.")
  }
  return data.text
}

// apps/web/src/lib/extractors/docx-extractor.ts
import mammoth from "mammoth"

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  if (!result.value || result.value.trim().length < 50) {
    throw new Error("Documento DOCX parece estar vazio.")
  }
  return result.value
}

// apps/web/src/lib/extractors/index.ts
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfText(buffer)
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxText(buffer)
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8")
    default:
      throw new Error(`Formato nao suportado: ${mimeType}`)
  }
}
```

### Upload Route

```typescript
// apps/web/src/app/api/ingestion/upload/route.ts
const MIME_TYPES: Record<string, { ext: string; maxSize: number }> = {
  "application/pdf": { ext: "pdf", maxSize: 20 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", maxSize: 10 * 1024 * 1024 },
  "text/plain": { ext: "txt", maxSize: 5 * 1024 * 1024 },
  "text/markdown": { ext: "txt", maxSize: 5 * 1024 * 1024 },
}
```

### File Locations

```
apps/web/src/
├── app/api/ingestion/
│   ├── upload/route.ts          # NEW
│   └── paste/route.ts           # NEW
└── lib/extractors/
    ├── index.ts                 # NEW
    ├── pdf-extractor.ts         # NEW
    └── docx-extractor.ts        # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Extrai texto de 3+ PDFs e 2+ DOCX reais | Yes |

---

## Definition of Done

- [ ] Upload de PDF, DOCX, TXT funcional
- [ ] Paste de texto funcional
- [ ] Extractors testados com arquivos reais
- [ ] Auth guard e rate limiting ativos
- [ ] Error handling com mensagens amigaveis
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar extractors e API routes |
| **@qa (QA)** | Testar com PDFs reais (simples, complexos, escaneados) |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| PDF escaneado (imagem) nao extrai texto | Medium | Detectar e avisar usuario, sugerir OCR futuro |
| DOCX com macros/embedded objects | Low | mammoth ignora gracefully |
| Arquivo corrompido causa crash | Medium | try/catch com mensagem amigavel |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
