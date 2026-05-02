# Epic 13: AI Content Ingestion (Ingestao Inteligente de Conteudo)

**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — FR2 (Course Management), FR3 (Content Delivery)
**Architecture Reference:** `docs/architecture.md` v1.4 — Sections 3.2, 4.1, 5.3
**Screens Reference:** `docs/screens.md` — Tela Novo Curso, Wizard de Ingestao

---

## Epic Goal

Permitir que managers/professores facam upload de conteudo bruto (PDF, DOCX, TXT, audio, video URL ou texto colado) e a IA automaticamente extraia, organize e estruture o material em um curso completo com capitulos, objetivos de aprendizagem e conteudo formatado — eliminando o trabalho manual de criar capitulo a capitulo.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Vercel AI SDK 6.0, Claude Sonnet 4.5, Drizzle ORM, Supabase Storage |
| **DB Tables** | `content_ingestions` (NOVA), `courses` (existente), `chapters` (existente) |
| **Storage** | Supabase Storage bucket `chapter-assets` (reutilizado, novo path pattern) |
| **AI Model** | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `@ai-sdk/anthropic` |
| **Transcricao** | OpenAI Whisper API para audio/video |
| **Parsing** | `pdf-parse` (PDF), `mammoth` (DOCX), nativo (TXT/MD) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Roles Impactados** | manager, admin (criadores de conteudo) |
| **Dependencia Pacote** | `pdf-parse@^1.1.1`, `mammoth@^1.8.0`, `openai@^4.x` (Whisper only) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Creator Agent (gera perguntas) | Implementado | `packages/agents/src/creator.ts` |
| Supabase Storage (upload de assets) | Implementado | `apps/web/src/lib/utils/chapter-asset-upload.ts` |
| Chapter CRUD (Server Actions) | Implementado | `apps/web/.../chapters/actions.ts` |
| Course CRUD | Implementado | Epic 2 |
| Rate Limiting (Upstash Redis) | Implementado | `apps/web/src/lib/rate-limit.ts` |
| Block Editor (Plate.js) | Implementado | Epic 12 |
| Multi-modal content (video/audio) | Implementado | Epic 12 |
| Vercel AI SDK + Claude | Implementado | `packages/agents/` |
| Auth guard pattern (role-based) | Implementado | `apps/web/src/lib/auth.ts` |

### Current Content Flow

```
Manager abre "Novo Curso"
    → Cria curso (titulo + descricao)
    → Cria capitulo manualmente (titulo + conteudo + objetivo)
    → Repete para cada capitulo
    → Publica capitulos individualmente
    → Gera perguntas manualmente por capitulo
```

### What This Epic Changes

```
Manager abre "Novo Curso"
    → Escolhe: Manual (fluxo atual) OU Ingestao com IA (NOVO)
    → Se Ingestao com IA:
        → Upload arquivo / cola texto / URL video
        → IA extrai texto (PDF/DOCX/audio/video)
        → IA organiza em capitulos (Organizer Agent)
        → Manager revisa preview editavel
        → Confirma → Curso + Capitulos criados automaticamente
        → Auto-trigger geracao de perguntas (Epic 14)
```

---

## Enhancement Details

### Core Concept: Pipeline de Ingestao

```
┌──────────────┐   ┌───────────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────────┐
│   UPLOAD     │──▶│  EXTRACTION   │──▶│  AI ORGANIZE   │──▶│   REVIEW     │──▶│  APPROVAL  │
│  File/Text   │   │  PDF/Audio/   │   │  Organizer     │   │  Preview     │   │  Create    │
│  Drop Zone   │   │  Video parse  │   │  Agent         │   │  Editavel    │   │  Curso     │
└──────────────┘   └───────────────┘   └────────────────┘   └──────────────┘   └────────────┘
   status:            status:             status:              status:            status:
   uploading          extracting          processing           review             approved
```

### Formatos de Entrada Suportados

| Formato | Extracao | Tecnologia | Limite |
|---------|----------|------------|--------|
| **PDF** | Texto + estrutura | `pdf-parse` | 20MB |
| **DOCX** | Texto + headings | `mammoth` | 10MB |
| **TXT/MD** | Direto | Nativo | 5MB |
| **Audio** (MP3, WAV, M4A, OGG) | Transcricao | OpenAI Whisper API | 50MB |
| **Video URL** (YouTube) | Transcricao legendas | `youtube-transcript` + fallback Whisper | N/A |
| **Cole texto** | Direto | Textarea | 200k chars |

