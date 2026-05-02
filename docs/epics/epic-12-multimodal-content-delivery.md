# Epic 12: Conteudo Multi-Modal — Ler, Ouvir ou Assistir

**Version:** 1.1
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Author:** Morgan (PM Agent) com arquitetura de Aria (Architect Agent)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — FR2 (Content Management), FR3 (Learning Experience)
**Architecture Reference:** `docs/architecture.md` v1.3 — Sections 6.1, 7.1
**Screens Reference:** `docs/screens.md` — Telas 5, 6 (chapter view/edit — base para expansao)

---

## Epic Goal

Transformar a experiencia de aprendizagem permitindo que o aluno **escolha como consumir cada capitulo**: lendo (texto markdown), ouvindo (audio) ou assistindo (video). O mesmo conteudo pedagogico e oferecido em ate 3 modalidades, respeitando diferentes estilos de aprendizagem. O manager/admin pode adicionar versoes em audio e video de cada capitulo, inserir imagens no conteudo textual, e o sistema lembra a preferencia de cada aluno.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui (@eximia/ui) |
| **DB Tables** | `chapters` (alterada: +video_url, +audio_url), `users` (alterada: +learning_mode) |
| **Storage** | Supabase Storage — bucket `chapter-assets` (NOVO) para imagens e audios |
| **Content Rendering** | react-markdown (existente) + react-player (NOVO) + HTML5 audio nativo |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Roles Impactados** | student (consume), teacher (consume), admin/manager (edita) |
| **Dependencia Pacote** | `react-player` ~45KB gzip (YouTube, Vimeo, MP4, HLS) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Chapter content (TEXT markdown) | Implemented | Epic 2, Story 2.2 |
| react-markdown rendering | Implemented | chapter-content.tsx |
| Chapter editor (textarea + preview) | Implemented | chapter-editor-client.tsx |
| Supabase Storage (tenant-assets bucket) | Implemented | Epic 5 |
| Tabs component (@eximia/ui) | Implemented | Design System |
| Server Actions (create/update chapter) | Implemented | courses/actions.ts |
| Zod validation schemas | Implemented | @eximia/shared |
| Extract headings utility (TOC) | Implemented | extract-headings.ts |
| Multi-tenant RLS | Implemented | Epic 1 |

### Current Content Flow

```
Manager edits chapter → textarea (markdown) → Supabase chapters.content (TEXT)
Student views chapter → fetch content → react-markdown → prose-styled HTML
```

### What This Epic Changes

```
Manager edits chapter → text + video_url + audio_url + image upload
Student views chapter → choose mode (read/listen/watch) → render appropriate content
System remembers → user preference persisted in users.learning_mode
```

---

## Enhancement Details

### Core Concept: Multi-Modal Learning

O aluno ve um **toggle de modalidade** no topo do capitulo. Apenas modalidades com conteudo disponivel sao exibidas. Se o capitulo so tem texto, nenhum toggle aparece (comportamento atual preservado).

```
┌─────────────────────────────────────────────┐
│  Capitulo: Introducao ao Machine Learning   │
│                                             │
│  ┌──────────┬──────────┬──────────┐         │
│  │ 📖 Ler   │ 🎧 Ouvir │ 🎬 Ver   │         │
│  └──────────┴──────────┴──────────┘         │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │   CONTEUDO NA MODALIDADE        │        │
│  │   ESCOLHIDA PELO ALUNO          │        │
│  └─────────────────────────────────┘        │
│                                             │
│  💬 Iniciar Sessao Socratica                │
└─────────────────────────────────────────────┘
```

### Behavior Matrix

| Capitulo tem | Toggle exibe | Default |
|---|---|---|
| Texto + Video + Audio | 📖 🎧 🎬 | Preferencia salva do aluno |
| Apenas Texto | Nenhum toggle (direto) | Read |
| Texto + Video | 📖 🎬 | Preferencia salva do aluno |
| Texto + Audio | 📖 🎧 | Preferencia salva do aluno |
| Preferencia nao disponivel | — | Fallback para primeira disponivel |

### Imagens no Conteudo Textual

Dentro do modo "Ler", o manager pode inserir imagens no markdown via upload. As imagens sao armazenadas no Supabase Storage e renderizadas com otimizacao (lazy loading, responsive, lightbox).

### Success Criteria

