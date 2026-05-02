# Story 12.4: Imagens Otimizadas no Markdown + Polish

**Epic:** [Epic 12 — Conteudo Multi-Modal](../../epics/epic-12-multimodal-content-delivery.md)
**Version:** 1.0
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Author:** River (SM Agent)
**Status:** Done
**Story Points:** 3
**Priority:** P1 (Enhancement — base image rendering works via react-markdown default)
**Blocked By:** Story 12.2, Story 12.3
**Blocks:** None
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student,
**I want** images in chapters to load fast and look great,
**so that** the reading experience is smooth and professional.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 |
| **PRD Ref** | `docs/prd.md` — FR3 (Learning Experience) |
| **Stack** | React, react-markdown, @eximia/ui, CSS |
| **Components** | `chapter-content.tsx` (UPDATED), `chapter-audio-player.tsx` (UPDATED), `chapter-video-player.tsx` (UPDATED) |
| **Design Tokens** | rounded-md (12px), bg-card (#1e1e1e), text-muted, accent-blue-mid |

---

## Acceptance Criteria

- [x] **AC1:** Componente customizado `img` no ReactMarkdown renderiza imagens com:
  - Lazy loading (`loading="lazy"`)
  - Responsive width (`max-w-full h-auto`)
  - Border radius consistente com design system (`rounded-md`)
  - Background placeholder durante carregamento
- [x] **AC2:** Imagens clicaveis abrem em lightbox (overlay full-screen com botao fechar)
- [x] **AC3:** Alt text exibido como caption abaixo da imagem quando presente
- [x] **AC4:** Imagens grandes (>800px) redimensionadas via CSS para caber no container
- [x] **AC5:** Error state: se imagem falhar ao carregar, exibe placeholder com mensagem "Imagem indisponivel"
- [x] **AC6:** Performance: nenhum layout shift (CLS) — dimensoes reservadas via aspect-ratio ou min-height
- [x] **AC7:** Audio player refinado: wave visualization opcional, timestamp markers
- [x] **AC8:** Video player refinado: poster frame, playback speed control

---

## CodeRabbit Integration

> CodeRabbit will review this story's PR for: Image loading performance (lazy loading, CLS), accessibility (alt text, lightbox keyboard navigation), error handling (broken image fallback), CSS consistency with design tokens.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 3, 4, 5, 6) Create ImageWithLightbox component
  - [x] Create `image-with-lightbox.tsx` in chapter _components
  - [x] Implement `<img>` with `loading="lazy"`, `max-w-full h-auto`, `rounded-md`
  - [x] Add background placeholder (bg-card with animate-pulse) during load
  - [x] Add `onError` handler — show "Imagem indisponivel" placeholder
  - [x] Reserve space with `min-h-[200px]` to prevent CLS
  - [x] On click, open lightbox overlay

- [x] **Task 2** (AC: 2) Implement lightbox overlay
  - [x] Full-screen overlay with semi-transparent bg-black/80 background
  - [x] Centered image at max viewport size
  - [x] Close button (top-right) + click-outside to close + Escape key
  - [x] Prevent body scroll when lightbox open
  - [x] Keyboard accessible (focus trap, Escape to close)

- [x] **Task 3** (AC: 1, 3) Update chapter-content.tsx with custom img component
  - [x] Add `img` to ReactMarkdown `components` prop
  - [x] Wrap in `<figure>` with `my-6` spacing
  - [x] Render `<ImageWithLightbox>` with src and alt
  - [x] If alt text present, render `<figcaption>` with `text-xs text-text-muted text-center`

- [x] **Task 4** (AC: 7) Polish ChapterAudioPlayer
  - [x] Add visual progress indicator (animated bar or simple wave)
  - [x] Add timestamp markers (if audio duration > 5min, show minute markers)
  - [x] Ensure controls are keyboard accessible

- [x] **Task 5** (AC: 8) Polish ChapterVideoPlayer
  - [x] Add poster frame support (first frame or custom thumbnail)
  - [x] Add playback speed control (0.5x, 1x, 1.25x, 1.5x, 2x)
  - [x] Ensure player handles URL errors gracefully

- [x] **Task 6** (AC: all) Regression + visual validation
  - [x] Verify images in markdown render with lazy loading
  - [x] Verify lightbox opens and closes correctly
  - [x] Verify broken image shows error placeholder
  - [x] Verify no CLS on page load with images
  - [x] Verify alt text renders as caption
  - [x] Verify audio player polish (visual progress, timestamps)
  - [x] Verify video player polish (poster, speed control)
  - [x] Run `pnpm lint && pnpm typecheck`

---

## Dev Notes

### Custom img Component for ReactMarkdown

```typescript
// Update chapter-content.tsx
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

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/
├── chapter-content.tsx                # UPDATED: custom img component
├── chapter-audio-player.tsx           # UPDATED: visual polish
├── chapter-video-player.tsx           # UPDATED: poster + speed control
└── image-with-lightbox.tsx            # NEW: optimized image with lightbox
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Images render in markdown. | Yes |
| Pre-PR | Lazy loading verified. Lightbox opens/closes. Error state shows. No CLS. Responsive on mobile. Alt text as caption. Player polish visible. | No (P1) |

---

## Definition of Done

- [x] Images render with lazy loading, responsive sizing, and design system border radius
- [x] Lightbox overlay opens on click, closes on button/escape/click-outside
- [x] Alt text displays as caption below images
- [x] Broken images show error placeholder
- [x] No layout shift (CLS) on page load
- [x] Audio player has visual progress and timestamp markers
- [x] Video player supports poster frame and playback speed
- [x] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Image optimization, lightbox, player polish |
| **@ux-design-expert (Uma)** | Lightbox UX, image presentation, player visual refinement |
| **@qa (Quinn)** | Image loading performance, CLS score, error states, responsive behavior |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Lightbox conflicts with existing modals | LOW | Use Portal to render at document root, separate z-index layer |
| CLS on slow connections | LOW | min-height placeholder reserves space before image loads |
| Custom img component breaks existing markdown | LOW | Only wraps — existing markdown syntax unchanged |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-09 | 1.0 | Story created from Epic 12 v1.1 (QA-reviewed) | River (SM) |

---

## QA Results

*(To be filled by @qa after review)*

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
*(To be filled by @dev)*

### Completion Notes
Implemented as specified in story. All typecheck passes.

### File List
*(To be filled by @dev)*

---

*Story criada por River (SM Agent) — eximIA Academy*

— River, removendo obstaculos 🌊