### Organizer Agent Output

```typescript
{
  suggested_title: string,
  suggested_description: string,
  chapters: [
    {
      title: string,
      content: string,              // Markdown formatado
      learning_objective: string,
      order: number,
      key_concepts: string[],
      estimated_reading_time_min: number,
    }
  ],
  metadata: {
    total_chapters: number,
    content_complexity: "baixa" | "media" | "alta",
    main_topics: string[],
    suggested_area: string | undefined,
  },
  warnings: string[] | undefined,
}
```

### Success Criteria

- [ ] Manager consegue fazer upload de PDF e ter curso organizado em < 2 minutos
- [ ] Audio de 30min e transcrito e organizado em < 3 minutos
- [ ] Preview editavel permite ajustar titulos, reordenar e deletar capitulos
- [ ] Conteudo gerado segue formatacao Markdown limpa
- [ ] Multi-tenant isolation mantida (tenant_id em todos os registros)
- [ ] Formatos invalidos ou arquivos corrompidos geram erro amigavel

---

## Stories

---

### Story 13.1: Schema, Migration e RLS para Content Ingestions

**As a** developer,
**I want** a `content_ingestions` table with proper RLS policies,
**so that** the ingestion pipeline has persistent state tracking with multi-tenant isolation.

**PRD Reference:** FR2
**Architecture Reference:** architecture.md v1.4, Section 3.2

**Story Points:** 3
**Priority:** P0 (foundation for all other stories)
**Risk:** LOW — follows existing schema patterns

#### Acceptance Criteria

- [ ] **AC1:** Tabela `content_ingestions` criada com todas as colunas definidas na arquitetura
  - id, tenant_id, course_id, created_by, source_type, source_url, source_filename, source_size_bytes
  - raw_text, ai_output (JSONB), status (enum), error_message, processing_metadata (JSONB)
  - created_at, updated_at com timezone
- [ ] **AC2:** RLS policies implementadas
  - SELECT: managers/admins do mesmo tenant
  - INSERT: managers/admins do mesmo tenant
  - UPDATE: managers/admins do mesmo tenant (apenas own records)
  - DELETE: admins do mesmo tenant
- [ ] **AC3:** Drizzle schema em `packages/database/src/schema/content-ingestions.ts` com export no index
- [ ] **AC4:** Migration SQL funcional via `supabase db push`
- [ ] **AC5:** TypeScript types exportados de `@eximia/database`

#### Technical Notes

```typescript
// packages/database/src/schema/content-ingestions.ts
export const contentIngestions = pgTable("content_ingestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: text("source_type", {
    enum: ["pdf", "docx", "txt", "audio", "video_url", "paste"]
  }).notNull(),
  sourceUrl: text("source_url"),
  sourceFilename: text("source_filename"),
  sourceSizeBytes: integer("source_size_bytes"),
  rawText: text("raw_text"),
  aiOutput: jsonb("ai_output"),
  status: text("status", {
    enum: ["uploading", "extracting", "processing", "review", "approved", "failed"]
  }).notNull().default("uploading"),
  errorMessage: text("error_message"),
  processingMetadata: jsonb("processing_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
```

