# Story 9.3: Hub de Autoconhecimento (Tab no Perfil)

**Epic:** [Epic 9 — Onboarding Inteligente & Personalização Adaptativa](../../epics/epic-9-onboarding-inteligente-personalizacao.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 8
**Priority:** P1
**Blocked By:** —
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student/collaborator,
**I want** acessar testes de personalidade e autoconhecimento quando eu quiser,
**so that** eu descubra meu perfil de aprendizado de forma voluntária e no meu ritmo.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `apps/web/src/lib/auth.ts` (getAuthProfile — NÃO seleciona profile JSONB), `apps/web/src/lib/navigation.ts` (sidebar items) |
| **Epic Ref** | `docs/epics/epic-9-onboarding-inteligente-personalizacao.md` v1.2 — Story 9.3 |
| **PRD Ref** | `docs/prd.md` — FR20 (extensão) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui + recharts v3.7.0 |
| **DB Tables** | `users` (profile JSONB — campos `big_five`, `enneagram`, `{type}_progress`) |
| **Mutation** | Server Action `saveAssessmentResult()` + `saveAssessmentProgress()` — NOT API route |
| **Components** | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Card`, `Badge`, `Avatar`, `Button` from `@eximia/ui` |
| **Charts** | `recharts` v3.7.0 (já instalado) — `RadarChart` para Big Five |
| **CRITICAL** | `getAuthProfile()` NÃO seleciona `users.profile`. Página `/perfil` precisa de query separada. |
| **IMPORTANT** | Questionário Eneagrama: usar Essential Enneagram Test (Daniels & Price) — NÃO RHETI (proprietário) |

---

## Acceptance Criteria

- [ ] **AC1:** Nova rota `/(platform)/perfil` acessível pelo sidebar (item "Meu Perfil")

- [ ] **AC2:** Página com sistema de tabs (`@eximia/ui` Tabs): "Meus Dados" e "Autoconhecimento"

- [ ] **AC3:** Tab "Meus Dados": exibe nome, email, role, avatar, status do onboarding (readonly, editável em versão futura)

- [ ] **AC4:** Tab "Autoconhecimento" com cards para cada teste disponível:
  - Big Five (OCEAN) — questionário de 20 perguntas (IPIP-NEO-20)
  - Eneagrama — questionário de 9 parágrafos (Essential Enneagram Test, Daniels & Price)
  - (Extensível para futuros testes)

- [ ] **AC5:** Cada card mostra: nome do teste, descrição curta, tempo estimado, status (não iniciado / em progresso / completo), botão "Iniciar" ou "Ver Resultado"

- [ ] **AC6:** Questionários renderizados inline (sem redirect externo), com progresso salvo em `users.profile` JSONB como `{type}_progress: { answers: Record<number, number>, completed: false }`. Progresso salvo via Server Action ao sair da página ou a cada 5 respostas (debounced). Ao retornar, questionário retoma de onde parou.

- [ ] **AC7:** Resultados finais salvos em `users.profile` JSONB (campos `big_five`, `enneagram`). Campo `{type}_progress` removido após conclusão.

- [ ] **AC8:** Visualização de resultados: gráfico radar para Big Five, tipo + descrição para Eneagrama

- [ ] **AC9:** Seção "Como a IA me vê" — placeholder com mensagem: "Conforme você interage com o tutor, seu perfil de aprendizado será construído automaticamente" (Epic 10)

- [ ] **AC10:** Dados salvos via Server Action com Zod validation

- [ ] **AC11:** Sidebar atualizada com item "Meu Perfil" (ícone User, acessível para **todos os roles**)

- [ ] **AC12:** Responsivo (mobile-friendly)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 11) Atualizar sidebar com item "Meu Perfil"
  - [ ] Abrir `apps/web/src/lib/navigation.ts`
  - [ ] Adicionar item `{ label: "Meu Perfil", href: "/perfil", icon: User }` para **todos os roles** (student, teacher, manager, admin)
  - [ ] Importar `User` de `lucide-react`
  - [ ] Posicionar na seção `bottomNav` (ou após os items principais)

- [ ] **Task 2** (AC: 1, 2) Criar página `/perfil` com tabs
  - [ ] Criar `apps/web/src/app/(platform)/perfil/page.tsx` (RSC)
  - [ ] **CRITICAL:** `getAuthProfile()` NÃO retorna `users.profile` JSONB. Fazer query separada:
    ```typescript
    const { data: profileData } = await supabase
      .from('users')
      .select('profile, full_name, email, role, avatar_url, onboarding_completed')
      .eq('id', user.id)
      .single()
    ```
  - [ ] Implementar tabs usando `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` de `@eximia/ui`
  - [ ] Duas tabs: "Meus Dados" (default) e "Autoconhecimento"
  - [ ] Passar profile data aos componentes filhos

- [ ] **Task 3** (AC: 3) Criar componente `ProfileDataSection`
  - [ ] Criar `apps/web/src/components/profile/profile-data-section.tsx`
  - [ ] Exibir: Avatar (componente `Avatar` de `@eximia/ui`), nome, email, role, status onboarding
  - [ ] Todos os campos readonly nesta versão
  - [ ] Layout responsivo com `Card` + `CardContent`

- [ ] **Task 4** (AC: 4, 5, 9) Criar componente `SelfKnowledgeHub`
  - [ ] Criar `apps/web/src/components/profile/self-knowledge-hub.tsx` (`'use client'`)
  - [ ] Grid de cards para cada teste disponível
  - [ ] Cada card mostra: nome, descrição, tempo estimado, status, botão de ação
  - [ ] Status derivado de `profile.big_five` (completo), `profile.big_five_progress` (em progresso), ou ausente (não iniciado)
  - [ ] Botão: "Iniciar" (não iniciado/em progresso) ou "Ver Resultado" (completo)
  - [ ] Seção "Como a IA me vê" no final com placeholder (AC9)
  - [ ] Usar componentes: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge`, `Button`

- [ ] **Task 5** (AC: 4, 5) Criar componente `AssessmentCard`
  - [ ] Criar `apps/web/src/components/profile/assessment-card.tsx`
  - [ ] Props: `title`, `description`, `estimatedTime`, `status: 'not_started' | 'in_progress' | 'completed'`, `onStart`, `onViewResult`
  - [ ] Badge de status com variantes: default (não iniciado), warning (em progresso), success (completo)
  - [ ] Usar `Card` + `CardContent` + `Badge` + `Button` de `@eximia/ui`

- [ ] **Task 6** (AC: 4, 6, 7) Criar questionário Big Five (IPIP-NEO-20)
  - [ ] Criar `apps/web/src/components/profile/big-five-questionnaire.tsx` (`'use client'`)
  - [ ] 20 itens do IPIP-NEO-20 (4 por dimensão: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
  - [ ] Cada item: escala Likert 1-5 (Discordo totalmente → Concordo totalmente)
  - [ ] Itens reversos marcados e scoring invertido
  - [ ] Progress bar mostrando quantidade respondida
  - [ ] **Progresso:** Salvar via Server Action `saveAssessmentProgress()` a cada 5 respostas (debounced) ou ao sair da página (beforeunload)
  - [ ] **Retomada:** Ao carregar, checar `profile.big_five_progress` e retomar de onde parou
  - [ ] **Scoring:** Média por dimensão (1-5). Ao completar todos os 20 itens, calcular scores finais
  - [ ] Ao completar: chamar `saveAssessmentResult()` com resultado final, limpar `big_five_progress`

- [ ] **Task 7** (AC: 4, 6, 7) Criar questionário Eneagrama (Essential Enneagram Test)
  - [ ] Criar `apps/web/src/components/profile/enneagram-questionnaire.tsx` (`'use client'`)
  - [ ] **NÃO usar RHETI** (proprietário do Enneagram Institute)
  - [ ] Formato Essential Enneagram Test (Daniels & Price): 9 parágrafos descritivos, um por tipo
  - [ ] Cada parágrafo descreve um tipo sem nomeá-lo (ex: "Eu sou uma pessoa que valoriza...")
  - [ ] Usuário ordena os 9 parágrafos por grau de identificação (ranking drag-and-drop ou numbered selection)
  - [ ] Tipo principal = parágrafo #1. Wing = tipo adjacente mais alto no ranking.
  - [ ] **Progresso:** Salvar ranking parcial em `profile.enneagram_progress`
  - [ ] Ao completar: calcular tipo + wing, chamar `saveAssessmentResult()`, limpar `enneagram_progress`

- [ ] **Task 8** (AC: 8) Criar componente de resultados Big Five
  - [ ] Criar `apps/web/src/components/profile/big-five-results.tsx`
  - [ ] Gráfico radar usando `recharts` `RadarChart` com as 5 dimensões
  - [ ] Escala 1-5 nos eixos
  - [ ] Labels em português: Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo
  - [ ] Descrição textual de cada dimensão com score
  - [ ] Usar tokens de tema (cores de acento para o chart)

- [ ] **Task 9** (AC: 8) Criar componente de resultados Eneagrama
  - [ ] Criar `apps/web/src/components/profile/enneagram-results.tsx`
  - [ ] Exibir: Tipo principal (número + nome + descrição), Wing (se aplicável)
  - [ ] Nomes dos 9 tipos em português (Perfeccionista, Prestativo, Realizador, Individualista, Investigador, Leal, Entusiasta, Desafiador, Pacificador)
  - [ ] Descrição resumida do tipo (2-3 frases)
  - [ ] Usar `Card` para conter o resultado

- [ ] **Task 10** (AC: 9) Criar placeholder "Como a IA me vê"
  - [ ] Criar `apps/web/src/components/profile/ai-profile-placeholder.tsx`
  - [ ] Mensagem: "Conforme você interage com o tutor, seu perfil de aprendizado será construído automaticamente"
  - [ ] Ícone sugestivo (Brain ou Sparkles de lucide-react)
  - [ ] Visual sutil, informativo (não call-to-action)

- [ ] **Task 11** (AC: 10) Criar Server Actions para assessments
  - [ ] Criar `apps/web/src/app/(platform)/perfil/actions.ts`
  - [ ] `saveAssessmentResult(payload)` — salva resultado final em `users.profile`
  - [ ] `saveAssessmentProgress(payload)` — salva progresso parcial em `users.profile`
  - [ ] `getProfileData()` — retorna profile JSONB (para RSC)
  - [ ] **Zod schemas:**
    ```typescript
    const assessmentResultSchema = z.object({
      type: z.enum(['big_five', 'enneagram']),
      result: z.union([
        z.object({ // Big Five
          openness: z.number().min(1).max(5),
          conscientiousness: z.number().min(1).max(5),
          extraversion: z.number().min(1).max(5),
          agreeableness: z.number().min(1).max(5),
          neuroticism: z.number().min(1).max(5),
        }),
        z.object({ // Enneagram
          type: z.number().min(1).max(9),
          wing: z.number().min(1).max(9).optional(),
          scores: z.array(z.number()).length(9),
        }),
      ]),
    })

    const assessmentProgressSchema = z.object({
      type: z.enum(['big_five', 'enneagram']),
      progress: z.object({
        answers: z.record(z.string(), z.number()),
        completed: z.literal(false),
      }),
    })
    ```
  - [ ] **Persistência:** Merge no JSONB existente (não sobrescrever campos não relacionados)
    ```typescript
    // Merge pattern:
    const { data: current } = await supabase.from('users').select('profile').eq('id', user.id).single()
    const mergedProfile = { ...current.profile, [field]: value }
    await supabase.from('users').update({ profile: mergedProfile }).eq('id', user.id)
    ```
  - [ ] **Cleanup após conclusão:** Remover campo `{type}_progress` do JSONB quando resultado final é salvo

- [ ] **Task 12** (AC: 12) Garantir responsividade
  - [ ] Tabs em modo mobile: tabs com scroll horizontal ou stack vertical
  - [ ] Cards de assessment: 1 coluna em mobile, 2 colunas em desktop
  - [ ] Questionários: perguntas full-width em mobile
  - [ ] Gráfico radar: ajustar tamanho para mobile (min 250px)
  - [ ] Testar em viewports: 375px (mobile), 768px (tablet), 1024px+ (desktop)

- [ ] **Task 13** Testes
  - [ ] Test: Página `/perfil` renderiza com tabs
  - [ ] Test: Tab "Meus Dados" exibe nome, email, role, avatar
  - [ ] Test: Tab "Autoconhecimento" exibe cards de testes
  - [ ] Test: Card status: "não iniciado" quando sem dados
  - [ ] Test: Card status: "em progresso" quando tem `{type}_progress`
  - [ ] Test: Card status: "completo" quando tem resultado final
  - [ ] Test: Big Five scoring calcula médias corretamente
  - [ ] Test: Big Five itens reversos invertidos corretamente
  - [ ] Test: Eneagrama identifica tipo (parágrafo #1) e wing (adjacente mais alto)
  - [ ] Test: Progresso salvo no JSONB (debounced)
  - [ ] Test: Resultado final remove `{type}_progress`
  - [ ] Test: Gráfico radar renderiza com 5 dimensões
  - [ ] Test: Placeholder "Como a IA me vê" renderiza
  - [ ] Test: Sidebar mostra "Meu Perfil" para todos os roles
  - [ ] Test: Zod rejeita dados inválidos em assessments
  - [ ] Test: Responsivo (mobile/desktop)

---

## Dev Notes

### Profile Data Access Pattern (M-2 FIX) [Source: epic-9 v1.2, Story 9.3 Technical Notes]

```typescript
// CRITICAL: getAuthProfile() in apps/web/src/lib/auth.ts does NOT select users.profile
// Current select: "full_name, role, tenant_id, onboarding_completed, tenants(...)"
// DO NOT modify getAuthProfile() — it's shared and adding profile JSONB impacts performance

// Instead, use dedicated query in RSC:
// apps/web/src/app/(platform)/perfil/page.tsx
import { createClient } from "@/lib/supabase/server"
import { getAuthProfile } from "@/lib/auth"

export default async function ProfilePage() {
  const { user, profile: authProfile } = await getAuthProfile()
  if (!user || !authProfile) redirect('/login')

  const supabase = await createClient()
  const { data: profileData } = await supabase
    .from('users')
    .select('profile, full_name, email, role, avatar_url, onboarding_completed')
    .eq('id', user.id)
    .single()

  return (
    <Tabs defaultValue="dados">
      <TabsList>
        <TabsTrigger value="dados">Meus Dados</TabsTrigger>
        <TabsTrigger value="autoconhecimento">Autoconhecimento</TabsTrigger>
      </TabsList>
      <TabsContent value="dados">
        <ProfileDataSection data={profileData} />
      </TabsContent>
      <TabsContent value="autoconhecimento">
        <SelfKnowledgeHub profile={profileData.profile} userId={user.id} />
      </TabsContent>
    </Tabs>
  )
}
```

### Big Five IPIP-NEO-20 Items [Source: IPIP — International Personality Item Pool, public domain]

```typescript
// 20 items, 4 per dimension
// Format: { id, text, dimension, reversed }
// Scale: 1 = Discordo totalmente, 5 = Concordo totalmente
// Reversed items: subtract from 6 (e.g., answer 2 → score 4)

const IPIP_NEO_20_ITEMS = [
  // Extraversion
  { id: 1, text: "Sou a alma da festa", dimension: "extraversion", reversed: false },
  { id: 2, text: "Não falo muito", dimension: "extraversion", reversed: true },
  { id: 3, text: "Me sinto confortável perto de pessoas", dimension: "extraversion", reversed: false },
  { id: 4, text: "Fico em segundo plano", dimension: "extraversion", reversed: true },
  // Agreeableness
  { id: 5, text: "Me interesso pelos problemas dos outros", dimension: "agreeableness", reversed: false },
  { id: 6, text: "Me interesso pouco pelos outros", dimension: "agreeableness", reversed: true },
  { id: 7, text: "Tenho um coração mole", dimension: "agreeableness", reversed: false },
  { id: 8, text: "Não me interesso muito pelos outros", dimension: "agreeableness", reversed: true },
  // Conscientiousness
  { id: 9, text: "Estou sempre preparado", dimension: "conscientiousness", reversed: false },
  { id: 10, text: "Deixo minhas coisas largadas", dimension: "conscientiousness", reversed: true },
  { id: 11, text: "Presto atenção nos detalhes", dimension: "conscientiousness", reversed: false },
  { id: 12, text: "Faço bagunça nas coisas", dimension: "conscientiousness", reversed: true },
  // Neuroticism
  { id: 13, text: "Fico estressado facilmente", dimension: "neuroticism", reversed: false },
  { id: 14, text: "Sou relaxado na maior parte do tempo", dimension: "neuroticism", reversed: true },
  { id: 15, text: "Me preocupo com as coisas", dimension: "neuroticism", reversed: false },
  { id: 16, text: "Raramente me sinto triste", dimension: "neuroticism", reversed: true },
  // Openness
  { id: 17, text: "Tenho uma imaginação rica", dimension: "openness", reversed: false },
  { id: 18, text: "Não tenho muita imaginação", dimension: "openness", reversed: true },
  { id: 19, text: "Tenho ideias excelentes", dimension: "openness", reversed: false },
  { id: 20, text: "Não me interesso por ideias abstratas", dimension: "openness", reversed: true },
]

// Scoring: mean per dimension (reversed items: 6 - answer)
function scoreBigFive(answers: Record<number, number>) {
  const dimensions = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
  const result: Record<string, number> = {}

  for (const dim of dimensions) {
    const items = IPIP_NEO_20_ITEMS.filter(i => i.dimension === dim)
    const scores = items.map(item => {
      const answer = answers[item.id]
      return item.reversed ? 6 - answer : answer
    })
    result[dim] = scores.reduce((a, b) => a + b, 0) / scores.length
  }

  return result as BigFiveResult
}
```

### Essential Enneagram Test Format [Source: Daniels & Price, public domain]

```typescript
// 9 paragraphs, one per type. User ranks them by identification.
// Each paragraph describes the type WITHOUT naming it.
// The paragraph ranked #1 = primary type. Wing = adjacent type ranked highest.

const ENNEAGRAM_PARAGRAPHS = [
  {
    typeNumber: 1,
    text: "Valorizo princípios e integridade. Procuro fazer a coisa certa e tenho altos padrões para mim e para os outros. Sou organizado, responsável e busco a excelência em tudo que faço.",
  },
  {
    typeNumber: 2,
    text: "Sou caloroso e atencioso com as pessoas ao meu redor. Gosto de ajudar os outros e me sinto realizado quando percebo que fiz diferença na vida de alguém. Relacionamentos são muito importantes para mim.",
  },
  // ... types 3-9
  // Full 9 paragraphs to be implemented by @dev
]

// Scoring:
function scoreEnneagram(ranking: number[]): EnneagramResult {
  const type = ranking[0]  // #1 ranked paragraph = primary type
  const adjacents = [type === 1 ? 9 : type - 1, type === 9 ? 1 : type + 1]
  const wing = adjacents.reduce((best, adj) =>
    ranking.indexOf(adj) < ranking.indexOf(best) ? adj : best
  )
  return { type, wing, scores: ranking.map((_, i) => 9 - i) }
}
```

### Recharts Radar Chart [Source: recharts docs, apps/web/package.json (v3.7.0)]

```typescript
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'

const data = [
  { subject: 'Abertura', score: result.openness },
  { subject: 'Conscienciosidade', score: result.conscientiousness },
  { subject: 'Extroversão', score: result.extraversion },
  { subject: 'Amabilidade', score: result.agreeableness },
  { subject: 'Neuroticismo', score: result.neuroticism },
]

<ResponsiveContainer width="100%" height={300}>
  <RadarChart data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="subject" />
    <PolarRadiusAxis domain={[1, 5]} />
    <Radar dataKey="score" stroke="var(--color-accent-blue-mid)" fill="var(--color-accent-blue-mid)" fillOpacity={0.3} />
  </RadarChart>
</ResponsiveContainer>
```

### Navigation Update Pattern [Source: apps/web/src/lib/navigation.ts]

```typescript
// Current structure:
export const navigationByRole = {
  student: [...],   // Add "Meu Perfil" item
  teacher: [...],   // Add "Meu Perfil" item
  manager: [...],   // Add "Meu Perfil" item
  admin: [...],     // Add "Meu Perfil" item
}

// OR add to bottomNav (recommended — consistent across all roles):
export const bottomNav = [
  { label: "Meu Perfil", href: "/perfil", icon: User },      // NEW
  { label: "Central de ajuda", href: "/help", icon: HelpCircle },
]
```

### Progress Save Mechanism (M-5 FIX) [Source: epic-9 v1.2]

```typescript
// Debounced save: every 5 answers or on page exit
import { useCallback, useRef, useEffect } from 'react'

function useProgressSave(type: string, userId: string) {
  const answerCount = useRef(0)
  const pendingAnswers = useRef<Record<number, number>>({})

  const saveProgress = useCallback(async () => {
    if (Object.keys(pendingAnswers.current).length === 0) return
    await saveAssessmentProgress({
      type,
      progress: { answers: pendingAnswers.current, completed: false },
    })
  }, [type])

  const recordAnswer = useCallback((questionId: number, value: number) => {
    pendingAnswers.current[questionId] = value
    answerCount.current++
    if (answerCount.current % 5 === 0) {
      saveProgress()
    }
  }, [saveProgress])

  // Save on page exit
  useEffect(() => {
    const handler = () => saveProgress()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveProgress])

  return { recordAnswer, saveProgress }
}
```

### Tabs Component [Source: docs/design-system-guide.md]

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@eximia/ui"

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="dados">Meus Dados</TabsTrigger>
    <TabsTrigger value="autoconhecimento">Autoconhecimento</TabsTrigger>
  </TabsList>
  <TabsContent value="dados">...</TabsContent>
  <TabsContent value="autoconhecimento">...</TabsContent>
</Tabs>
```

### File Locations

```
apps/web/src/app/(platform)/perfil/
├── page.tsx                                # NEW: Profile page (RSC with tabs)
└── actions.ts                              # NEW: Server Actions (assessment save/progress)

apps/web/src/components/profile/
├── profile-data-section.tsx                # NEW: Tab "Meus Dados"
├── self-knowledge-hub.tsx                  # NEW: Tab "Autoconhecimento" (hub container)
├── assessment-card.tsx                     # NEW: Card para cada teste
├── big-five-questionnaire.tsx              # NEW: Questionário IPIP-NEO-20 (20 items)
├── enneagram-questionnaire.tsx             # NEW: Questionário Essential Enneagram Test (9 parágrafos)
├── big-five-results.tsx                    # NEW: Gráfico radar + descrições
├── enneagram-results.tsx                   # NEW: Tipo + wing + descrição
└── ai-profile-placeholder.tsx              # NEW: Placeholder Epic 10

apps/web/src/lib/
└── navigation.ts                           # UPDATED: Add "Meu Perfil" item
```

### Testing

- **Test location:** `apps/web/src/components/profile/__tests__/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock Supabase client, mock recharts (or use snapshot testing for chart)
- **Key concern:** Big Five scoring accuracy (reversed items), Eneagrama ranking + wing calculation, progress persistence, JSONB merge pattern

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam. Tabs renderizam. Questionários exibem perguntas. | Yes |
| Pre-PR | Big Five calcula scores corretos (incluindo reversed items). Eneagrama identifica tipo e wing. Resultados persistem no JSONB. Gráfico radar renderiza. Tab "Meus Dados" exibe info do usuário. Sidebar mostra link para todos os roles. Progresso salva e retoma. Mobile OK. | Yes |

---

## Definition of Done

- [ ] Página `/perfil` acessível pelo sidebar para todos os roles
- [ ] Tab "Meus Dados" exibe info do usuário (readonly)
- [ ] Tab "Autoconhecimento" exibe cards de testes
- [ ] Questionário Big Five (IPIP-NEO-20) funcional com 20 items
- [ ] Questionário Eneagrama (Essential Enneagram Test) funcional com 9 parágrafos
- [ ] Scoring Big Five calcula médias corretas (incluindo itens reversos)
- [ ] Scoring Eneagrama identifica tipo + wing corretamente
- [ ] Progresso parcial salvo no JSONB (debounced + beforeunload)
- [ ] Questionário retoma de onde parou ao retornar
- [ ] Resultados finais persistidos no JSONB
- [ ] `{type}_progress` removido após conclusão
- [ ] Gráfico radar Big Five renderiza com recharts
- [ ] Resultado Eneagrama exibe tipo + wing + descrição
- [ ] Placeholder "Como a IA me vê" renderiza
- [ ] Responsivo (mobile/desktop)
- [ ] Zod validation em todos os Server Actions
- [ ] `pnpm lint && pnpm typecheck` passam

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementação completa (rota, tabs, questionários, persistência, gráficos, scoring) |
| **@ux-design-expert** | UX dos questionários (Likert scale, ranking), gráfico radar, flow do teste, acessibilidade |
| **@qa (Quinn)** | Validação: scoring correto (Big Five reversed items, Eneagrama wing), persistência, tabs, responsividade |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Scoring Big Five com itens reversos incorreto | MEDIUM | Testes unitários específicos para cada item reverso. Scoring formula documentada. |
| RHETI usado por engano (proprietário) | HIGH | Usando Essential Enneagram Test (Daniels & Price). RHETI explicitamente proibido no epic e nesta story. |
| Progresso perdido ao sair da página | MEDIUM | `beforeunload` event + debounced save a cada 5 respostas. Progresso persiste no JSONB. |
| JSONB merge sobrescreve dados existentes | MEDIUM | Merge pattern: `{ ...currentProfile, [field]: newValue }`. Nunca sobrescrever campos não relacionados. |
| Gráfico radar não renderiza em mobile | LOW | ResponsiveContainer com min-height. Testar em 375px viewport. |
| getAuthProfile() modificado acidentalmente | LOW | Story explicitamente documenta: NÃO modificar getAuthProfile(). Usar query separada. |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 9 v1.2 | River (SM) |

---

*Story criada por River (Scrum Master) — exímIA Academy*