- [ ] Aluno pode alternar entre Ler, Ouvir e Ver no mesmo capitulo
- [ ] Sistema lembra a preferencia do aluno entre capitulos e sessoes
- [ ] Se a modalidade preferida nao esta disponivel, faz fallback inteligente
- [ ] Manager pode adicionar URL de video e fazer upload de audio no editor
- [ ] Manager pode inserir imagens no conteudo markdown via upload
- [ ] Imagens renderizam com lazy loading e responsividade
- [ ] Video player suporta YouTube, Vimeo e MP4 direto
- [ ] Audio player tem controles nativos estilizados com design system
- [ ] Capitulos apenas com texto continuam funcionando como antes (zero regressao)
- [ ] Performance: nenhum JavaScript extra carregado quando capitulo e apenas texto

---

## Stories

---

### Story 12.1: Schema Multi-Modal + Storage Bucket

**As a** platform developer,
**I want** the database schema to support multiple content modalities per chapter and student preferences,
**so that** we have the data foundation for multi-modal content delivery.

**PRD Reference:** FR2, FR3
**Architecture Reference:** architecture.md v1.3, Section 6.1

**Story Points:** 3
**Priority:** P0 (Blocker — all other stories depend on schema)
**Risk:** LOW — additive changes only (new columns, new bucket)

#### Acceptance Criteria

- [ ] **AC1:** Coluna `video_url` (TEXT, nullable) adicionada a tabela `chapters`
- [ ] **AC2:** Coluna `audio_url` (TEXT, nullable) adicionada a tabela `chapters`
- [ ] **AC3:** Coluna `learning_mode` (TEXT, DEFAULT 'read') adicionada a tabela `users` com CHECK constraint `IN ('read', 'listen', 'watch')`
- [ ] **AC4:** Bucket `chapter-assets` criado no Supabase Storage com policies:
  - Managers/admins podem fazer upload (INSERT) com path `{tenant_id}/{chapter_id}/*`
  - Todos autenticados podem ler (SELECT) assets do seu tenant
  - Bucket limit: 50MiB (teto global). Limites diferenciados via validacao client-side: 5MB imagens, 50MB audio
- [ ] **AC5:** Tipos TypeScript atualizados em `packages/shared/src/types/models.ts`:
  - `Chapter` interface criada (ou expandida se existir) com `video_url?: string | null` e `audio_url?: string | null`
  - `LearningMode` type: `'read' | 'listen' | 'watch'`
  - `User` interface criada (ou expandida se existir) com `learning_mode: LearningMode`
  - **Nota:** Verificar se Chapter/User types ja existem no codebase (podem estar inline nos componentes) e consolidar
- [ ] **AC6:** Zod schemas atualizados:
  - `createChapterSchema` aceita `video_url` e `audio_url` opcionais
  - `updateChapterSchema` aceita `video_url` e `audio_url` opcionais
  - Validacao: `video_url` deve ser URL valida (https), `audio_url` deve ser URL valida
- [ ] **AC7:** Seed data inclui pelo menos 1 capitulo com video_url e audio_url preenchidos
- [ ] **AC8:** RLS policies existentes nao sao alteradas — novas colunas herdam policies da tabela

#### Technical Notes

```sql
-- Migration: 20260210000000_epic12_multimodal_content.sql

-- 1. Add media columns to chapters
ALTER TABLE chapters ADD COLUMN video_url TEXT;
ALTER TABLE chapters ADD COLUMN audio_url TEXT;

-- 2. Add learning preference to users
ALTER TABLE users ADD COLUMN learning_mode TEXT DEFAULT 'read'
  CHECK (learning_mode IN ('read', 'listen', 'watch'));

-- 3. Storage bucket for chapter assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('chapter-assets', 'chapter-assets', true);

-- 4. Storage RLS: authenticated users can read
CREATE POLICY "chapter_assets_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-assets' AND auth.role() = 'authenticated');

-- 5. Storage RLS: managers/admins can upload
CREATE POLICY "chapter_assets_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- 6. Storage RLS: managers/admins can delete own uploads
CREATE POLICY "chapter_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chapter-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

```typescript
// packages/shared/src/types/models.ts — Updates
export type LearningMode = 'read' | 'listen' | 'watch'

// Expand existing Chapter interface
export interface Chapter {
  id: string
  course_id: string
  tenant_id: string
  title: string
  content: string | null
  learning_objective: string | null
  order: number
  status: 'draft' | 'published'
  video_url: string | null     // NEW
  audio_url: string | null     // NEW
  created_at: string
  updated_at: string
}