```sql
-- Migration
CREATE TABLE content_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf','docx','txt','audio','video_url','paste')),
  source_url TEXT,
  source_filename TEXT,
  source_size_bytes INTEGER,
  raw_text TEXT,
  ai_output JSONB,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading','extracting','processing','review','approved','failed')),
  error_message TEXT,
  processing_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE content_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestions_select" ON content_ingestions FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "ingestions_insert" ON content_ingestions FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "ingestions_update" ON content_ingestions FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "ingestions_delete" ON content_ingestions FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Criar schema Drizzle, migration SQL, RLS policies |
| **@qa (QA)** | Validar isolation multi-tenant, testar RLS |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa, Drizzle schema compila | Yes |
| Pre-PR | Migration aplica sem erro, RLS policies testadas | Yes |

---

### Story 13.2: Organizer Agent (Prompt, Schema e Testes)

**As a** developer,
**I want** an AI Organizer Agent that structures raw text into course chapters,
**so that** uploaded content is automatically organized with titles, objectives, and formatted content.

**PRD Reference:** FR2, FR3
**Architecture Reference:** architecture.md v1.4, Section 5.3

**Story Points:** 8
**Priority:** P0 (core AI logic)
**Risk:** MEDIUM — qualidade do output depende do prompt engineering

#### Acceptance Criteria

- [ ] **AC1:** Organizer Agent implementado em `packages/agents/src/organizer.ts`
  - Usa `generateObject()` do Vercel AI SDK com Claude Sonnet 4.5
  - Input: raw_text, source_filename, source_type, language (default: "pt-br")
  - Output: validated against `organizerOutputSchema` (Zod)
- [ ] **AC2:** System Prompt em `packages/agents/src/prompts/organizer.ts`
  - Analisa texto bruto e identifica temas/topicos
  - Divide em 3-15 capitulos logicos
  - Gera titulo + objetivo de aprendizagem por capitulo
  - Formata conteudo em Markdown limpo
  - Sugere titulo e descricao do curso
  - Ordena progressivamente (simples → complexo)
  - Circuit breakers para texto curto (<500 palavras) ou muito longo (>100k)
- [ ] **AC3:** Schema Zod em `packages/agents/src/schemas/organizer.ts`
  - `organizerInputSchema` com validacoes
  - `organizerOutputSchema` com chapters array (1-20)
  - Types exportados: `OrganizerInput`, `OrganizerOutput`, `OrganizedChapter`
- [ ] **AC4:** Export no `packages/agents/src/index.ts`
- [ ] **AC5:** Testes unitarios em `packages/agents/tests/`
  - Teste de schema validation (input + output)
  - Teste de integracao com mock (verifica estrutura do output)
- [ ] **AC6:** Retry logic (1 retry em caso de falha)

#### Technical Notes

```typescript
// packages/agents/src/schemas/organizer.ts
export const organizerInputSchema = z.object({
  raw_text: z.string()
    .min(200, "Conteudo deve ter no minimo 200 caracteres")
    .max(200000, "Conteudo deve ter no maximo 200000 caracteres"),
  source_filename: z.string().optional(),
  source_type: z.enum(["pdf", "docx", "txt", "audio", "video_url", "paste"]),
  language: z.string().default("pt-br"),
  max_chapters: z.number().int().min(1).max(20).default(15),
  instructions: z.string().optional(), // manager pode dar instrucoes extras
})

const organizedChapterSchema = z.object({
  title: z.string(),
  content: z.string(),
  learning_objective: z.string(),
  order: z.number().int(),
  key_concepts: z.array(z.string()),
  estimated_reading_time_min: z.number(),
})

export const organizerOutputSchema = z.object({
  suggested_title: z.string(),
  suggested_description: z.string(),
  chapters: z.array(organizedChapterSchema).min(1).max(20),
  metadata: z.object({
    total_chapters: z.number().int(),
    content_complexity: z.enum(["baixa", "media", "alta"]),
    main_topics: z.array(z.string()),
    suggested_area: z.string().optional(),
  }),
  warnings: z.array(z.string()).optional(),
})
```

```
packages/agents/
├── src/
│   ├── organizer.ts                    # NEW: organizeContent()
│   ├── prompts/
│   │   └── organizer.ts                # NEW: ORGANIZER_SYSTEM_PROMPT
│   ├── schemas/
│   │   └── organizer.ts                # NEW: Zod schemas
│   └── index.ts                        # UPDATED: export organizer
└── tests/
    └── schemas/
        └── organizer.test.ts           # NEW: schema tests
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar agent, prompt, schema, testes |
| **@architect (Aria)** | Revisar prompt do Organizer para qualidade pedagogica |
| **@qa (QA)** | Testar com diferentes tipos de conteudo |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Schema compila, types corretos | Yes |
| Pre-PR | Testes passam, output coerente para 3+ tipos de conteudo | Yes |

---

### Story 13.3: File Upload e Text Extraction (PDF, DOCX, TXT, Paste)

**As a** manager,
**I want** to upload PDF, DOCX, TXT files or paste text directly,
**so that** the system can extract the raw text content for AI processing.

**PRD Reference:** FR2
**Architecture Reference:** architecture.md v1.4, Section 4.1

**Story Points:** 5
**Priority:** P0 (extraction pipeline)
**Risk:** MEDIUM — parsing de PDFs pode falhar em documentos complexos

#### Acceptance Criteria

