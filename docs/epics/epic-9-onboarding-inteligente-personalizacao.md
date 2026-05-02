# Epic 9: Onboarding Inteligente & Personalização Adaptativa

**Version:** 1.2
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** APPROVED — QA PASS (Quinn review v1.2, 90→100/100)
**PRD Reference:** `docs/prd.md` — FR20 (onboarding), Epic 5 (revisão)
**Architecture Reference:** `docs/architecture.md` v1.3
**Screens Reference:** `docs/screens.md` — Tela 3 (redesign)
**Research Reference:** Analyst Report — Onboarding & Perfilamento Adaptativo (Atlas, 2026-02-08)

---

## Epic Goal

Redesenhar o onboarding do aluno para ser relevante no contexto corporativo (2 steps em vez de 5), permitir que managers criem trilhas de onboarding corporativo, e oferecer um hub de autoconhecimento opcional (Big Five, Eneagrama, etc.) como tab no perfil do aluno — preparando a base para perfilamento progressivo via IA (Epic 10).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui + Vercel AI SDK |
| **DB Tables** | `users` (profile JSONB), `courses` (novo campo `type`), `enrollments` (auto-enroll) |
| **Auth** | Supabase Auth invite-only, middleware protege `/(platform)/*` (Story 1.3) |
| **Layout** | Sidebar 200px + header + content area (Story 1.4) |
| **Onboarding Route** | `/onboarding` — FORA do grupo `(platform)`, mantém padrão do Epic 5 |
| **Profile Route** | `/perfil` — nova rota dentro de `(platform)` com sistema de tabs |
| **Screens** | Tela 3 (Onboarding Wizard — redesign) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Dual-Mode** | Labels adaptam via `tenant.mode`: mantém padrão Story 5.4 |
| **Impacted Epic** | Epic 5, Story 5.3 — onboarding existente será substituído |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Source |
|-----------|--------|--------|
| Onboarding wizard 5 steps (Story 5.3) | Implemented | `apps/web/src/components/onboarding/` |
| `users.profile` JSONB (learning_style, experience_level, goals, sector, course_period) | Implemented | `supabase/migrations/20260207000000_initial_schema.sql` |
| `onboarding_completed` boolean | Implemented | `users` table |
| Server Action `saveOnboardingProfile()` | Implemented | `apps/web/src/app/onboarding/actions.ts` |
| Zod validation (security-critical) | Implemented | `apps/web/src/app/onboarding/actions.ts` |
| Course CRUD (create, publish, enroll) | Implemented | Epic 2 |
| Student self-enrollment via RLS | Implemented | ADR-001 |
| Dual-mode labels (university/corporate) | Implemented | `packages/shared/src/constants/mode-config.ts` |
| Enrollment progress tracking | Implemented | ADR-002, `update_enrollment_progress()` RPC |
| Motor socrático (chat engine) | Implemented | Epic 3 |

### Current Relevant Functionality

- **Epic 5, Story 5.3** implementou onboarding com 5 steps coletando: learning_style, experience_level, goals, sector/course_period
- **Achado crítico do @analyst:** Dados coletados são armazenados mas **nunca utilizados** por nenhuma rota, API, componente ou interação IA
- **Modelo VARK** (Step 2 atual) é classificado como **neuromito** pela comunidade científica — efeito real d=0.04 (essencialmente zero)
- **Contexto corporativo:** A empresa define trilhas, não o aluno. Perguntar "objetivos" e "setor" ao colaborador é redundante
- Cursos usam campo `status` ('draft', 'published', 'archived') mas não têm campo `type`

### Integration Points

- **Onboarding wizard** → mesma rota `/onboarding`, mesma estrutura fora de `(platform)`
- **Course CRUD** → adicionar campo `type` na criação de trilhas (teacher/manager)
- **Auto-enrollment** → reutilizar lógica de `enrollInCourse` para inscrição automática
- **User profile** → nova rota `/perfil` com tabs, consome `users.profile` JSONB
- **Motor socrático** → base para perfilamento progressivo (Epic 10)

---

## Enhancement Details

### What's Being Added/Changed

1. **Redesign do Onboarding** — Reduzir de 5 steps para 2: Boas-vindas + "Você é novo aqui?". Step 2 é **mode-aware** (corporativo: "empresa", universidade: "instituição"). Remover steps de learning style (neuromito), experiência (auto-relato impreciso), objetivos (empresa define), setor (admin já sabe).

2. **Trilha de Onboarding Corporativo** — Novo campo `type` em `courses` ('regular' | 'onboarding'). Manager pode marcar trilha como "onboarding" na criação. Quando aluno indica que é novo e precisa do onboarding, é auto-inscrito nessa trilha.

3. **Hub de Autoconhecimento** — Nova página `/perfil` com tab "Autoconhecimento" onde o aluno pode, voluntariamente, explorar testes de personalidade (Big Five/OCEAN, Eneagrama) e visualizar seu perfil de aprendizado. Dados armazenados no `users.profile` JSONB.

### How It Integrates

- **Onboarding** reutiliza a rota existente `/onboarding` e o padrão de Server Actions. Componentes antigos (step-learning-style, step-experience, step-goals, step-sector) são removidos e substituídos por novo step.
- **Trilha onboarding** usa o CRUD de cursos existente (Epic 2), adicionando campo `type`. Auto-enrollment reutiliza `enrollInCourse` Server Action.
- **Hub de autoconhecimento** é uma nova rota `/(platform)/perfil` com componentes de tab (`@eximia/ui` Tabs). Consome e atualiza `users.profile` via Server Action.

### Success Criteria

- [ ] Onboarding completo em < 1 minuto (2 steps vs 5)
- [ ] Aluno que indica "sou novo" é auto-inscrito na trilha de onboarding corporativo
- [ ] Manager pode criar trilha do tipo "onboarding" no fluxo de criação de cursos
- [ ] Tab "Autoconhecimento" acessível em `/perfil` com testes opcionais
- [ ] Dados de personalidade salvos no `users.profile` JSONB
- [ ] Funcionalidade existente (Epics 1-5) permanece operacional
- [ ] Nenhum vazamento cross-tenant (integridade RLS mantida)

---

## Stories

---

### Story 9.1: Redesign do Onboarding (5 → 2 Steps)

**As a** new collaborator,
**I want** um onboarding rápido e relevante no contexto corporativo,
**so that** eu chegue ao conteúdo da plataforma em menos de 1 minuto.

**PRD Reference:** FR20 (revisão)
**Screens Reference:** screens.md — Tela 3 (redesign)

**Story Points:** 5
**Priority:** P0 (Depende de Story 9.2 para auto-enrollment)
**Risk:** MEDIUM — modifica fluxo existente do Epic 5 Story 5.3

#### Acceptance Criteria

- [ ] **AC1:** Wizard reduzido para 2 steps (era 5)
- [ ] **AC2:** Step 1: Boas-vindas + avatar upload (mantém funcionalidade existente)
- [ ] **AC3:** Step 2 é **mode-aware** via `tenant.mode`:
  - **Corporativo:** "Você é novo na empresa?" com 3 opções:
    - "Sou novo, ainda não fiz o onboarding da empresa" → `employee_status = 'new_needs_onboarding'`
    - "Sou novo, mas já fiz o onboarding presencial" → `employee_status = 'new_already_onboarded'`
    - "Já trabalho aqui há algum tempo" → `employee_status = 'existing'`
  - **Universidade:** "Você é novo na instituição?" com 3 opções:
    - "Sou novo, ainda não fiz a semana de recepção" → `employee_status = 'new_needs_onboarding'`
    - "Sou novo, mas já fiz a recepção presencial" → `employee_status = 'new_already_onboarded'`
    - "Já estudo aqui há algum tempo" → `employee_status = 'existing'`
- [ ] **AC4:** Dados salvos em `users.profile` JSONB via Server Action (campo único: `employee_status`)
- [ ] **AC5:** `onboarding_completed` marcado como true após conclusão
- [ ] **AC6:** Se `employee_status = 'new_needs_onboarding'` E existe trilha tipo 'onboarding' publicada no tenant → auto-enroll e redirect para dashboard
- [ ] **AC7:** Se `employee_status != 'new_needs_onboarding'` → redirect direto para dashboard
- [ ] **AC8:** Se `employee_status = 'new_needs_onboarding'` mas NÃO existe trilha onboarding publicada → redirect ao dashboard com toast informativo: "Nenhuma trilha de boas-vindas configurada. Fale com seu gestor."
- [ ] **AC9:** Skip option mantido (pode pular e completar depois)
- [ ] **AC10:** Componentes antigos removidos: `step-learning-style.tsx`, `step-experience.tsx`, `step-goals.tsx`, `step-sector.tsx`
- [ ] **AC11:** Testes antigos removidos e novos testes criados para o novo fluxo (incluindo ambos os modos)
- [ ] **AC12:** Zod validation atualizada para novo schema de profile (security-critical)

#### Technical Notes

- **Rota mantida FORA do grupo (platform):** `apps/web/src/app/onboarding/page.tsx` — mesmo padrão do Epic 5
- **Novo schema do profile JSONB (H-2/M-1 FIX: campo único, sem redundância):**
  ```typescript
  interface UserProfile {
    // Onboarding data (Step 2) — single field, no redundancy
    employee_status?: 'new_needs_onboarding' | 'new_already_onboarded' | 'existing'
    // Derived: needsOnboarding = employee_status === 'new_needs_onboarding'

    // Avatar (Step 1 — mantido)
    photo_url?: string

    // Self-knowledge hub data (Story 9.3 — preenchido depois)
    big_five?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
    enneagram?: { type: number; wing?: number }

    // AI-inferred profile (Epic 10 — preenchido pela IA)
    ai_learning_profile?: Record<string, unknown>

    // Legacy fields (mantidos para backward compatibility, não coletados)
    learning_style?: string
    experience_level?: string
    goals?: string[]
    sector?: string
    course_period?: string
  }
  ```
- **Auto-enrollment:** Após salvar profile, se `employee_status === 'new_needs_onboarding'`, buscar curso com `type = 'onboarding'` no tenant e chamar `enrollInCourse()`. Isso depende da Story 9.2 estar implementada; se não houver trilha onboarding, apenas redireciona ao dashboard com toast informativo (AC8).
- **Zod validation** deve restringir campos atualizáveis — manter padrão de segurança do Epic 5

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementação completa (redesign wizard, remoção steps antigos, novo Server Action) |
| **@qa (Quinn)** | Validação: fluxo 2 steps, auto-enrollment, skip, Zod, backward compat |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Wizard renderiza 2 steps. Nenhuma referência aos steps removidos. | Yes |
| Pre-PR | Fluxo completo salva profile, auto-enroll funciona quando trilha existe, skip funciona, redirect correto. Zod rejeita campos inválidos. Legacy data não é corrompida. | Yes |

---

### Story 9.2: Trilha de Onboarding Corporativo

**As a** manager/teacher,
**I want** criar uma trilha marcada como "onboarding corporativo",
**so that** novos colaboradores sejam automaticamente direcionados ao conteúdo de boas-vindas da empresa.

**PRD Reference:** Nova funcionalidade (extensão de FR20)

**Story Points:** 5
**Priority:** P0 (Blocker — Story 9.1 depende disso para auto-enrollment)
**Risk:** MEDIUM — adiciona campo ao schema de courses, afeta CRUD existente

#### Acceptance Criteria

- [ ] **AC1:** Novo campo `type` na tabela `courses`: `'regular' | 'onboarding'` (default: 'regular')
- [ ] **AC2:** No fluxo de criação de curso (teacher/manager), opção para selecionar tipo "Onboarding Corporativo"
- [ ] **AC3:** Máximo 1 trilha ativa do tipo 'onboarding' por tenant (validação server-side)
- [ ] **AC4:** Se já existe trilha onboarding publicada e manager tenta publicar outra → mensagem informativa: "Já existe uma trilha de onboarding ativa: {titulo}. Deseja substituir?" Se sim, a trilha anterior volta para `type = 'regular'` e a nova assume `type = 'onboarding'` (swap atômico)
- [ ] **AC5:** Trilha onboarding aparece com badge/tag distinto na listagem de cursos (visível para teacher/manager)
- [ ] **AC6:** Aluno vê a trilha onboarding como qualquer outra trilha na listagem (sem tratamento especial na UI do aluno, exceto auto-enrollment do Story 9.1)
- [ ] **AC7:** Migration SQL adiciona coluna `type` com default 'regular' (backward compatible)
- [ ] **AC8:** RLS policies existentes continuam funcionando (campo `type` não afeta isolation)

#### Technical Notes

- **Migration:**
  ```sql
  ALTER TABLE courses ADD COLUMN type TEXT NOT NULL DEFAULT 'regular'
    CHECK (type IN ('regular', 'onboarding'));

  -- Unique partial index: max 1 active onboarding per tenant
  CREATE UNIQUE INDEX courses_unique_onboarding_per_tenant
    ON courses (tenant_id)
    WHERE type = 'onboarding' AND status = 'published';
  ```
- **Validação server-side:** Antes de publicar curso tipo 'onboarding', verificar se já existe outro publicado no tenant. Se sim, oferecer substituição.
- **UI:** No formulário de criação/edição de curso, adicionar radio/select para `type`. Usar componentes `@eximia/ui` existentes.
- **Badge:** Na listagem de cursos (teacher/manager view), cursos tipo 'onboarding' mostram badge "Onboarding" com cor accent.
- **Query para auto-enrollment (Story 9.1):**
  ```typescript
  const { data: onboardingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'onboarding')
    .eq('status', 'published')
    .single()
  ```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration, CRUD update, badge UI, validação de unicidade |
| **@qa (Quinn)** | Validação: constraint unicidade, backward compat, badge rendering, auto-enrollment integration |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Migration é reversível. Campo `type` tem default. | Yes |
| Pre-PR | Criar trilha onboarding funciona. Constraint de unicidade impede duplicatas. Trilhas existentes mantêm `type = 'regular'`. CRUD existente não quebra. Badge aparece. | Yes |

---

### Story 9.3: Hub de Autoconhecimento (Tab no Perfil)

**As a** student/collaborator,
**I want** acessar testes de personalidade e autoconhecimento quando eu quiser,
**so that** eu descubra meu perfil de aprendizado de forma voluntária e no meu ritmo.

**PRD Reference:** Nova funcionalidade (extensão de FR20)

**Story Points:** 8
**Priority:** P1
**Risk:** LOW — nova funcionalidade isolada, sem impacto em features existentes

#### Acceptance Criteria

- [ ] **AC1:** Nova rota `/(platform)/perfil` acessível pelo sidebar (item "Meu Perfil")
- [ ] **AC2:** Página com sistema de tabs (`@eximia/ui` Tabs): "Meus Dados" e "Autoconhecimento"
- [ ] **AC3:** Tab "Meus Dados": exibe nome, email, role, avatar, status do onboarding (readonly, editável em versão futura)
- [ ] **AC4:** Tab "Autoconhecimento" com cards para cada teste disponível:
  - Big Five (OCEAN) — questionário de 20-30 perguntas
  - Eneagrama — questionário de 36 perguntas
  - (Extensível para futuros testes)
- [ ] **AC5:** Cada card mostra: nome do teste, descrição curta, tempo estimado, status (não iniciado / completo), botão "Iniciar" ou "Ver Resultado"
- [ ] **AC6:** Questionários renderizados inline (sem redirect externo), com progresso salvo em `users.profile` JSONB como `{type}_progress: { answers: Record<number, number>, completed: false }`. Progresso salvo via Server Action ao sair da página ou a cada 5 respostas (debounced). Ao retornar, questionário retoma de onde parou.
- [ ] **AC7:** Resultados finais salvos em `users.profile` JSONB (campos `big_five`, `enneagram`). Campo `{type}_progress` removido após conclusão.
- [ ] **AC8:** Visualização de resultados: gráfico radar para Big Five, tipo + descrição para Eneagrama
- [ ] **AC9:** Seção "Como a IA me vê" — placeholder com mensagem: "Conforme você interage com o tutor, seu perfil de aprendizado será construído automaticamente" (Epic 10)
- [ ] **AC10:** Dados salvos via Server Action com Zod validation
- [ ] **AC11:** Sidebar atualizada com item "Meu Perfil" (ícone User, acessível para **todos os roles**)
- [ ] **AC12:** Responsivo (mobile-friendly)

#### Technical Notes

- **Questionários Big Five (OCEAN):** Usar modelo IPIP-NEO-20 (20 itens, validado academicamente, domínio público). Cada item: escala Likert 1-5 (Discordo totalmente → Concordo totalmente). Scoring: média por dimensão.
- **Questionário Eneagrama (H-3 FIX):** NÃO usar RHETI (proprietário do Enneagram Institute). Usar **Essential Enneagram Test (Daniels & Price)** — formato de 9 parágrafos descritivos, domínio público, academicamente referenciado. O usuário ordena os 9 parágrafos por identificação (ranking). Tipo = parágrafo #1. Wing = tipo adjacente mais alto. Alternativa: criar questionário original inspirado nos 9 tipos (sem copiar itens específicos do RHETI).
- **Persistência:**
  ```typescript
  // Server Action: saveAssessmentResult()
  const assessmentSchema = z.object({
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
  ```
- **Gráfico radar:** Usar `recharts` v3.7.0 (já instalado no projeto: `apps/web/package.json`)
- **Tab Component:** Usar `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` de `@eximia/ui`
- **Sidebar:** Adicionar item "Meu Perfil" com ícone `User` (lucide-react), visível para **todos os roles** (L-1 FIX)
- **M-2 FIX — Profile Data Access:** `getAuthProfile()` em `apps/web/src/lib/auth.ts` atualmente NÃO seleciona o campo `profile` JSONB. A página `/perfil` deve fazer query separada para buscar `users.profile` (não modificar `getAuthProfile()` para não impactar performance de outros paths). Usar query dedicada no RSC:
  ```typescript
  const { data } = await supabase.from('users').select('profile').eq('id', user.id).single()
  ```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementação completa (rota, tabs, questionários, persistência, gráficos) |
| **@ux-design-expert** | UX dos questionários, gráfico radar, flow do teste, acessibilidade |
| **@qa (Quinn)** | Validação: scoring correto, persistência, tabs, responsividade |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Tabs renderizam. Questionários exibem perguntas. | Yes |
| Pre-PR | Big Five calcula scores corretos. Eneagrama identifica tipo. Resultados persistem no JSONB. Gráfico radar renderiza. Tab "Meus Dados" exibe info do usuário. Sidebar mostra link. Mobile OK. | Yes |

---

## Dependency Graph

```
Story 9.2 (Trilha Onboarding Corporativo) ──┐
                                              ├──→ Story 9.1 (Redesign Onboarding)
                                              │         [auto-enroll depende de trilha existir]
                                              │
Story 9.3 (Hub Autoconhecimento)  ───────────┘  [independente, pode ser paralelo]
```

**Execution Order:**
1. **Story 9.2** primeiro (P0 — cria campo `type` e trilha onboarding que Story 9.1 consome)
2. **Story 9.1** segundo (P0 — redesign do wizard, depende de 9.2 para auto-enrollment)
3. **Story 9.3** em paralelo com 9.1 ou após (P1 — independente, nova funcionalidade)

---

## Compatibility Requirements

- [ ] Existing APIs remain unchanged (Epics 1-5 endpoints)
- [ ] Database schema change é backward compatible (ADD COLUMN com default, não DROP)
- [ ] UI changes follow existing `@eximia/ui` + Tailwind patterns
- [ ] Performance impact é minimal (nenhuma query adicional em paths críticos)
- [ ] RLS policies remain intact — campo `type` não afeta tenant isolation
- [ ] Cursos existentes recebem `type = 'regular'` automaticamente (migration default)
- [ ] Dados legados de `users.profile` (learning_style, etc.) não são corrompidos
- [ ] Dashboards (Epic 4), Socratic chat (Epic 3), Course CRUD (Epic 2) continuam funcionando
- [ ] Alunos que já completaram onboarding antigo NÃO são forçados a refazer

---

## Risk Mitigation

### Primary Risk: Alunos Existentes com Onboarding Antigo

- **Impact:** MEDIUM — alunos já têm `onboarding_completed = true` com profile schema antigo
- **Mitigation:** Não resetar `onboarding_completed`. Profile JSONB é schema-less — campos antigos coexistem com novos. Alunos existentes não são afetados.
- **Rollback Plan:** Se necessário, reverter componentes do wizard para versão anterior (git revert). Dados no JSONB permanecem válidos.

### Secondary Risk: Único Onboarding Trail por Tenant

- **Impact:** LOW — constraint UNIQUE pode causar confusão se manager não entender a limitação
- **Mitigation:** UI mostra mensagem clara quando já existe trilha onboarding. Opção de substituir explicitamente. Tooltip explicativo no formulário.
- **Rollback Plan:** Constraint pode ser relaxada futuramente se necessário (DROP INDEX).

### Tertiary Risk: Questionários de Personalidade Sem Validação Científica

- **Impact:** LOW — testes são para autoconhecimento, não para decisões educacionais automatizadas
- **Mitigation:** Usar instrumentos de domínio público com validação acadêmica (IPIP-NEO-20 para Big Five, Essential Enneagram Test de Daniels & Price para Eneagrama — NÃO RHETI que é proprietário). Disclaimer visível: "Estes testes são para autoconhecimento e não definem suas capacidades."
- **Rollback Plan:** Testes são opcionais — podem ser desabilitados sem afetar o resto da plataforma.

---

## Quality Assurance Strategy

### CodeRabbit Validation

All stories include pre-commit reviews:
- **Story 9.1 (Redesign):** @dev valida remoção limpa de componentes antigos, novo Zod schema
- **Story 9.2 (Trilha):** @dev valida migration, constraint unicidade, backward compat
- **Story 9.3 (Hub):** @ux-design-expert valida UX dos questionários, acessibilidade

### Specialized Expertise

| Domain | Agent | Focus |
|--------|-------|-------|
| Onboarding redesign | @dev | Remoção segura de steps, novo wizard, auto-enrollment |
| Database migration | @dev | ADD COLUMN seguro, UNIQUE partial index, backward compat |
| Assessment UX | @ux-design-expert | Questionários progressivos, gráfico radar, mobile |
| Scoring algorithms | @dev | Big Five (IPIP-NEO-20), Eneagrama (Essential Enneagram Test) — scoring correto |
| Security | @dev | Zod validation, RLS integridade, no role escalation |

### Quality Gates Aligned with Risk

- **Story 9.1 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 9.2 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 9.3 (LOW risk):** Pre-Commit + Pre-PR validation

### Regression Prevention

- Story 9.1 inclui verificação de que alunos existentes não são afetados
- Story 9.2 inclui verificação de que cursos existentes recebem `type = 'regular'`
- Testes de integração validam compatibilidade com Epics 1-5
- Performance testing: LCP < 2s target mantido

---

## API Contracts

### Onboarding (Server Action — redesign) [M-1 FIX: single field, no redundancy]

```typescript
// Server Action: saveOnboardingProfile() — UPDATED
interface OnboardingPayload {
  profile: {
    employee_status: 'new_needs_onboarding' | 'new_already_onboarded' | 'existing'
    photo_url?: string
    // Derived: needsOnboarding = employee_status === 'new_needs_onboarding'
    // No redundant boolean field — derive where needed
  }
}

// Zod schema MUST restrict updatable fields (security-critical)
const onboardingSchema = z.object({
  profile: z.object({
    employee_status: z.enum(['new_needs_onboarding', 'new_already_onboarded', 'existing']),
    photo_url: z.string().optional(),
  }),
})
```

### Course Type (Migration + CRUD)

```typescript
// Course creation/update — extended
interface CoursePayload {
  title: string
  description?: string
  content?: string
  mode: 'university' | 'corporate'
  type: 'regular' | 'onboarding'  // NEW
  settings?: Record<string, unknown>
}

// Query: find onboarding course for tenant
// SELECT id FROM courses WHERE tenant_id = ? AND type = 'onboarding' AND status = 'published' LIMIT 1
```

### Assessment Results (Server Action)

```typescript
// Server Action: saveAssessmentResult()
interface AssessmentPayload {
  type: 'big_five' | 'enneagram'
  result: BigFiveResult | EnneagramResult
}

interface BigFiveResult {
  openness: number        // 1-5
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

interface EnneagramResult {
  type: number            // 1-9
  wing?: number           // 1-9
  scores: number[]        // length 9
}
```

---

## Technical Notes

### Onboarding Step 2: Mode-Aware Employee Status (H-2 FIX)

```typescript
// apps/web/src/components/onboarding/step-employee-status.tsx
// Labels adapt based on tenant.mode — uses MODE_LABELS pattern from Story 5.4

const EMPLOYEE_STATUS_OPTIONS = {
  corporate: [
    {
      value: 'new_needs_onboarding',
      icon: Sprout,
      title: 'Sou novo, preciso do onboarding',
      description: 'Ainda não fiz o processo de boas-vindas da empresa',
    },
    {
      value: 'new_already_onboarded',
      icon: CheckCircle,
      title: 'Sou novo, mas já fiz o onboarding',
      description: 'Já passei pelo processo de boas-vindas presencial',
    },
    {
      value: 'existing',
      icon: Building,
      title: 'Já trabalho aqui há algum tempo',
      description: 'Estou conhecendo a plataforma de aprendizado',
    },
  ],
  university: [
    {
      value: 'new_needs_onboarding',
      icon: Sprout,
      title: 'Sou novo, preciso da recepção',
      description: 'Ainda não fiz a semana de recepção da instituição',
    },
    {
      value: 'new_already_onboarded',
      icon: CheckCircle,
      title: 'Sou novo, mas já fiz a recepção',
      description: 'Já passei pela recepção presencial',
    },
    {
      value: 'existing',
      icon: Building,
      title: 'Já estudo aqui há algum tempo',
      description: 'Estou conhecendo a plataforma de aprendizado',
    },
  ],
} as const

// Step title also adapts:
// corporate: "Você é novo na empresa?"
// university: "Você é novo na instituição?"
```

### Auto-Enrollment Logic

```typescript
// apps/web/src/app/onboarding/actions.ts
async function handleAutoEnrollment(userId: string, tenantId: string) {
  // Find published onboarding course for this tenant
  const { data: onboardingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'onboarding')
    .eq('status', 'published')
    .single()

  if (onboardingCourse) {
    // Auto-enroll using existing enrollment logic
    await supabase.from('enrollments').insert({
      student_id: userId,
      course_id: onboardingCourse.id,
      tenant_id: tenantId,
      status: 'active',
      progress: {},
    })
  }
}
```

### Profile Page with Tabs

```typescript
// apps/web/src/app/(platform)/perfil/page.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@eximia/ui'

export default function ProfilePage() {
  return (
    <Tabs defaultValue="dados">
      <TabsList>
        <TabsTrigger value="dados">Meus Dados</TabsTrigger>
        <TabsTrigger value="autoconhecimento">Autoconhecimento</TabsTrigger>
      </TabsList>
      <TabsContent value="dados">
        <ProfileDataSection />
      </TabsContent>
      <TabsContent value="autoconhecimento">
        <SelfKnowledgeHub />
      </TabsContent>
    </Tabs>
  )
}
```

### File Locations

```
apps/web/src/app/
├── onboarding/
│   ├── page.tsx                          # Story 9.1: Wizard redesign (FORA do platform)
│   ├── layout.tsx                        # Mantido
│   └── actions.ts                        # Story 9.1: Atualizado (novo schema + auto-enroll)
├── (platform)/
│   ├── perfil/
│   │   └── page.tsx                      # Story 9.3: Profile page com tabs
│   └── layout.tsx                        # Mantido (onboarding redirect check)

apps/web/src/components/
├── onboarding/
│   ├── onboarding-wizard.tsx             # Story 9.1: UPDATED (2 steps)
│   ├── step-welcome.tsx                  # Story 9.1: MANTIDO
│   ├── step-employee-status.tsx          # Story 9.1: NEW (substitui 4 steps antigos)
│   ├── step-learning-style.tsx           # Story 9.1: REMOVED
│   ├── step-experience.tsx               # Story 9.1: REMOVED
│   ├── step-goals.tsx                    # Story 9.1: REMOVED
│   └── step-sector.tsx                   # Story 9.1: REMOVED
├── profile/
│   ├── profile-data-section.tsx          # Story 9.3: Tab "Meus Dados"
│   ├── self-knowledge-hub.tsx            # Story 9.3: Tab "Autoconhecimento"
│   ├── assessment-card.tsx               # Story 9.3: Card para cada teste
│   ├── big-five-questionnaire.tsx        # Story 9.3: Questionário Big Five
│   ├── enneagram-questionnaire.tsx       # Story 9.3: Questionário Eneagrama
│   ├── big-five-results.tsx              # Story 9.3: Gráfico radar + descrição
│   ├── enneagram-results.tsx             # Story 9.3: Tipo + wing + descrição
│   └── ai-profile-placeholder.tsx        # Story 9.3: Placeholder Epic 10
└── courses/
    └── course-form.tsx                   # Story 9.2: UPDATED (campo type)

supabase/migrations/
└── 20260209000000_epic9_onboarding_redesign.sql  # Stories 9.1 + 9.2: migration
```

---

## Definition of Done

- [ ] All 3 stories completed with acceptance criteria met
- [ ] Onboarding reduzido para 2 steps e funcional
- [ ] Manager pode criar trilha tipo "onboarding" com constraint de unicidade
- [ ] Auto-enrollment funciona quando aluno indica que é novo
- [ ] Página de perfil com tabs "Meus Dados" e "Autoconhecimento" funcional
- [ ] Questionários Big Five e Eneagrama com scoring correto
- [ ] Resultados persistidos no `users.profile` JSONB
- [ ] Funcionalidade existente (Epics 1-5) verificada via testes de regressão
- [ ] Alunos existentes NÃO são afetados (onboarding_completed respeitado)
- [ ] Cursos existentes recebem `type = 'regular'` automaticamente
- [ ] Nenhuma regressão em features existentes
- [ ] RLS integrity mantida — no cross-tenant access
- [ ] Performance: todas as páginas < 2s (LCP)
- [ ] Documentação atualizada (architecture.md se necessário)

---

## SM Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is a redesign of existing onboarding (Epic 5, Story 5.3) + new features on an existing system running Next.js 15 + Supabase + Drizzle + Tailwind/shadcn
- Integration points: onboarding wizard (existing), course CRUD (Epic 2), enrollment logic (ADR-001), sidebar (Epic 1)
- Existing patterns to follow: RSC data loading (Epic 4), Server Actions for mutations (Epic 2), Supabase Storage (Epic 5)
- Critical compatibility requirements: alunos existentes com `onboarding_completed = true` NÃO devem ser afetados. Cursos existentes recebem `type = 'regular'` via migration default.
- Each story must include verification that existing functionality remains intact
- Story 9.2 should be implemented first (P0) as Story 9.1 depends on it for auto-enrollment
- Story 9.3 can be implemented in parallel after 9.2
- **Onboarding route MUST remain outside (platform) group** to avoid redirect loop
- **Zod validation on all Server Actions is SECURITY-CRITICAL**
- **Big Five scoring must use IPIP-NEO-20 model** (academically validated, public domain)
- **Enneagram must use Essential Enneagram Test (Daniels & Price)** — NOT RHETI (proprietary)

The epic should maintain system integrity while delivering a faster, context-relevant onboarding, corporate onboarding trails, and an optional self-knowledge hub."

---

## Total Story Points: 18

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 9.1 Redesign Onboarding | 5 | P0 | Story 9.2 (trilha type) |
| 9.2 Trilha Onboarding Corporativo | 5 | P0 | Epic 2 (course CRUD) |
| 9.3 Hub de Autoconhecimento | 8 | P1 | Nenhuma (independente) |

---

## Future: Epic 10 — Perfilamento Progressivo via IA

Este epic prepara a base para o Epic 10, que implementará:
- Análise semântica das conversas socrática para inferir preferências de aprendizado
- Atualização incremental de `users.profile.ai_learning_profile`
- Adaptação do comportamento do tutor IA baseado no perfil inferido
- Visualização da evolução do perfil na seção "Como a IA me vê" (Story 9.3, AC9)
- Integração com motor socrático existente (Epic 3)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Epic criado baseado em análise do @analyst Atlas (pesquisa VARK neuromito, EdTech best practices, perfilamento progressivo) e decisões do stakeholder (2 steps, trilha onboarding corporativo, hub como tab) | Morgan (PM) |
| 2026-02-08 | 1.1 | QA fixes: H-1 corrigir prioridade/dependência Story 9.1, H-2 Step 2 mode-aware (corporativo vs universidade), H-3 RHETI→Essential Enneagram Test (domínio público), M-1 remover campo redundante needs_company_onboarding, M-2 documentar acesso ao profile JSONB (query separada), M-3 AC8 feedback quando trilha não existe, M-4 explicitar semântica de "substituir" (swap de type), M-5 mecanismo de progresso dos questionários, L-1 /perfil acessível para todos os roles, L-2 toast informativo | Morgan (PM) |
| 2026-02-08 | 1.2 | QA re-review micro-fixes: R-1 RHETI residual na tabela Specialized Expertise → Essential Enneagram Test, R-2 variável legacy needs_company_onboarding → employee_status === 'new_needs_onboarding' no Technical Notes | Quinn (QA) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*
*Baseado em pesquisa do Atlas (Analyst Agent) — 2026-02-08*

— Morgan, planejando o futuro
