# Story 13.4: Audio/Video Transcription (Whisper API)

**Epic:** [Epic 13 — AI Content Ingestion](../../epics/epic-13-ai-content-ingestion.md)
**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM)
**Status:** Pending
**Story Points:** 5
**Priority:** P1 (complementa Story 13.3)
**Blocked By:** Story 13.1
**Blocks:** Story 13.5
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** to upload audio files or provide YouTube URLs for automatic transcription,
**so that** spoken content is converted to text for AI organization.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.4, Section 4.1 |
| **PRD Ref** | `docs/prd.md` — FR2 (Course Management), FR3 (Content Delivery) |
| **Stack** | OpenAI Whisper API, Next.js API Routes, Supabase Storage |
| **DB Tables** | `content_ingestions` (write) |
| **QA Notes** | Testar com audios PT-BR de diferentes qualidades e sotaques |

---

## Acceptance Criteria

- [ ] **AC1:** Transcricao de audio via Whisper API
  - Suporta MP3, WAV, M4A, OGG (max 50MB)
  - Upload para Supabase Storage primeiro
  - Envia para Whisper API com `model: "whisper-1"`, `language: "pt"`
  - Texto transcrito salvo em raw_text
  - Status flow: uploading → extracting → processing
- [ ] **AC2:** API Route para audio upload
  - Reutiliza `POST /api/ingestion/upload` com source_type='audio'
  - Valida MIME types de audio
  - Detecta automaticamente audio vs documento pelo MIME type
- [ ] **AC3:** API Route `POST /api/ingestion/video-url`
  - Aceita `{ url: string, title?: string }`
  - Valida URL (youtube.com, youtu.be)
  - Tenta extrair legendas/transcript via API publica
  - Fallback: baixa audio do video e envia para Whisper
  - Cria registro com source_type='video_url'
- [ ] **AC4:** Progress feedback
  - Status intermediario visivel: "Transcrevendo audio..."
  - Atualiza processing_metadata com info de duracao estimada
- [ ] **AC5:** Error handling
  - Audio sem fala → "Nao foi possivel identificar fala no audio."
  - YouTube URL invalida → "URL do YouTube invalida ou video indisponivel."
  - Whisper API indisponivel → retry 1x, depois erro amigavel
  - Audio muito longo → split em chunks de 25MB (Whisper limit)
- [ ] **AC6:** Env var `OPENAI_API_KEY` documentada e configurada
- [ ] **AC7:** Package `openai` instalado

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: API key handling, file size validation, error resilience, retry patterns.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 7) Instalar dependencia
  - [ ] `pnpm add openai --filter @eximia/web`
  - [ ] Configurar OPENAI_API_KEY no .env.local

- [ ] **Task 2** (AC: 1, 2) Implementar audio extractor
  - [ ] Criar `apps/web/src/lib/extractors/audio-extractor.ts`
  - [ ] Integrar com OpenAI Whisper API
  - [ ] Suportar split para arquivos >25MB
  - [ ] Testar com audio PT-BR

- [ ] **Task 3** (AC: 3) Implementar YouTube extractor
  - [ ] Criar `apps/web/src/lib/extractors/youtube-extractor.ts`
  - [ ] Tentar legendas via fetch direto
  - [ ] Fallback para transcricao com Whisper
  - [ ] Validar URLs de YouTube

- [ ] **Task 4** (AC: 3) Implementar video-url route
  - [ ] Criar `apps/web/src/app/api/ingestion/video-url/route.ts`
  - [ ] Auth guard + rate limiting
  - [ ] Integrar com youtube extractor

- [ ] **Task 5** (AC: 2) Atualizar upload route
  - [ ] Adicionar MIME types de audio na validacao
  - [ ] Roteamento automatico: audio → Whisper, documento → pdf-parse/mammoth

- [ ] **Task 6** (AC: 6) Documentar env vars
  - [ ] Adicionar OPENAI_API_KEY ao .env.example
  - [ ] Documentar em README do app

---

## Dev Notes

### Audio Extractor

```typescript
// apps/web/src/lib/extractors/audio-extractor.ts
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MAX_WHISPER_SIZE = 25 * 1024 * 1024 // 25MB

export async function transcribeAudio(
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_WHISPER_SIZE) {
    // For files > 25MB, we'd need to split
    // For now, take first 25MB chunk
    // TODO: implement proper chunking in future iteration
    throw new Error("Audio muito grande para transcricao direta. Limite: 25MB.")
  }

  const file = new File([buffer], filename, { type: getMimeType(filename) })

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "pt",
    response_format: "text",
  })

  if (!transcription || transcription.trim().length < 50) {
    throw new Error("Nao foi possivel identificar fala suficiente no audio.")
  }

  return transcription
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const mimes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
  }
  return mimes[ext ?? ""] ?? "audio/mpeg"
}
```

### YouTube Extractor

```typescript
// apps/web/src/lib/extractors/youtube-extractor.ts

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export async function extractYouTubeTranscript(url: string): Promise<string> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error("URL do YouTube invalida.")
  }

  // Try to get captions/transcript
  // Implementation depends on available YouTube API
  // Fallback: throw error suggesting audio upload
  throw new Error(
    "Transcricao automatica de YouTube nao disponivel. " +
    "Baixe o audio e faca upload diretamente."
  )
}
```

### MIME Types for Audio

```typescript
const AUDIO_MIME_TYPES: Record<string, { ext: string; maxSize: number }> = {
  "audio/mpeg": { ext: "mp3", maxSize: 50 * 1024 * 1024 },
  "audio/wav": { ext: "wav", maxSize: 50 * 1024 * 1024 },
  "audio/mp4": { ext: "m4a", maxSize: 50 * 1024 * 1024 },
  "audio/x-m4a": { ext: "m4a", maxSize: 50 * 1024 * 1024 },
  "audio/ogg": { ext: "ogg", maxSize: 50 * 1024 * 1024 },
}
```

### File Locations

```
apps/web/src/
├── app/api/ingestion/
│   ├── upload/route.ts          # UPDATED: add audio MIME types
│   └── video-url/route.ts       # NEW
└── lib/extractors/
    ├── audio-extractor.ts       # NEW
    └── youtube-extractor.ts     # NEW
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Transcreve audio MP3 de 5min PT-BR corretamente | Yes |

---

## Definition of Done

- [ ] Audio upload com transcricao funcional
- [ ] YouTube URL aceita com transcricao (ou fallback amigavel)
- [ ] Whisper API integrado com retry
- [ ] OPENAI_API_KEY configurada
- [ ] Error handling completo
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dev)** | Implementar Whisper integration, YouTube extractor |
| **@devops (Gage)** | Configurar OPENAI_API_KEY no Vercel |
| **@qa (QA)** | Testar com audios PT-BR de diferentes qualidades |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Custo Whisper API acumula | Medium | Rate limit 3/5min, max 50MB, monitorar uso |
| Audio de baixa qualidade | Medium | Warning no output, sugerir upload de melhor qualidade |
| YouTube bloqueia extractor | High | Fallback manual (sugerir download + upload audio) |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story criada | Morgan (PM) |

---

*Story criada por Morgan (PM) — eximIA Academy*

— Morgan, planejando o futuro 📊