- [ ] **AC1:** API Route `POST /api/ingestion/upload` implementada
  - Aceita FormData com file + metadata
  - Valida formato (pdf, docx, txt) e tamanho (PDF<=20MB, DOCX<=10MB, TXT<=5MB)
  - Upload para Supabase Storage: `{tenantId}/ingestions/{ingestionId}/{filename}`
  - Cria registro em `content_ingestions` com status='uploading'
  - Inicia extracao automaticamente
- [ ] **AC2:** API Route `POST /api/ingestion/paste` implementada
  - Aceita body JSON com `{ text, title? }`
  - Valida tamanho (min 200 chars, max 200k chars)
  - Cria registro com source_type='paste', raw_text preenchido
  - Status direto para 'processing' (pula extracao)
- [ ] **AC3:** Extracao de texto funcional
  - PDF: `pdf-parse` extrai texto preservando paragrafos
  - DOCX: `mammoth` converte para HTML, depois strip tags para texto
  - TXT/MD: leitura direta
  - Raw text salvo no registro, status atualizado para 'extracting' → 'processing'
- [ ] **AC4:** Auth guard: apenas managers/admins
- [ ] **AC5:** Rate limiting: 3 uploads por 5 minutos por usuario
- [ ] **AC6:** Error handling com mensagens amigaveis
  - Arquivo corrompido → "Nao foi possivel ler o arquivo. Verifique se nao esta corrompido."
  - Formato invalido → "Formato nao suportado. Use PDF, DOCX ou TXT."
  - Tamanho excedido → "Arquivo muito grande. Limite: X MB"

#### Technical Notes

```bash
# Instalar dependencias (server-only, zero impacto no bundle client)
pnpm add pdf-parse mammoth --filter @eximia/web
```

```typescript
// apps/web/src/lib/extractors/pdf-extractor.ts
import pdfParse from "pdf-parse"

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}

// apps/web/src/lib/extractors/docx-extractor.ts
import mammoth from "mammoth"

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

// apps/web/src/lib/extractors/index.ts
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "application/pdf": return extractPdfText(buffer)
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

```
apps/web/src/
├── app/api/ingestion/
│   ├── upload/route.ts                 # NEW: POST upload handler
│   └── paste/route.ts                  # NEW: POST paste handler
└── lib/extractors/
    ├── index.ts                        # NEW: extractText dispatcher
    ├── pdf-extractor.ts                # NEW: PDF → text
    └── docx-extractor.ts              # NEW: DOCX → text
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar extractors, API routes, validacao |
| **@qa (QA)** | Testar com PDFs reais (simples, complexos, escaneados) |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Extrai texto de 3+ PDFs e 2+ DOCX reais sem erro | Yes |

---

### Story 13.4: Audio/Video Transcription (Whisper API)

**As a** manager,
**I want** to upload audio files or provide YouTube URLs for automatic transcription,
**so that** spoken content is converted to text for AI organization.

**PRD Reference:** FR2, FR3
**Architecture Reference:** architecture.md v1.4, Section 4.1

**Story Points:** 5
**Priority:** P1 (complementa Story 13.3)
**Risk:** MEDIUM — custo de API, latencia de transcricao

#### Acceptance Criteria

- [ ] **AC1:** Transcricao de audio via OpenAI Whisper API
  - Suporta MP3, WAV, M4A, OGG (max 50MB)
  - Upload do audio para Whisper API com `model: "whisper-1"` e `language: "pt"`
  - Resultado salvo como raw_text no registro
  - Status flow: uploading → extracting (transcribing) → processing
- [ ] **AC2:** Transcricao de video URL (YouTube)
  - Tenta extrair legendas/transcript via API publica primeiro
  - Fallback: baixa audio e envia para Whisper API
  - Valida URL (apenas youtube.com e youtu.be)
- [ ] **AC3:** API Route `POST /api/ingestion/video-url` implementada
  - Aceita `{ url: string }`
  - Valida formato da URL
  - Cria registro com source_type='video_url'
  - Inicia transcricao
- [ ] **AC4:** Progress feedback
  - Status intermediario "Transcrevendo audio..." visivel na UI
  - Estimativa de tempo baseada no tamanho do arquivo
- [ ] **AC5:** Error handling
  - Audio sem fala → "Nao foi possivel identificar fala no audio."
  - YouTube URL invalida → "URL do YouTube invalida ou video indisponivel."
  - Whisper API indisponivel → retry 1x, depois erro amigavel