// packages/shared/src/validators/chapters.ts — Updates
export const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(100),
  learning_objective: z.string().optional(),
  video_url: z.string().url().optional().or(z.literal('')),
  audio_url: z.string().url().optional().or(z.literal('')),
})
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration SQL, shared types, Zod schemas, seed data |
| **@qa (Quinn)** | Validate migration, storage policies, type safety |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Migration applies cleanly. Types compile. Seed runs. | Yes |
| Pre-PR | New columns exist. Storage bucket accessible. RLS intact for existing data. Learning mode persists correctly. | Yes |

---

### Story 12.2: Display Multi-Modal — Mode Selector + Players

**As a** student,
**I want** to choose how I study each chapter — reading, listening, or watching,
**so that** I can learn in the way that works best for me.

**PRD Reference:** FR3 (Learning Experience)
**Architecture Reference:** architecture.md v1.3, Section 7.1

**Story Points:** 8
**Priority:** P0 (Core feature — the student-facing experience)
**Risk:** MEDIUM — new components, must not break existing chapter view

#### Acceptance Criteria

- [ ] **AC1:** Componente `ChapterModeSelector` exibe toggle com modalidades disponiveis usando `Tabs` do @eximia/ui
- [ ] **AC2:** Modo "Ler" (📖) renderiza o conteudo markdown existente via `ChapterContent` (sem alteracoes no comportamento atual)
- [ ] **AC3:** Modo "Ouvir" (🎧) renderiza `ChapterAudioPlayer` — player HTML5 estilizado com:
  - Play/pause, progress bar, tempo atual/total, volume
  - Cores do design system (accent-blue-mid para progress, bg-card para background)
  - Responsivo (full-width em mobile)
- [ ] **AC4:** Modo "Ver" (🎬) renderiza `ChapterVideoPlayer` — wrapper de react-player com:
  - Suporte a YouTube, Vimeo, MP4 direto, HLS
  - Aspect ratio 16:9
  - Controles nativos do player
  - Responsivo (full-width em mobile)
- [ ] **AC5:** Se capitulo tem APENAS texto (video_url e audio_url sao null), nenhum toggle aparece — renderiza direto o markdown (comportamento identico ao atual)
- [ ] **AC6:** Preferencia do aluno e lida de `users.learning_mode` e aplicada como tab default
- [ ] **AC7:** Se a preferencia salva nao esta disponivel no capitulo, fallback para primeira modalidade disponivel (prioridade: read > listen > watch)
- [ ] **AC8:** Ao trocar de modo, a nova preferencia e salva automaticamente via Server Action (debounce, sem reload)
- [ ] **AC9:** TOC (Table of Contents) e sessao socratica permanecem visiveis em todos os modos
- [ ] **AC10:** `react-player` carregado via dynamic import (next/dynamic) — zero JS extra quando capitulo e apenas texto
- [ ] **AC11:** Loading skeleton exibido durante carregamento do player

#### Technical Notes

```typescript
// apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-mode-selector.tsx — NEW

"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useState, useTransition } from "react"
import { updateLearningMode } from "../../actions"
import { ChapterContent } from "./chapter-content"

// Lazy load players — zero JS when not needed
import dynamic from "next/dynamic"
const ChapterVideoPlayer = dynamic(() => import("./chapter-video-player"), {
  loading: () => <PlayerSkeleton type="video" />,
})
const ChapterAudioPlayer = dynamic(() => import("./chapter-audio-player"), {
  loading: () => <PlayerSkeleton type="audio" />,
})

type LearningMode = "read" | "listen" | "watch"

interface ChapterModeSelectorProps {
  content: string
  videoUrl: string | null
  audioUrl: string | null
  userPreference: LearningMode
}

export function ChapterModeSelector({
  content,
  videoUrl,
  audioUrl,
  userPreference,
}: ChapterModeSelectorProps) {
  const modes = getAvailableModes(content, videoUrl, audioUrl)

  // Single mode — render directly, no tabs
  if (modes.length <= 1) {
    return <ChapterContent content={content} />
  }

  const defaultMode = modes.includes(userPreference)
    ? userPreference
    : modes[0]

  return (
    <Tabs defaultValue={defaultMode} onValueChange={handleModeChange}>
      <TabsList>
        {modes.includes("read") && (
          <TabsTrigger value="read">📖 Ler</TabsTrigger>
        )}
        {modes.includes("listen") && (
          <TabsTrigger value="listen">🎧 Ouvir</TabsTrigger>
        )}
        {modes.includes("watch") && (
          <TabsTrigger value="watch">🎬 Ver</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="read">
        <ChapterContent content={content} />
      </TabsContent>

      {audioUrl && (
        <TabsContent value="listen">
          <ChapterAudioPlayer url={audioUrl} />
        </TabsContent>
      )}

      {videoUrl && (
        <TabsContent value="watch">
          <ChapterVideoPlayer url={videoUrl} />
        </TabsContent>
      )}
    </Tabs>
  )
}

function getAvailableModes(
  content: string,
  videoUrl: string | null,
  audioUrl: string | null,
): LearningMode[] {
  const modes: LearningMode[] = []
  if (content) modes.push("read")
  if (audioUrl) modes.push("listen")
  if (videoUrl) modes.push("watch")
  return modes
}
```

