# Story 3.3: Interface do Chat Socratico

**Epic:** [Epic 3 — Socratic Learning Engine](../epics/epic-3-socratic-learning-engine.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 3.1, 3.4
**Blocks:** 3.5
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student,
**I want** conversar com a IA socratica via chat,
**so that** eu possa refletir e aplicar o que aprendi.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.3 — Section 9.2 (Frontend Chat Component) |
| **Screens Ref** | `docs/screens.md` — Screen 10 (Socratic Chat) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Vercel AI SDK `useChat()` + Tailwind CSS 4 + shadcn/ui |
| **Dependencies** | Story 3.1 (session page route), Story 3.4 (API endpoint for streaming) |
| **Streaming Protocol** | DataStream protocol (Vercel AI SDK) — `0:"word"\n` format |

---

## Acceptance Criteria

- [x] **AC1:** Tela de chat (`/courses/[courseId]/chapters/[chapterId]/session`) com layout de chat full-height

- [x] **AC2:** Header com "Voltar ao Capitulo" (link) e `InteractionCounter` ("X de Y restantes" — Y lido da sessao via `max_interactions_per_session` do tenant, nao hardcoded)

- [x] **AC3:** Pergunta inicial exibida como primeira mensagem do tutor (role: `assistant`) via `initialMessages` do `useChat()`

- [x] **AC4:** Campo de input (`ChatInput`) com textarea auto-resize, botao send, placeholder "Escreva sua reflexao..."

- [x] **AC5:** Ao enviar resposta: input disabled, `TypingIndicator` ("Pensando..." com animacao de dots) enquanto pipeline processa

- [x] **AC6:** Resposta da IA aparece via streaming word-by-word (DataStream protocol via `useChat()`)

- [x] **AC7:** Scroll automatico para ultima mensagem apos cada nova mensagem (student e tutor)

- [x] **AC8:** Mensagens com estilo diferenciado: tutor (alinhado a esquerda, avatar IA) vs student (alinhado a direita, avatar user)

- [x] **AC9:** InteractionCounter atualiza automaticamente apos cada turno completo (leitura do `data` annotation do stream)

- [x] **AC10:** Input desabilitado durante loading state (previne double-submit)

- [x] **AC11:** Interface responsiva: funciona em desktop (chat centralizado, max-width 768px) e mobile (full-width)

- [x] **AC12:** Tratamento de erro: se pipeline falhar (502), exibir toast "Erro ao processar. Tentar novamente?" com botao retry. Mensagem do student permanece no chat, input reabilitado para retry

- [x] **AC13:** Medir `response_time_seconds` no frontend (tempo entre envio da mensagem e inicio da resposta) e enviar ao backend para o Analyst

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar pagina `/courses/[courseId]/chapters/[chapterId]/session/page.tsx`
  - [x] RSC: carregar sessao ativa via Supabase (session + question + chapter title)
  - [x] Se sessao nao existe ou nao pertence ao student → redirect para chapter page
  - [x] Se sessao completa → render em modo read-only (Story 3.5)
  - [x] Pass session data como props para client component `SocraticChat`

- [x] **Task 2** (AC: 1, 3, 6, 9, 10, 13) Criar componente `SocraticChat` (client component)
  - [x] `useChat()` hook conectado a `/api/sessions/[sessionId]/messages`
  - [x] `initialMessages`: pergunta inicial como `{ role: 'assistant', content: question.content }`
  - [x] Handle `data` annotations para atualizar session metadata (interactions_remaining, session_status)
  - [x] Medir `response_time_seconds`: `Date.now()` no submit, diff quando `isLoading` → false
  - [x] Enviar `response_time_seconds` no body do request via `useChat` options

- [x] **Task 3** (AC: 8) Criar componente `ChatMessage`
  - [x] Props: `role` (assistant/user), `content`, `isStreaming`
  - [x] Tutor: alinhado a esquerda, avatar IA (icon), bg card
  - [x] Student: alinhado a direita, avatar user (icon), bg accent
  - [x] Streaming indicator para mensagem sendo recebida (cursor blinking)

- [x] **Task 4** (AC: 4, 10) Criar componente `ChatInput`
  - [x] Textarea com auto-resize (`onInput` → adjust `style.height` baseado em `scrollHeight`)
  - [x] Botao send (shadcn `Button` com icon `Send`)
  - [x] Placeholder: "Escreva sua reflexao..."
  - [x] `disabled` durante loading state (previne double-submit)
  - [x] Submit via Enter (sem Shift) ou click no botao

- [x] **Task 5** (AC: 2, 9) Criar componente `InteractionCounter`
  - [x] Display: "X de Y restantes" onde Y vem da sessao (nao hardcoded)
  - [x] Atualiza via `data` annotation do stream (`interactions_remaining`)
  - [x] Visual: progress dots ou counter numerico

- [x] **Task 6** (AC: 5) Criar componente `TypingIndicator`
  - [x] "Pensando..." com animacao de dots (CSS pulse/bounce)
  - [x] Exibido quando `isLoading` do `useChat()` e true
  - [x] Posicionado como mensagem do tutor (alinhado a esquerda)

- [x] **Task 7** (AC: 7) Implementar scroll automatico
  - [x] `useEffect` que faz `scrollIntoView({ behavior: 'smooth' })` no ultimo elemento
  - [x] Trigger: quando `messages` array muda (nova mensagem student ou tutor)

- [x] **Task 8** (AC: 2) Implementar header com "Voltar ao Capitulo" + InteractionCounter
  - [x] Link "Voltar ao Capitulo" → `/courses/[courseId]/chapters/[chapterId]`
  - [x] InteractionCounter no lado direito do header

- [x] **Task 9** (AC: 12) Implementar error handling
  - [x] `useChat()` `onError` callback → exibir toast via shadcn Sonner
  - [x] Toast: "Erro ao processar. Tentar novamente?" com botao retry
  - [x] Mensagem do student permanece no chat apos erro
  - [x] Input reabilitado para retry

- [x] **Task 10** (AC: 11) Implementar layout responsivo
  - [x] Desktop: chat centralizado, `max-width: 768px`, `mx-auto`
  - [x] Mobile: full-width, padding ajustado
  - [x] Input fixo no bottom (sticky)

- [x] **Task 11** Testes
  - [x] Component test: `ChatMessage` renders tutor vs student styles
  - [x] Component test: `ChatInput` auto-resize, disabled state
  - [x] Component test: `InteractionCounter` renders count
  - [x] Component test: `TypingIndicator` animation
  - [x] Integration test: `SocraticChat` with mocked `useChat()` — send message, receive streaming, counter updates
  - [x] Integration test: error recovery (mock error → toast → retry)

---

## Dev Notes

### useChat() Hook [Source: architecture.md Section 9.2]

```typescript
'use client'
import { useChat } from 'ai/react'

export function SocraticChat({
  sessionId,
  initialQuestion,
  maxInteractions,
}: {
  sessionId: string
  initialQuestion: string
  maxInteractions: number
}) {
  const [interactionsRemaining, setInteractionsRemaining] = useState(maxInteractions)
  const [sessionStatus, setSessionStatus] = useState<'active' | 'completed'>('active')
  const submitTimeRef = useRef<number>(0)

  const { messages, input, handleInputChange, handleSubmit, isLoading, data, error } = useChat({
    api: `/api/sessions/${sessionId}/messages`,
    initialMessages: [
      { id: 'q0', role: 'assistant', content: initialQuestion },
    ],
    body: {
      response_time_seconds: 0, // Updated dynamically
    },
    onError: (error) => {
      toast.error('Erro ao processar. Tentar novamente?')
    },
  })

  // Update session metadata from data annotations
  useEffect(() => {
    if (data && data.length > 0) {
      const latest = data[data.length - 1] as any
      if (latest.interactions_remaining !== undefined) {
        setInteractionsRemaining(latest.interactions_remaining)
      }
      if (latest.session_status === 'completed') {
        setSessionStatus('completed')
      }
    }
  }, [data])

  // Measure response time
  const onSubmit = (e: React.FormEvent) => {
    submitTimeRef.current = Date.now()
    handleSubmit(e, {
      body: {
        response_time_seconds: 0, // Will be calculated server-side fallback
      },
    })
  }

  // ... render chat UI
}
```

### Screen 10 Components [Source: screens.md]

| Component | Description |
|-----------|-------------|
| `InteractionCounter` | "2 de 3 restantes" com progress dots ou counter numerico |
| `ChatMessage` | Bolha com role (tutor/aluno), avatar, timestamp, streaming indicator |
| `ChatInput` | Textarea auto-resize, botao send, disabled durante loading |
| `TypingIndicator` | "Pensando..." com animacao enquanto pipeline processa |
| `SessionCompleteBar` | Aparece quando `interactions_remaining = 0` (Story 3.5) |

### Screen 10 States [Source: screens.md]

1. **Initial**: Pergunta do tutor visivel, input ativo
2. **Composing**: Student digitando, botao send ativo
3. **Processing**: Input disabled, TypingIndicator visivel
4. **Streaming**: Resposta do tutor aparecendo word-by-word
5. **Mid-session**: 1-2 turnos completos, counter atualizado
6. **Session Complete**: Chat read-only, SessionCompleteBar visivel (Story 3.5)

### DataStream Protocol [Source: architecture.md]

```
// Text chunks (streamed word-by-word)
0:"word "\n

// Data annotations (session metadata)
2:[{"session_status":"active","interactions_remaining":2,"turn_number":1}]\n

// Response headers
Content-Type: text/plain; charset=utf-8
X-Vercel-AI-Data-Stream: v1
```

### Auto-resize Textarea Pattern

```typescript
function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
  const target = e.currentTarget
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 200)}px`
}
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/
├── page.tsx                    # RSC: loads session, renders SocraticChat
└── _components/
    ├── socratic-chat.tsx       # Client component: useChat() integration
    ├── chat-message.tsx        # Message bubble (tutor vs student)
    ├── chat-input.tsx          # Auto-resize textarea + send button
    ├── interaction-counter.tsx # "X de Y restantes"
    ├── typing-indicator.tsx    # "Pensando..." animation
    └── session-complete-bar.tsx # Story 3.5
```

### Testing

- **Test location:** `apps/web/tests/` and component `__tests__/` co-located
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock `useChat()` from `ai/react` to return controlled state
- **Streaming mock:** Simulate `messages` array updates for streaming behavior

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, componentes renderizam sem erros | Yes |
| Pre-PR | Chat funcional end-to-end, streaming word-by-word, counter atualiza, error recovery funciona | Yes |
| UX | Review por @ux-design-expert: chat feels natural, mobile funciona | No |

---

## Definition of Done

- [x] Todos os ACs passam
- [x] Chat funcional com streaming word-by-word
- [x] InteractionCounter atualiza corretamente apos cada turno
- [x] Error handling funciona (toast + retry)
- [x] Layout responsivo (desktop + mobile)
- [x] `response_time_seconds` medido e enviado ao backend
- [x] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, componentes, useChat integration) |
| **@ux-design-expert** | Review da UX do chat: spacing, bubbles, streaming feel, mobile layout |
| **@qa (Quinn)** | Validacao: streaming funciona, counter atualiza, error handling, responsividade |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| `useChat()` data annotations nao parseable | MEDIUM | Testar format do DataStream protocol com mock API |
| Auto-resize textarea quebra em mobile browsers | LOW | Testar em Safari iOS + Chrome Android |
| Streaming delay imperceptivel em conexoes rapidas | LOW | ~25ms delay per word no backend garante typing feel |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 3 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Dex (@dev) — Claude Opus 4.6

### Debug Log References
Session: 2026-02-08

### Completion Notes List
All tasks completed. Implemented full Socratic chat interface with session page (RSC), SocraticChat client component using useChat() hook with DataStream protocol, ChatMessage with differentiated tutor/student styles, ChatInput with auto-resize textarea and double-submit prevention, InteractionCounter with server-pushed data annotations, TypingIndicator with CSS animation, auto-scroll, responsive layout (desktop max-width 768px, mobile full-width), and error handling with toast + retry.

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/socratic-chat.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/chat-message.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/chat-input.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/interaction-counter.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/typing-indicator.tsx`

---

## QA Results

### Review Date: 2026-02-08

### Reviewed By: Quinn (Test Architect)

### Review Type: Pre-Development Story Proposal Review

### Code Quality Assessment

**Overall:** Strong story with good component breakdown matching screens.md. The `useChat()` integration pattern is well-documented with complete code example. Data annotation approach for counter updates (server-push) is a sound improvement over architecture's client-side counting.

### Findings

#### MEDIUM Severity

**S3.3-M1: Component file paths diverge from architecture.md Section 11**
- **Location:** File Locations section
- **Issue:** Architecture defines shared components at `apps/web/src/components/chat/` (chat-container.tsx, chat-message.tsx, etc.). Story places them at route-level `session/_components/` (socratic-chat.tsx, chat-message.tsx, etc.).
- **Impact:** Dev following story paths will diverge from architecture. If other features need chat components (e.g., teacher preview), route-level co-location prevents reuse.
- **Action Required:** @architect should decide: shared `components/chat/` vs route-level `_components/`. Document decision. If route-level preferred, architecture Section 11 must be updated.
- **Suggested Owner:** @architect (Aria)

**S3.3-M2: Interaction tracking approach differs from architecture Section 9.2**
- **Location:** AC9, Task 5
- **Issue:** Architecture uses client-side counting: `turnsUsed = messages.filter(m => m.role === 'user').length`. Story uses server-pushed `data` annotations with `interactions_remaining`. Both approaches coexist in Dev Notes code (state from annotations AND messages array).
- **Impact:** No runtime issue — story approach is BETTER (server-authoritative). But architecture section is now outdated.
- **Action Required:** Note as intentional improvement. Architecture Section 9.2 should be updated post-Epic 3 to use data annotations pattern.
- **Suggested Owner:** @architect (Aria) — post-Epic 3

#### LOW Severity

**S3.3-L1: Screens.md "Session Complete" state still references "Ver Resumo button"**
- Screens.md state table: "Session Complete → Ver Resumo button"
- Story 3.5 implements inline transition (M-4 resolution from epic QA)
- **Action:** Post-Epic 3, screens.md should be updated. No story change needed.

**S3.3-L2: `response_time_seconds` measurement relies on `isLoading` state change**
- AC13 measures time between submit and response start
- Dev Notes mention `Date.now()` on submit, diff when `isLoading` changes to false
- `isLoading` going false means response COMPLETE, not response START
- More accurate: measure to first `data` event or first message update
- **Action:** Dev should use `onResponse` callback of `useChat()` for accurate TTFB measurement

### Compliance Check

- Architecture Alignment: CONCERNS — Component paths diverge (M1), interaction tracking differs (M2)
- Screens Alignment: ✓ — All 5 components correctly mapped, all 6 states covered
- PRD Alignment: ✓ — All 9 PRD ACs covered (stories expand to 13 ACs)
- Story Structure: ✓ — All sections complete

### Security Review

- No direct security concerns for this story (frontend-only, API handles auth/validation)
- Double-submit prevention: ✓ — AC10 disables input during loading

### Performance Considerations

- Auto-scroll: ✓ — `scrollIntoView({ behavior: 'smooth' })` appropriate
- Auto-resize textarea: ✓ — Max height capped at 200px
- Streaming: ✓ — Word-by-word rendering via DataStream protocol

### Gate Status

Gate: **PASS** → `docs/qa/gates/3.3-interface-chat-socratico.yml`
Quality Score: **90/100** (2 MEDIUM = -10)

### Recommended Status

✓ Ready for Development — No blocking findings. M1 requires @architect decision on component location (non-blocking for dev start). M2 is documentation alignment.

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