- [ ] **AC6:** Env var `OPENAI_API_KEY` configurada no Vercel

#### Technical Notes

```bash
pnpm add openai --filter @eximia/web
```

```typescript
// apps/web/src/lib/extractors/audio-extractor.ts
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(
  file: File | Buffer,
  filename: string
): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: new File([file], filename),
    language: "pt",
    response_format: "text",
  })
  return transcription
}
```

```
apps/web/src/
├── app/api/ingestion/
│   └── video-url/route.ts             # NEW: POST video URL handler
└── lib/extractors/
    ├── audio-extractor.ts              # NEW: Whisper transcription
    └── youtube-extractor.ts            # NEW: YouTube transcript
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar Whisper integration, YouTube extractor |
| **@devops (Gage)** | Configurar OPENAI_API_KEY no Vercel |
| **@qa (QA)** | Testar com audios PT-BR de diferentes qualidades |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Transcreve audio MP3 de 5min com >90% accuracy | Yes |

---

### Story 13.5: Ingestion Wizard UI (Upload, Processamento, Preview)

**As a** manager,
**I want** a step-by-step wizard interface to upload content and see AI processing in real-time,
**so that** the content ingestion experience is intuitive and transparent.

**PRD Reference:** FR2
**Architecture Reference:** architecture.md v1.4, Section 6.1

**Story Points:** 8
**Priority:** P0 (user-facing interface)
**Risk:** LOW — segue padroes de UI existentes

#### Acceptance Criteria

- [ ] **AC1:** Pagina `/courses/new` atualizada com seletor de modo
  - Opcao 1: "Criar manualmente" (fluxo atual)
  - Opcao 2: "Importar com IA" (NOVO — redireciona para wizard)
- [ ] **AC2:** Wizard Step 1 — Fonte do Conteudo
  - Tabs: "Upload Arquivo" | "Colar Texto" | "URL de Video"
  - Upload: Drag & drop zone com validacao visual (formato + tamanho)
  - Paste: Textarea com contador de caracteres (min 200)
  - Video URL: Input com validacao de YouTube URL + preview
- [ ] **AC3:** Wizard Step 2 — Processamento
  - Progress indicator com steps: "Enviando..." → "Extraindo texto..." → "Organizando com IA..."
  - Estimativa de tempo baseada no tipo/tamanho
  - SSE para status em tempo real
  - Botao "Cancelar" disponivel
- [ ] **AC4:** Wizard Step 3 — Preview do Curso
  - Titulo e descricao editaveis
  - Lista de capitulos em cards draggable (reorder)
  - Cada card mostra: titulo (editavel), preview do conteudo (colapsavel), objetivo, tempo de leitura estimado
  - Botoes por capitulo: editar, deletar
  - Botao "Adicionar capitulo manualmente"
- [ ] **AC5:** Todos os componentes usam `@eximia/ui` (Card, Button, Tabs, Input, etc.)
- [ ] **AC6:** Responsivo (funcional em mobile >= 375px)
- [ ] **AC7:** Loading states e error states tratados

#### Technical Notes

```
apps/web/src/app/(platform)/courses/new/
├── page.tsx                            # UPDATED: add mode selector
└── ingest/
    ├── page.tsx                        # NEW: wizard server page
    └── _components/
        ├── ingestion-wizard.tsx         # NEW: main wizard container
        ├── file-dropzone.tsx            # NEW: drag & drop upload
        ├── text-paste-input.tsx         # NEW: textarea com validacao
        ├── video-url-input.tsx          # NEW: YouTube URL input
        ├── processing-status.tsx        # NEW: SSE progress display
        └── course-preview.tsx           # NEW: preview editavel
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar wizard UI completo |
| **@ux-design-expert (Uma)** | Revisar UX do wizard flow |
| **@qa (QA)** | Testar fluxo completo E2E |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck, sem hardcoded colors | Yes |
| Pre-PR | Wizard completo testavel, drag-drop funcional | Yes |

---

### Story 13.6: Course Creation from Ingestion (Approval Flow)

**As a** manager,
**I want** to approve the AI-organized content and have the course automatically created,
**so that** the transition from preview to actual course is seamless and efficient.

**PRD Reference:** FR2
**Architecture Reference:** architecture.md v1.4, Section 4.1