```typescript
// Server Action: save learning mode preference
// apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts — ADD
export async function updateLearningMode(mode: LearningMode) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  await supabase
    .from("users")
    .update({ learning_mode: mode })
    .eq("id", user.id)
}
```

```
# New files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/
├── chapter-mode-selector.tsx          # NEW: mode toggle + content routing
├── chapter-video-player.tsx           # NEW: react-player wrapper
├── chapter-audio-player.tsx           # NEW: HTML5 audio with custom UI
└── player-skeleton.tsx                # NEW: loading state for players

# Modified files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/page.tsx
  → Fetch video_url, audio_url, user.learning_mode
  → Replace <ChapterContent> with <ChapterModeSelector>

apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts
  → Add updateLearningMode() server action
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation: mode selector, video player, audio player, page integration |
| **@ux-design-expert (Uma)** | Player UX, mode selector design, responsive behavior, accessibility |
| **@qa (Quinn)** | Mode switching, preference persistence, fallback logic, zero-regression on text-only chapters |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. All components render. | Yes |
| Pre-PR | Mode selector shows correct modes per chapter. Preference saves and loads. Fallback works. Text-only chapters unchanged. Video player plays YouTube/Vimeo/MP4. Audio player has full controls. Dynamic import verified (no extra JS for text-only). Responsive on mobile. | Yes |

---

### Story 12.3: Editor Multi-Modal — Video, Audio e Upload de Imagens

**As a** manager/admin,
**I want** to add video URLs, upload audio files, and insert images into chapter content,
**so that** I can provide multi-modal learning materials to students.

**PRD Reference:** FR2 (Content Management)
**Architecture Reference:** architecture.md v1.3, Section 7.1

**Story Points:** 5
**Priority:** P0 (Managers need this to create multi-modal content)
**Risk:** MEDIUM — modifies existing editor component, adds file upload

#### Acceptance Criteria

- [ ] **AC1:** Campo "URL do Video" adicionado ao editor com:
  - Input de URL com validacao (YouTube, Vimeo, ou URL direta .mp4/.webm)
  - Preview inline do video ao colar URL valida
  - Helper text: "Cole a URL do YouTube, Vimeo ou arquivo de video"
- [ ] **AC2:** Secao "Audio do Capitulo" adicionada ao editor com:
  - Botao "Fazer Upload" para arquivo de audio
  - Aceita: MP3, WAV, OGG, M4A (max 50MB)
  - Progress bar durante upload
  - Preview do audio apos upload (mini player)
  - Opcao de remover audio (com confirmacao)
- [ ] **AC3:** Botao "Inserir Imagem" na toolbar do editor de texto com:
  - Upload de imagem (PNG, JPG, WebP, max 5MB)
  - Apos upload, insere markdown `![](url)` na posicao do cursor
  - Preview da imagem na aba Preview do editor
- [ ] **AC4:** Server Actions `createChapter` e `updateChapter` aceitam e persistem `video_url` e `audio_url`
- [ ] **AC5:** Upload de imagem/audio vai para bucket `chapter-assets` com path `{tenant_id}/{chapter_id}/images/` ou `{tenant_id}/{chapter_id}/audio/`
- [ ] **AC6:** Validacao server-side: URLs de video devem ser HTTPS, arquivos de audio devem ser MIME types permitidos
- [ ] **AC7:** Ao editar capitulo existente, campos de video e audio mostram valores atuais
- [ ] **AC8:** FormField e componentes @eximia/ui usados para todos os novos campos

#### Technical Notes

```typescript
// Updates to chapter-editor-client.tsx
// Add fields after learning_objective:

{/* Video URL */}
<FormField label="URL do Video" htmlFor="video_url">
  <Input
    id="video_url"
    name="video_url"
    placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
    defaultValue={chapter?.video_url ?? ""}
  />
  <p className="text-xs text-text-muted mt-1">
    YouTube, Vimeo ou URL direta (.mp4, .webm)
  </p>
  {videoUrl && <VideoPreview url={videoUrl} />}
</FormField>

{/* Audio Upload */}
<FormField label="Audio do Capitulo" htmlFor="audio">
  <AudioUploader
    currentUrl={chapter?.audio_url}
    chapterId={chapter?.id}
    courseId={courseId}
    onUpload={(url) => setAudioUrl(url)}
    onRemove={() => setAudioUrl(null)}
  />
</FormField>

{/* Image insert button in content toolbar */}
<div className="flex items-center gap-2 mb-2">
  <ImageUploadButton
    chapterId={chapter?.id ?? "new"}
    courseId={courseId}
    onInsert={(url) => {
      // Insert markdown at cursor position
      insertAtCursor(`![](${url})`)
    }}
  />
</div>
```

```typescript
// Image upload utility
// apps/web/src/lib/utils/chapter-asset-upload.ts — NEW
export async function uploadChapterAsset(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
  chapterId: string,
  type: 'images' | 'audio',
): Promise<string> {
  // Derive extension from MIME type (safer than filename parsing)
  const mimeToExt: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  }
  const ext = mimeToExt[file.type] ?? file.name.split('.').pop() ?? 'bin'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${tenantId}/${chapterId}/${type}/${fileName}`

  const { error } = await supabase.storage
    .from('chapter-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('chapter-assets')
    .getPublicUrl(path)

  return publicUrl
}
```

```
# New files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/
├── video-preview.tsx                  # NEW: inline video preview in editor
├── audio-uploader.tsx                 # NEW: audio upload with progress + preview
└── image-upload-button.tsx            # NEW: image upload → markdown insert

apps/web/src/lib/utils/
├── chapter-asset-upload.ts            # NEW: shared upload utility

# Modified files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/
├── chapter-editor-client.tsx          # UPDATED: add video/audio/image fields

apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts (courses level)
  → createChapter: accept video_url, audio_url
  → updateChapter: accept video_url, audio_url
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation: editor fields, upload components, server actions |
| **@ux-design-expert (Uma)** | Upload UX, progress feedback, preview components |
| **@qa (Quinn)** | Upload validation, file type enforcement, MIME check, preview accuracy |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Editor renders. | Yes |
| Pre-PR | Video URL saves and loads. Audio uploads to Storage. Images insert markdown correctly. File type validation works. Preview shows in editor. Existing editor functionality intact. Upload progress visible. Remove audio works. | Yes |

---

### Story 12.4: Imagens Otimizadas no Markdown + Polish

**As a** student,
**I want** images in chapters to load fast and look great,
**so that** the reading experience is smooth and professional.

**PRD Reference:** FR3 (Learning Experience)

**Story Points:** 3
**Priority:** P1 (Enhancement — base image rendering works via react-markdown default)
**Risk:** LOW — enhances existing rendering, no structural changes

#### Acceptance Criteria

- [ ] **AC1:** Componente customizado `img` no ReactMarkdown renderiza imagens com:
  - Lazy loading (`loading="lazy"`)
  - Responsive width (`max-w-full h-auto`)
  - Border radius consistente com design system (`rounded-md`)
  - Background placeholder durante carregamento
- [ ] **AC2:** Imagens clicaveis abrem em lightbox (overlay full-screen com botao fechar)
- [ ] **AC3:** Alt text exibido como caption abaixo da imagem quando presente
- [ ] **AC4:** Imagens grandes (>800px) redimensionadas via CSS para caber no container
- [ ] **AC5:** Error state: se imagem falhar ao carregar, exibe placeholder com mensagem "Imagem indisponivel"
- [ ] **AC6:** Performance: nenhum layout shift (CLS) — dimensoes reservadas via aspect-ratio ou min-height
- [ ] **AC7:** Audio player refinado: wave visualization opcional, timestamp markers
- [ ] **AC8:** Video player refinado: poster frame, playback speed control

#### Technical Notes

```typescript
// Update chapter-content.tsx — custom img component
<ReactMarkdown
  components={{
    h2: ({ children }) => {
      const text = getTextContent(children)
      const id = slugify(text)
      return <h2 id={id}>{children}</h2>
    },
    img: ({ src, alt }) => (
      <figure className="my-6">
        <ImageWithLightbox
          src={src ?? ""}
          alt={alt ?? ""}
          className="rounded-md max-w-full h-auto"
        />
        {alt && (
          <figcaption className="text-xs text-text-muted mt-2 text-center">
            {alt}
          </figcaption>
        )}
      </figure>
    ),
  }}
>
  {content}
</ReactMarkdown>
```

```
# New files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/
├── image-with-lightbox.tsx            # NEW: optimized image with click-to-expand

# Modified files
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/
├── chapter-content.tsx                # UPDATED: custom img component
├── chapter-audio-player.tsx           # UPDATED: visual polish
├── chapter-video-player.tsx           # UPDATED: poster + speed control
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Image optimization, lightbox, player polish |
| **@ux-design-expert (Uma)** | Lightbox UX, image presentation, player visual refinement |
| **@qa (Quinn)** | Image loading performance, CLS score, error states, responsive behavior |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Images render in markdown. | Yes |
| Pre-PR | Lazy loading verified. Lightbox opens/closes. Error state shows. No CLS. Responsive on mobile. Alt text as caption. Player polish visible. | No (P1) |

---

## Dependency Graph

```
Story 12.1 (Schema + Storage)
       │
       ├──→ Story 12.2 (Display Multi-Modal — Players + Mode Selector)
       │
       ├──→ Story 12.3 (Editor — Video, Audio, Image Upload)
       │
       └──→ Story 12.4 (Image Optimization + Polish)
               ↑ depends on 12.2 and 12.3
```

**Execution Order:**
1. **Story 12.1** first (P0 — schema foundation)
2. **Stories 12.2 + 12.3** in parallel (both depend on 12.1 but are independent: display vs editor)
3. **Story 12.4** last (P1 — polish layer on top of 12.2 and 12.3)

---

## Compatibility Requirements

- [ ] Existing chapters (text-only) render identically to current behavior
- [ ] No new JavaScript loaded for text-only chapters (dynamic import)
- [ ] Existing editor features (title, content, learning_objective) unchanged
- [ ] Database migration is additive only (no column drops, no type changes)
- [ ] RLS policies remain intact — new columns inherit existing policies
- [ ] Socratic sessions continue to work regardless of learning mode
- [ ] Chapter navigation (prev/next) unaffected
- [ ] TOC (table of contents) remains functional in all modes
- [ ] Mobile responsive across all modes

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| **react-player bundle size** | LOW | Dynamic import — only loaded when chapter has video | Remove dynamic import, SSR fallback |
| **Storage costs for audio files** | MEDIUM | 50MB limit per file. Tenant-scoped paths. Managers control uploads | Reduce limit or add quota per tenant |
| **Broken video URLs** | LOW | Video player shows error state with message. URL validated on save | Render text mode as fallback |
| **Large image uploads slow editor** | LOW | Client-side compression before upload. Progress indicator. 5MB limit | Reduce limit to 2MB |
| **Learning mode preference lost** | LOW | Fallback to 'read' if column null. localStorage backup | Default to 'read', no preference features |
| **react-markdown custom img breaks existing content** | LOW | Only adds wrapper — existing markdown syntax unchanged | Revert to default img handling |

---

## API Contracts

### Chapter Read (Updated)

```typescript
// Existing endpoint returns additional fields
interface ChapterResponse {
  id: string
  title: string
  content: string | null
  learning_objective: string | null
  order: number
  status: string
  video_url: string | null     // NEW
  audio_url: string | null     // NEW
}
```

### User Preference

```typescript
// Server Action: updateLearningMode(mode: LearningMode)
// No API route needed — direct Supabase update via server action

// Read: included in getAuthProfile() or fetched on chapter page
interface UserProfile {
  // ...existing fields
  learning_mode: LearningMode  // NEW
}
```

### Asset Upload

```typescript
// Client-side upload via Supabase Storage SDK (no API route)
// Path: chapter-assets/{tenant_id}/{chapter_id}/{type}/{uuid}.{ext}
// Returns: public URL
```

---

## Technical Notes

### Package Addition

```bash
# Only new dependency
pnpm add react-player --filter @eximia/web
```

### Storage Bucket Configuration

```toml
# supabase/config.toml — Update
[storage.buckets.chapter-assets]
public = true
file_size_limit = "50MiB"
allowed_mime_types = [
  "image/png", "image/jpeg", "image/webp",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"
]
```

### Performance Strategy

1. **Dynamic imports** — react-player loaded only when needed
2. **Lazy loading** — images use `loading="lazy"` attribute
3. **Public bucket** — direct URL access, no auth overhead for assets
4. **No SSR for players** — `ssr: false` on dynamic imports (avoids hydration mismatch)

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/
├── _components/
│   ├── chapter-content.tsx                # UPDATED: custom img component (12.4)
│   ├── chapter-mode-selector.tsx          # NEW (12.2)
│   ├── chapter-video-player.tsx           # NEW (12.2)
│   ├── chapter-audio-player.tsx           # NEW (12.2)
│   ├── player-skeleton.tsx                # NEW (12.2)
│   └── image-with-lightbox.tsx            # NEW (12.4)
├── page.tsx                               # UPDATED: fetch media fields + mode (12.2)
└── actions.ts                             # UPDATED: updateLearningMode (12.2)

apps/web/src/app/(platform)/courses/[courseId]/chapters/
├── actions.ts (courses level)             # UPDATED: video_url, audio_url in create/update (12.3)

apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/
├── chapter-editor-client.tsx              # UPDATED: video/audio/image fields (12.3)
├── video-preview.tsx                      # NEW (12.3)
├── audio-uploader.tsx                     # NEW (12.3)
└── image-upload-button.tsx                # NEW (12.3)

apps/web/src/lib/utils/
├── chapter-asset-upload.ts                # NEW (12.3)

packages/shared/src/
├── types/models.ts                        # UPDATED: Chapter, LearningMode, User (12.1)
└── validators/chapters.ts                 # UPDATED: video_url, audio_url (12.1)

supabase/
├── migrations/
│   └── 20260210000000_epic12_multimodal_content.sql  # NEW (12.1)
├── config.toml                            # UPDATED: chapter-assets bucket (12.1)
├── seed.sql                               # UPDATED: sample multi-modal chapter (12.1)
└── seed-remote.ts                         # UPDATED: sample multi-modal chapter (12.1)
```

---

## Definition of Done

- [ ] All 4 stories completed with acceptance criteria met
- [ ] Student can toggle between Read, Listen, and Watch modes
- [ ] System remembers student learning mode preference
- [ ] Manager can add video URL, upload audio, and insert images in editor
- [ ] Text-only chapters render identically to current behavior (zero regression)
- [ ] react-player only loaded when needed (dynamic import verified)
- [ ] Images render with lazy loading, responsive sizing, and lightbox
- [ ] Audio player has full controls (play/pause, progress, volume)
- [ ] Video player supports YouTube, Vimeo, and direct URLs
- [ ] File uploads validated server-side (type, size)
- [ ] Storage bucket with correct RLS policies
- [ ] Mobile responsive across all modes
- [ ] Performance: no CLS, lazy loading, dynamic imports
- [ ] Existing functionality (Epics 1-11) unaffected

---

## Total Story Points: 19

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 12.1 Schema + Storage | 3 | P0 | Epic 2 (existing schema) |
| 12.2 Display Multi-Modal | 8 | P0 | Story 12.1 |
| 12.3 Editor Multi-Modal | 5 | P0 | Story 12.1 |
| 12.4 Image Optimization + Polish | 3 | P1 | Stories 12.2, 12.3 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-09 | 1.0 | Epic created from Architect (Aria) multi-modal architecture proposal — Read/Listen/Watch model with student preference persistence | Morgan (PM) |
| 2026-02-09 | 1.1 | QA fixes (Quinn review): E12-H1 remove `teacher` role from storage policies (role unified to `manager`), E12-H2 clarify file size limits (client-side validation, bucket keeps 50MiB global), E12-M1 add `audio/x-m4a` MIME type, E12-M2 clarify Chapter/User type locations, E12-L1 derive file extension from MIME type | Morgan (PM) |

---

*Epic criado por Morgan (PM Agent) com arquitetura de Aria (Architect Agent) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊
