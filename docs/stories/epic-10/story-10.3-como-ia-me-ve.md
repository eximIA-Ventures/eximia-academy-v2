# Story 10.3: "Como a IA me vê" — Visualization

**Epic:** [Epic 10 — Progressive AI Profiling](../../epics/epic-10-progressive-ai-profiling.md)
**Version:** 1.1
**Created:** 2026-02-10
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 5
**Priority:** P1 (UI — pode ser desenvolvida com dados mock, integrada apos Story 10.2)
**Blocked By:** Story 10.1 (schema), Story 10.2 (data population)
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student,
**I want** to see how the AI perceives my learning profile based on our conversations,
**so that** I gain self-awareness about my learning patterns and see how the system adapts to me.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `apps/web/src/components/profile/ai-profile-card.tsx` (Epic 9 — perfil IA baseado em assessments), `apps/web/src/components/profile/ai-profile-placeholder.tsx` (placeholder nao usado no hub), `apps/web/src/components/profile/self-knowledge-hub.tsx` (container, `"use client"`) |
| **Epic Ref** | `docs/epics/epic-10-progressive-ai-profiling.md` v1.1 — Story 10.3 |
| **Story 9.3 Ref** | `docs/stories/epic-9/story-9.3-hub-autoconhecimento.md` — AC9, Task 10 |
| **Stack** | Next.js 15 (App Router) + Tailwind CSS 4 + `@eximia/ui` (Card, Badge, Button) |
| **DB Tables** | `users` (profile JSONB — campo `ai_learning_profile`) |
| **Type** | `AILearningProfile` de `@eximia/shared` (Story 10.1) |
| **Components** | `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Button` from `@eximia/ui` |
| **CRITICAL** | `getAuthProfile()` NAO seleciona `users.profile`. Pagina `/perfil` ja faz query separada (Story 9.3 pattern). |
| **CRITICAL** | `self-knowledge-hub.tsx` e `"use client"`. Componentes novos serao renderizados dentro de arvore client — devem ser client-compatible. |
| **CRITICAL** | Hub usa `<AiProfileCard />` (linha 245) — perfil IA baseado em **assessments** (Big Five, etc.). Este componente COEXISTE com o novo `AIProfileSection` (perfil baseado em **sessoes socraticas**). Sao complementares, NAO substitutos. |
| **IMPORTANT** | NAO usar recharts — dados sao categoricos (cards, badges, listas), nao numericos. Manter UI simples. |
| **IMPORTANT** | `<LearningRecommendations />` (hub linha 246) permanece inalterado — e baseado em assessments, nao sessoes. |

---

## Acceptance Criteria

- [x] **AC1:** Adicionar novo componente `AIProfileSection` ao hub de autoconhecimento que exibe dados de `users.profile.ai_learning_profile` (perfil baseado em sessoes socraticas). Coexiste com `AiProfileCard` existente (perfil baseado em assessments).

- [x] **AC2:** Se `ai_learning_profile` estiver vazio/null, manter mensagem placeholder: "Conforme voce interage com o tutor, seu perfil de aprendizado sera construido automaticamente. Complete pelo menos 2 sessoes socraticas para comecar."

- [x] **AC3:** Se `ai_learning_profile` existir, exibir:
  - **Summary** — texto de 2-3 frases descrevendo o perfil (campo `summary`)
  - **Estilo de Aprendizado** — cards visuais para `engagement_style`, `detail_orientation`, `reasoning_style`
  - **Pontos Fortes** — lista com icones (campo `strengths`, max 5)
  - **Areas de Crescimento** — lista com icones (campo `growth_areas`, max 3)
  - **Confianca do Perfil** — indicador visual de 0-100% (campo `confidence`)
  - **Sessoes Analisadas** — contador (campo `sessions_analyzed`)

- [x] **AC4:** Indicador de confianca com labels:
  - < 0.3 = "Conhecendo voce..."
  - 0.3–0.6 = "Perfil em formacao"
  - 0.6–0.8 = "Perfil consistente"
  - \> 0.8 = "Perfil consolidado"

- [x] **AC5:** Data de ultima atualizacao exibida (campo `last_updated`, formatada como "Atualizado em DD/MM/YYYY")

- [x] **AC6:** Componentes usam `@eximia/ui` (Card, Badge) + Tailwind theme tokens — zero hardcoded hex/rgba

- [x] **AC7:** Responsivo (mobile-friendly) — cards empilham em telas menores

- [x] **AC8:** Disclaimer visivel: "Este perfil e baseado em suas interacoes com o tutor e evolui continuamente. Ele nao define suas capacidades — e uma ferramenta de autoconhecimento."

- [x] **AC9:** Dados carregados via RSC parent (pagina `/perfil`) e passados como props para `SelfKnowledgeHub` (`"use client"`) que repassa para `AIProfileSection`. Reutiliza query existente (Story 9.3 pattern). Novos componentes sao client-compatible.

- [x] **AC10:** Testes: componente renderiza com dados mock, renderiza placeholder quando vazio, labels de confianca corretos

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 2) Criar componente `AILearningPlaceholder` para estado vazio do perfil de sessoes
  - [ ] Criar `apps/web/src/components/profile/ai-learning-placeholder.tsx`
  - [ ] Mensagem para estado sem dados de sessoes:
    ```
    "Conforme voce interage com o tutor, seu perfil de aprendizado sera
    construido automaticamente. Complete pelo menos 2 sessoes socraticas
    para comecar."
    ```
  - [ ] Icone: `Brain` de lucide-react (diferencia de `AiProfileCard` que usa `Sparkles`)
  - [ ] Visual sutil: Card com borda dashed, bg muted
  - [ ] **NOTE:** `ai-profile-placeholder.tsx` (existente) NAO e usado pelo hub — pode ser mantido como esta. Este e um componente NOVO separado.

- [ ] **Task 2** (AC: 1, 3, 4, 5) Criar componente `AIProfileSection`
  - [ ] Criar `apps/web/src/components/profile/ai-profile-section.tsx`
  - [ ] Props: `profile: AILearningProfile | null`
  - [ ] Se `profile === null` → renderizar `<AILearningPlaceholder />` (Task 1)
  - [ ] Se `profile` presente → renderizar secoes:
    ```tsx
    <div className="space-y-6">
      <ProfileSummaryCard
        summary={profile.summary}
        confidence={profile.confidence}
        sessionsAnalyzed={profile.sessions_analyzed}
        lastUpdated={profile.last_updated}
      />
      <LearningStyleCards
        engagementStyle={profile.engagement_style}
        detailOrientation={profile.detail_orientation}
        reasoningStyle={profile.reasoning_style}
      />
      <StrengthsAndGrowth
        strengths={profile.strengths}
        growthAreas={profile.growth_areas}
      />
      <ProfileDisclaimer />
    </div>
    ```

- [ ] **Task 3** (AC: 3, 4, 5) Criar componente `ProfileSummaryCard`
  - [ ] Criar `apps/web/src/components/profile/profile-summary-card.tsx`
  - [ ] Exibir `summary` em texto livre
  - [ ] `ConfidenceIndicator`:
    ```typescript
    function getConfidenceLabel(confidence: number) {
      if (confidence < 0.3) return { label: 'Conhecendo voce...', variant: 'secondary' }
      if (confidence < 0.6) return { label: 'Perfil em formacao', variant: 'outline' }
      if (confidence < 0.8) return { label: 'Perfil consistente', variant: 'default' }
      return { label: 'Perfil consolidado', variant: 'default' }
    }
    ```
  - [ ] Progress bar visual: `<div className="h-2 rounded-full bg-bg-card"><div style={{ width: percent% }} className="h-full rounded-full bg-accent-blue-mid" /></div>`
  - [ ] Sessoes analisadas: "Baseado em {n} sessao(oes)"
  - [ ] Ultima atualizacao: formatada com `toLocaleDateString('pt-BR')`
  - [ ] Usar `Card` + `CardContent` de `@eximia/ui`

- [ ] **Task 4** (AC: 3) Criar componente `LearningStyleCards`
  - [ ] Criar `apps/web/src/components/profile/learning-style-cards.tsx`
  - [ ] Grid 3 colunas (desktop) / 1 coluna (mobile)
  - [ ] Cada card mostra:
    - Titulo (ex: "Estilo de Engajamento")
    - Valor traduzido para PT-BR
    - Icone relevante (lucide-react)
  - [ ] Traducoes:
    ```typescript
    const STYLE_LABELS = {
      engagement_style: {
        title: 'Engajamento',
        reflective: 'Reflexivo',
        impulsive: 'Impulsivo',
        balanced: 'Equilibrado',
      },
      detail_orientation: {
        title: 'Detalhamento',
        verbose: 'Detalhista',
        concise: 'Objetivo',
        balanced: 'Equilibrado',
      },
      reasoning_style: {
        title: 'Raciocinio',
        analytical: 'Analitico',
        creative: 'Criativo',
        systematic: 'Sistematico',
        intuitive: 'Intuitivo',
      },
    }
    ```
  - [ ] Usar `Card` + `CardContent` de `@eximia/ui` para cada card

- [ ] **Task 5** (AC: 3) Criar componente `StrengthsAndGrowth`
  - [ ] Criar `apps/web/src/components/profile/strengths-and-growth.tsx`
  - [ ] Dois blocos lado a lado (desktop) / empilhados (mobile)
  - [ ] **Pontos Fortes:** lista com icone `CheckCircle` (lucide-react) verde
  - [ ] **Areas de Crescimento:** lista com icone `TrendingUp` (lucide-react) amarelo
  - [ ] Cada item e uma string PT-BR do Profiler output
  - [ ] Usar `Card` para conter cada bloco

- [ ] **Task 6** (AC: 8) Criar componente `ProfileDisclaimer`
  - [ ] Criar `apps/web/src/components/profile/profile-disclaimer.tsx`
  - [ ] Texto: "Este perfil e baseado em suas interacoes com o tutor e evolui continuamente. Ele nao define suas capacidades — e uma ferramenta de autoconhecimento."
  - [ ] Visual sutil: texto muted, font-size small, com icone `Info` (lucide-react)

- [ ] **Task 7** (AC: 1) Integrar `AIProfileSection` no hub de autoconhecimento
  - [ ] Abrir `apps/web/src/components/profile/self-knowledge-hub.tsx`
  - [ ] Importar `AIProfileSection` do novo componente
  - [ ] Adicionar `<AIProfileSection />` **ANTES** de `<AiProfileCard />` (linha 245):
    ```tsx
    {/* AI Learning Profile — sessoes socraticas (Epic 10) */}
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
        Como a IA me vê
      </h3>
      <AIProfileSection profile={currentProfile.ai_learning_profile as AILearningProfile | null} />
    </section>

    {/* AI Profile — assessments (Epic 9, existente) */}
    <AiProfileCard profile={currentProfile} />
    <LearningRecommendations profile={currentProfile} />
    ```
  - [ ] **IMPORTANTE:** `AiProfileCard` e `LearningRecommendations` permanecem — sao baseados em assessments (Big Five, etc.), complementares ao perfil de sessoes
  - [ ] Separador visual: section header "Como a IA me vê" com icone `Brain` de lucide-react

- [ ] **Task 8** (AC: 7) Garantir responsividade
  - [ ] `LearningStyleCards`: `grid grid-cols-1 md:grid-cols-3 gap-4`
  - [ ] `StrengthsAndGrowth`: `grid grid-cols-1 md:grid-cols-2 gap-4`
  - [ ] `ProfileSummaryCard`: full-width em todas as telas
  - [ ] Testar em viewports: 375px (mobile), 768px (tablet), 1024px+ (desktop)

- [ ] **Task 9** (AC: 10) Testes
  - [ ] Criar `apps/web/src/components/profile/__tests__/ai-profile-section.test.tsx`
  - [ ] Test: `AIProfileSection` renderiza `AILearningPlaceholder` quando `profile === null`
  - [ ] Test: `AIProfileSection` renderiza summary quando profile presente
  - [ ] Test: `ConfidenceIndicator` mostra "Conhecendo voce..." para confidence 0.1
  - [ ] Test: `ConfidenceIndicator` mostra "Perfil em formacao" para confidence 0.4
  - [ ] Test: `ConfidenceIndicator` mostra "Perfil consistente" para confidence 0.7
  - [ ] Test: `ConfidenceIndicator` mostra "Perfil consolidado" para confidence 0.9
  - [ ] Test: `LearningStyleCards` traduz estilos para PT-BR
  - [ ] Test: `StrengthsAndGrowth` renderiza strengths e growth_areas
  - [ ] Test: `ProfileDisclaimer` renderiza texto de disclaimer
  - [ ] Test: Componentes usam classes Tailwind (nao hex hardcoded)

---

## Dev Notes

### Profile Data Flow [Source: Story 9.3 — apps/web/src/app/(platform)/perfil/page.tsx]

```typescript
// Profile page already loads users.profile JSONB via dedicated query (Story 9.3)
// The ai_learning_profile field will be available in this data
// No additional query needed — just pass the nested field to AIProfileSection

// In perfil/page.tsx (already implemented by Story 9.3):
const { data: profileData } = await supabase
  .from('users')
  .select('profile, full_name, email, role, avatar_url, onboarding_completed')
  .eq('id', user.id)
  .single()

// Pass to SelfKnowledgeHub which passes to AIProfileSection:
<SelfKnowledgeHub profile={profileData.profile} userId={user.id} />

// In SelfKnowledgeHub ("use client"), extract ai_learning_profile:
// SelfKnowledgeHub recebe profile: Record<string, unknown> via props
const aiLearningProfile = currentProfile.ai_learning_profile as AILearningProfile | null
<AIProfileSection profile={aiLearningProfile} />
// NOTE: SelfKnowledgeHub e "use client" — AIProfileSection sera renderizado
// dentro de arvore client. Componentes novos devem ser client-compatible.
```

### Componentes Existentes no Hub [Source: self-knowledge-hub.tsx]

```typescript
// IMPORTANTE: Entender a arquitetura ANTES de modificar

// 1. AiProfileCard (ai-profile-card.tsx) — EXISTENTE, linha 245 do hub
//    - Perfil IA baseado em ASSESSMENTS (Big Five, Enneagram, etc.)
//    - Usa /api/profile/generate para gerar perfil integrado
//    - Usa ai_profile do JSONB (summary, strengths, learning_style, collaboration_style)
//    - PERMANECE no hub — complementar ao perfil de sessoes

// 2. AiProfilePlaceholder (ai-profile-placeholder.tsx) — EXISTENTE, NAO usado no hub
//    - Card simples com mensagem estatica
//    - NAO e importado por self-knowledge-hub.tsx
//    - Pode ser mantido ou removido — nao afeta nada

// 3. LearningRecommendations (learning-recommendations.tsx) — EXISTENTE, linha 246
//    - Recomendacoes baseadas em assessments
//    - PERMANECE inalterado

// 4. AIProfileSection (ai-profile-section.tsx) — NOVO (Epic 10)
//    - Perfil de aprendizado baseado em SESSOES SOCRATICAS
//    - Usa ai_learning_profile do JSONB (engagement_style, strengths, confidence, etc.)
//    - Posicionado ANTES de AiProfileCard no hub

// Ordem no hub (apos Epic 10):
//   [Assessments] → [Como a IA me vê (sessoes)] → [Perfil IA (assessments)] → [Recomendacoes]
```

### Design System Components [Source: docs/design-system-guide.md]

```tsx
// Available from @eximia/ui:
import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { Badge } from "@eximia/ui"
import { Button } from "@eximia/ui"

// Tailwind theme tokens (NO hardcoded colors):
// bg-bg-card, bg-bg-surface, text-text-primary, text-text-secondary, text-text-muted
// border-border-default, rounded-md, rounded-lg
// CSS vars: var(--color-accent-blue-mid), var(--color-accent-green-mid)
```

### AILearningProfile Type [Source: Story 10.1 — packages/shared/src/types/models.ts]

```typescript
// Imported from @eximia/shared
import type { AILearningProfile } from "@eximia/shared"

// Key fields for UI:
// summary: string — 2-3 sentence description
// confidence: number — 0-1 (controls confidence indicator)
// sessions_analyzed: number — counter
// last_updated: string — ISO 8601 (format with toLocaleDateString)
// engagement_style, detail_orientation, reasoning_style — enum strings
// strengths: string[] — max 5 PT-BR items
// growth_areas: string[] — max 3 PT-BR items
```

### Date Formatting

```typescript
// Format last_updated for PT-BR display:
const formattedDate = new Date(profile.last_updated).toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
// Output: "10/02/2026"
```

### File Locations

```
apps/web/src/components/profile/
├── ai-profile-section.tsx          # NEW: Main component — sessoes socraticas (Task 2)
├── ai-learning-placeholder.tsx     # NEW: Placeholder estado vazio sessoes (Task 1)
├── profile-summary-card.tsx        # NEW: Summary + confidence (Task 3)
├── learning-style-cards.tsx        # NEW: 3-column style cards (Task 4)
├── strengths-and-growth.tsx        # NEW: Strengths + growth lists (Task 5)
├── profile-disclaimer.tsx          # NEW: Disclaimer text (Task 6)
├── ai-profile-card.tsx             # UNCHANGED: Perfil IA baseado em assessments (Epic 9)
├── ai-profile-placeholder.tsx      # UNCHANGED: Nao usado pelo hub (Epic 9)
├── learning-recommendations.tsx    # UNCHANGED: Recomendacoes baseadas em assessments (Epic 9)
├── self-knowledge-hub.tsx          # UPDATED: Adiciona AIProfileSection ANTES de AiProfileCard (Task 7)
└── __tests__/
    └── ai-profile-section.test.tsx # NEW: Component tests (Task 9)
```

### Testing

- **Test location:** `apps/web/src/components/profile/__tests__/ai-profile-section.test.tsx`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock AILearningProfile data, render components, assert text/structure
- **Key concern:** Placeholder vs data state, confidence labels, PT-BR translations, responsive grid classes

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Componentes renderizam sem erro. Usa `@eximia/ui` components. Zero hardcoded colors. | Yes |
| Pre-PR | Placeholder exibido quando sem dados. Dados reais exibidos corretamente com todas as secoes. Confidence labels corretos nos 4 ranges. Responsivo (mobile/desktop). Disclaimer visivel. Theme tokens usados. Testes passam. | Yes |

---

## Definition of Done

- [ ] `AIProfileSection` renderiza `AILearningPlaceholder` quando sem dados
- [ ] `AIProfileSection` renderiza dados completos quando ai_learning_profile presente
- [ ] `AiProfileCard` e `LearningRecommendations` permanecem funcionais (coexistencia)
- [ ] Confidence indicator com 4 labels corretos
- [ ] Estilos de aprendizado traduzidos para PT-BR
- [ ] Pontos fortes e areas de crescimento exibidos com icones
- [ ] Disclaimer visivel
- [ ] Integrado no hub de autoconhecimento ANTES de `AiProfileCard` (self-knowledge-hub.tsx)
- [ ] Responsivo (mobile/tablet/desktop)
- [ ] Zero hardcoded colors (theme tokens only)
- [ ] Componentes `@eximia/ui` usados
- [ ] Testes passam
- [ ] `pnpm lint && pnpm typecheck` passam

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao de todos os componentes, integracao com hub, testes |
| **@ux-design-expert** | Layout dos cards, hierarquia visual, confidence indicator design, responsividade |
| **@qa (Quinn)** | Validacao: placeholder vs dados, confidence labels, PT-BR, responsividade, theme tokens |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| ai_learning_profile vazio para todos os alunos na primeira release | LOW | Placeholder claro com instrucao de "complete 2 sessoes". UX nao quebra. |
| Dados do Profiler em formato inesperado | MEDIUM | `AILearningProfile` tipado + Zod validation no Profiler (Story 10.1). Componentes usam optional chaining. |
| Hub de autoconhecimento (Story 9.3) nao implementado ainda | MEDIUM | Story 10.3 pode ser desenvolvida com dados mock. Integracao final quando 9.3 estiver pronta. Se 9.3 nao existir, criar componentes standalone e integrar depois. |
| Confusao entre AiProfileCard (assessments) e AIProfileSection (sessoes) | MEDIUM | Nomes distintos + section headers claros no hub. AiProfileCard permanece inalterado. Dev Notes explicam a diferenca. |
| Confidence indicator confuso para o aluno | LOW | Labels claros ("Conhecendo voce...", "Perfil consolidado"). Tooltip explicativo se necessario. |

---

## QA Results

### Review Date: 2026-02-11

### Reviewed By: Quinn (Test Architect)

**Scope:** Commits `31b2146`, `eb8a77e`

**Findings:**
- All 10 acceptance criteria validated and PASS
- 6 components with clean single-responsibility decomposition
- 11 tests passing (placeholder, summary, confidence labels x4, styles, strengths, disclaimer, sessions, date)
- Design system compliance: `@eximia/ui` components, theme tokens, zero hardcoded colors
- PT-BR translations verified (STYLE_LABELS maps)
- Responsive layout confirmed (grid-cols-1/3, grid-cols-1/2)
- Ethical disclaimer present per AC8
- Coexistence with AiProfileCard (assessments) confirmed — no disruption

**Issues:** None

### Gate Status

Gate: PASS → docs/qa/gates/10.3-como-ia-me-ve.yml

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story created from Epic 10 v1.1 (QA reviewed). Includes AIProfileSection, placeholder update, summary card, learning style cards, strengths/growth, disclaimer, hub integration, responsiveness, and tests. | River (SM) |
| 2026-02-10 | 1.1 | QA fixes (REWORK): H-1/H-2/H-3 wrong component refs — hub uses `AiProfileCard` not `AIProfilePlaceholder`; AIProfileSection COEXISTS with AiProfileCard (sessions vs assessments); Task 7 rewritten for correct hub integration. M-6 `"use client"` compatibility noted. M-7 LearningRecommendations stays unchanged. New placeholder renamed to `ai-learning-placeholder.tsx`. File locations updated. | Quinn (QA) |

---

*Story criada por River (Scrum Master) — exímIA Academy*