**Story Points:** 5
**Priority:** P0 (completa o fluxo)
**Risk:** LOW — usa patterns existentes de course/chapter creation

#### Acceptance Criteria

- [ ] **AC1:** API Route `POST /api/ingestion/[id]/approve` implementada
  - Valida que ingestion esta em status='review'
  - Cria Course com titulo e descricao do ai_output
  - Cria Chapters em batch (todos de uma vez)
  - Atualiza ingestion: course_id preenchido, status='approved'
  - Retorna courseId para redirect
- [ ] **AC2:** API Route `POST /api/ingestion/[id]/process` implementada
  - Aceita `{ instructions?: string }` para regeneracao
  - Re-executa Organizer Agent com instrucoes adicionais
  - Atualiza ai_output no registro
- [ ] **AC3:** API Route `DELETE /api/ingestion/[id]` implementada
  - Deleta registro e arquivo no Storage
  - Apenas se status != 'approved'
- [ ] **AC4:** API Route `GET /api/ingestion/[id]/status` implementada
  - SSE stream que emite status changes
  - Emite: { status, progress?, ai_output?, error? }
- [ ] **AC5:** Botao "Confirmar e Criar Curso" na UI
  - Loading state durante criacao
  - Redirect para `/courses/[courseId]` apos sucesso
  - Toast de sucesso: "Curso criado com X capitulos!"
- [ ] **AC6:** Botao "Regenerar" com campo de instrucoes
  - Modal com textarea: "Instrucoes adicionais para a IA"
  - Exemplos: "Divida em mais capitulos", "Foque na parte pratica"
- [ ] **AC7:** Auto-trigger geracao de perguntas (integracao com Epic 14)
  - Apos criar chapters, chama endpoint de batch generation
  - Manager ve indicador "Gerando perguntas..." na pagina do curso

#### Technical Notes

```typescript
// POST /api/ingestion/[id]/approve
// 1. Fetch ingestion + validate
// 2. Create course
const { data: course } = await supabase.from("courses").insert({
  title: aiOutput.suggested_title,
  description: aiOutput.suggested_description,
  tenant_id: ingestion.tenant_id,
  created_by: user.id,
  status: "draft",
}).select().single()

// 3. Create chapters in batch
const chaptersToInsert = aiOutput.chapters.map(ch => ({
  course_id: course.id,
  tenant_id: ingestion.tenant_id,
  title: ch.title,
  content: ch.content,
  learning_objective: ch.learning_objective,
  order: ch.order,
  status: "draft",
}))

await supabase.from("chapters").insert(chaptersToInsert)

// 4. Update ingestion
await supabase.from("content_ingestions")
  .update({ course_id: course.id, status: "approved" })
  .eq("id", ingestionId)

// 5. Auto-trigger question generation (Epic 14)
await fetch(`/api/courses/${course.id}/generate-questions`, { method: "POST" })
```

```
apps/web/src/app/api/ingestion/
├── [id]/
│   ├── approve/route.ts               # NEW: POST approval
│   ├── process/route.ts               # NEW: POST re-process
│   └── status/route.ts                # NEW: GET SSE stream
└── [id]/route.ts                       # NEW: DELETE cancel
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar API routes e integracao |
| **@qa (QA)** | Testar fluxo completo: upload → approve → course created |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Fluxo E2E funcional, curso criado com chapters corretos | Yes |

---

## Dependency Graph

```
Story 13.1 (Schema)
    ├──▶ Story 13.2 (Organizer Agent)
    ├──▶ Story 13.3 (File Upload + Extraction)
    └──▶ Story 13.4 (Audio/Video Transcription)
              │            │
              └────────────┤
                           ▼
                Story 13.5 (Wizard UI)
                           │
                           ▼
                Story 13.6 (Approval Flow)
                           │
                           ▼
                Epic 14 (Question Generation)
```

**Execution Order:**
1. **Story 13.1** first (schema foundation)
2. **Stories 13.2 + 13.3 + 13.4** in parallel (agent + extractors independent)
3. **Story 13.5** after 13.2-13.4 (UI needs all backends ready)
4. **Story 13.6** last (completes the flow, integrates with Epic 14)

---

## Compatibility Requirements

- [ ] Fluxo manual de criacao de curso permanece inalterado
- [ ] Chapters criados via ingestion sao identicos aos criados manualmente
- [ ] RLS policies existentes nao sao afetadas
- [ ] Performance de paginas existentes nao e impactada
- [ ] Bundle size do client nao aumenta (extractors sao server-only)

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| PDF complexo falha parsing | Medium | Fallback para texto simples + warning | Permitir paste manual |
| Whisper API indisponivel | Medium | Retry 1x, cache no Upstash | Desabilitar opcao audio |
| Organizer gera output ruim | High | Preview editavel + botao regenerar | Manager pode descartar |
| Custo de API Whisper | Low | Rate limit 3/5min, max 50MB | Limitar tamanho |
| Timeout em arquivos grandes | Medium | maxDuration: 300 no route.ts | Split em chunks |

---

## API Contracts

### POST /api/ingestion/upload

```typescript
// Request: FormData
// - file: File (PDF, DOCX, TXT)
// - metadata: JSON string { title?: string }

// Response: 201
interface UploadResponse {
  ingestionId: string
  status: "uploading"
}
```

### POST /api/ingestion/paste

```typescript
// Request: JSON
interface PasteRequest {
  text: string        // min 200 chars
  title?: string
}

// Response: 201
interface PasteResponse {
  ingestionId: string
  status: "processing"
}
```

### GET /api/ingestion/[id]/status (SSE)

```typescript
// Event stream
interface StatusEvent {
  status: "uploading" | "extracting" | "processing" | "review" | "failed"
  progress?: { step: string; percent: number }
  ai_output?: OrganizerOutput  // when status = "review"
  error?: string               // when status = "failed"
}
```

### POST /api/ingestion/[id]/approve

```typescript
// Response: 200
interface ApproveResponse {
  courseId: string
  chaptersCreated: number
}
```

---

## Technical Notes

### Package Addition

```bash
pnpm add pdf-parse mammoth --filter @eximia/web
pnpm add openai --filter @eximia/web
pnpm add -D @types/pdf-parse --filter @eximia/web
```

### Storage Path Pattern

```
{tenantId}/ingestions/{ingestionId}/{original-filename}
```

### Performance Strategy

1. Extractors rodam server-side (API routes), zero impacto no bundle client
2. Whisper API timeout: 120s (max duration Vercel)
3. Para arquivos >25MB (Whisper limit), split audio em chunks
4. SSE para feedback em tempo real (sem polling)

### File Locations

```
apps/web/src/
├── app/
│   ├── api/ingestion/                  # NEW (6 route files)
│   └── (platform)/courses/new/ingest/  # NEW (7 component files)
├── lib/extractors/                     # NEW (4 extractor files)
packages/
├── agents/src/
│   ├── organizer.ts                    # NEW
│   ├── prompts/organizer.ts            # NEW
│   └── schemas/organizer.ts            # NEW
├── database/src/schema/
│   └── content-ingestions.ts           # NEW
supabase/migrations/
└── 20260211000001_content_ingestion.sql # NEW
```

---

## Definition of Done

- [ ] Manager consegue fazer upload de PDF e ter curso organizado
- [ ] Manager consegue colar texto e ter curso organizado
- [ ] Manager consegue fornecer URL YouTube e ter curso organizado
- [ ] Manager consegue fazer upload de audio e ter transcricao organizada
- [ ] Preview editavel (titulo, descricao, capitulos)
- [ ] Botao regenerar com instrucoes funcional
- [ ] Curso e capitulos criados corretamente no banco
- [ ] Multi-tenant isolation validada
- [ ] Rate limiting funcional
- [ ] Error handling com mensagens amigaveis
- [ ] `pnpm lint && pnpm typecheck` passam
- [ ] Testes unitarios para extractors e Organizer Agent

---

## Total Story Points: 34

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 13.1 Schema + Migration | 3 | P0 | Nenhuma |
| 13.2 Organizer Agent | 8 | P0 | 13.1 |
| 13.3 File Upload + Extraction | 5 | P0 | 13.1 |
| 13.4 Audio/Video Transcription | 5 | P1 | 13.1 |
| 13.5 Ingestion Wizard UI | 8 | P0 | 13.2, 13.3, 13.4 |
| 13.6 Approval Flow | 5 | P0 | 13.5 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Epic criado com 6 stories completas | Morgan (PM) |

---

*Epic criado por Morgan (PM) com arquitetura de Aria (Architect) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊
