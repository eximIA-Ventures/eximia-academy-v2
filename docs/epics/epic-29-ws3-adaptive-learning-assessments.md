# Epic 29: WS3 — Adaptive Learning & Assessments

**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** Atlas (Analyst) com arquitectura de WS3 v1.0
**Status:** Draft
**Architecture Reference:** `docs/architecture/ws3-platform-evolution-architecture.md` — Seções 4.3, 6
**Workstream:** WS3 (Platform Evolution — depende de Epics 26, 27 e WS1)

---

## Epic Goal

Implementar assessment UIs para perfil explícito do aluno (Big Five e DISC), um dashboard de perfil unificado, e a integração com o motor pedagógico (WS1) para adaptação invisível de conteúdo. O aluno completa assessments amigáveis, o sistema constrói um perfil rico, e o Mestre adapta linguagem e abordagem sem que o aluno perceba.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, AI SDK, @eximia/ui, recharts (visualizações) |
| **DB Tables** | `learner_profiles` (existente), `assessment_history` (existente — popular), `assessment_results` (NOVO) |
| **Roles Impactados** | student (completa assessments), manager (vê equipe), instructor (vê alunos) |
| **Package** | `apps/web`, `packages/database`, `packages/shared`, `packages/agents` (WS1 integration) |
| **Story Points** | 26 SP |
| **Depende de** | Epic 26 (quiz engine — delivery), Epic 27 (trails — recommendation), WS1 (motor pedagógico — adaptação) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| `learner_profiles` table (Kolb + engagement) | Implementado | `packages/database/src/schema/learner-profiles.ts` |
| `assessment_history` table (5 types: big_five, disc, enneagram, multiple_intelligences, career_anchors) | Implementado | Migration `20260210000001` |
| Profiler agent (Big Five, DISC, Enneagram scoring) | Implementado parcialmente | `packages/agents/src/profiler/` |
| `adaptation_hints` field em sessions | Implementado | `packages/database/src/schema/sessions.ts` |
| Motor pedagógico (WS1 Mestre) | Implementado | `packages/agents/src/` |

### What This Epic Changes

```
ANTES:
  assessment_history table existe → vazia (sem UI para preencher)
  learner_profiles tem Kolb (implícito) → sem perfil explícito
  Motor pedagógico ignora perfil do aluno
  Manager não sabe perfil da equipe

DEPOIS:
  Aluno completa Big Five e DISC com UX amigável
  learner_profiles enriquecido com perfil explícito
  Motor pedagógico adapta linguagem ao perfil (adaptation_hints)
  Manager vê composição e pontos fortes da equipe
  Recomendação de trilhas considera perfil
```

---

## Enhancement Details

### Assessment Types (v1)

| Assessment | Items | Tempo | Scoring | Visualização |
|-----------|------:|------:|---------|-------------|
| **Big Five (IPIP-NEO)** | 44 | ~10min | 5 dimensões (O, C, E, A, N) | Radar chart |
| **DISC** | 28 | ~7min | 4 dimensões (D, I, S, C) | Radar chart + tipo dominante |

### Profile Composition

```
┌─────────────────────────────────┐
│         LEARNER PROFILE          │
│                                  │
│  Implícito (WS1 detecção):      │
│  ├── Kolb Learning Style         │
│  ├── Engagement Pattern          │
│  └── Reasoning Depth             │
│                                  │
│  Explícito (Assessments):        │
│  ├── Big Five (O,C,E,A,N)       │
│  └── DISC (D,I,S,C)             │
│                                  │
│  Derivado:                       │
│  ├── Adaptation Hints            │
│  ├── Trail Recommendations       │
│  └── Preferred Content Format    │
└─────────────────────────────────┘
```

### Adaptation Rules

| Dimensão | Alto | Adaptação |
|----------|------|-----------|
| Openness (Big Five) | >70 | Trilhas de inovação, exemplos criativos, mais autonomia |
| Conscientiousness | >70 | Estrutura clara, checklists, prazos definidos |
| Extraversion | >70 | Discussões em grupo, casos colaborativos |
| Dominance (DISC) | >70 | Desafios diretos, resultados mensuráveis, menos teoria |
| Influence (DISC) | >70 | Storytelling, exemplos inspiracionais, reconhecimento |
| Steadiness (DISC) | >70 | Ritmo estável, suporte contínuo, evitar mudanças bruscas |

---

## Stories

### Story 29.1: Big Five Assessment UI

**SP:** 5 | **Priority:** P0

**Descrição:** Formulário interactivo de 44 itens baseado no IPIP-NEO (versão open-source). UX amigável — não deve parecer um "teste psicológico".

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/assessments/big-five/page.tsx`
- [ ] Layout: 1 pergunta por vez com progress bar (não formulário longo)
- [ ] Escala Likert 5 pontos: "Discordo totalmente" → "Concordo totalmente"
- [ ] 44 items agrupados por dimensão (mas apresentados shuffled para reduzir bias)
- [ ] Scoring automático: calcular percentil para cada dimensão (O, C, E, A, N)
- [ ] Normalizar scores para escala 0-100
- [ ] Salvar resultado em `assessment_history` (type: 'big_five', scores JSONB, raw_responses JSONB)
- [ ] Tela de resultado: radar chart com 5 dimensões + descrição em linguagem simples para cada dimensão
- [ ] Não permitir re-submissão por 30 dias (cooldown)
- [ ] Server action `submitBigFiveAssessment(responses)`
- [ ] Validador Zod: `bigFiveResponseSchema`

**Acceptance Criteria:**

- [ ] Aluno completa 44 perguntas com UX one-at-a-time
- [ ] Scoring automático gera 5 scores percentil
- [ ] Resultado salvo em assessment_history
- [ ] Radar chart mostra perfil visual
- [ ] Cooldown de 30 dias entre submissões

---

### Story 29.2: DISC Assessment UI

**SP:** 5 | **Priority:** P0

**Descrição:** Formulário DISC de 28 itens com scoring automático e visualização do tipo dominante.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/assessments/disc/page.tsx`
- [ ] Layout: grupos de 4 afirmações — aluno ordena da "mais me descreve" para "menos me descreve" (forced ranking)
- [ ] 28 items (7 grupos de 4)
- [ ] Scoring: calcular score para D, I, S, C baseado na posição de ranking
- [ ] Normalizar scores para escala 0-100
- [ ] Determinar tipo dominante e secundário (ex: "DI — Influenciador Decisivo")
- [ ] Salvar resultado em `assessment_history` (type: 'disc', scores JSONB, raw_responses JSONB)
- [ ] Tela de resultado: radar chart com 4 dimensões + descrição do tipo dominante com strengths/challenges
- [ ] Cooldown de 30 dias
- [ ] Server action `submitDiscAssessment(responses)`
- [ ] Validador Zod: `discResponseSchema`

**Acceptance Criteria:**

- [ ] Aluno completa DISC com UX de ranking (drag ou click)
- [ ] Scoring gera 4 scores + tipo dominante
- [ ] Resultado salvo em assessment_history
- [ ] Descrição do tipo é clara e não-julgamental
- [ ] Cooldown funciona

---

### Story 29.3: Profile Dashboard (Student)

**SP:** 5 | **Priority:** P0

**Descrição:** Dashboard "Meu Perfil de Aprendizado" que unifica perfil implícito (Kolb, engagement) com explícito (Big Five, DISC).

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/profile/learning/page.tsx`
- [ ] Section "Perfil Implícito": Kolb learning style (se detectado via WS1), engagement pattern
- [ ] Section "Big Five": radar chart + insights (se completou assessment). Se não completou: CTA "Descubra seu perfil"
- [ ] Section "DISC": radar chart + tipo dominante + insights. Se não completou: CTA
- [ ] Section "Insights de Aprendizado": sugestões personalizadas baseadas no perfil combinado
- [ ] Ex: "Seu alto score em Openness sugere que você se beneficia de trilhas exploratórias"
- [ ] Server action `getStudentProfile(userId)` — combina learner_profiles + assessment_history
- [ ] Navigation entry: "Meu Perfil" no menu do student
- [ ] Responsive design (mobile-friendly)

**Acceptance Criteria:**

- [ ] Dashboard mostra perfil unificado (implícito + explícito)
- [ ] CTAs levam para assessments não completados
- [ ] Insights em linguagem simples e não-julgamental
- [ ] Funciona sem assessments (mostra apenas perfil implícito)

---

### Story 29.4: Team Profile View (Manager)

**SP:** 3 | **Priority:** P1

**Descrição:** Manager vê perfil agregado da equipe: distribuição DISC, tendências Big Five, pontos fortes/fracos coletivos.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/team/profiles/page.tsx`
- [ ] Card: Distribuição DISC da equipe (pie chart: % D, % I, % S, % C)
- [ ] Card: Médias Big Five da equipe (radar chart com média + range)
- [ ] Card: Gaps identificados (ex: "Equipe com baixo Openness — considerar trilhas de inovação")
- [ ] Tabela: Membros da equipe com tipo DISC, learning style, último assessment
- [ ] Filtros: por área, por cargo (se Epic 27 implementado)
- [ ] Server action `getTeamProfileData(tenantId, managerId, filters)`
- [ ] Dados anónimos: médias e distribuições, sem expor scores individuais detalhados
- [ ] Navigation entry: "Perfil da Equipe" no menu do manager

**Acceptance Criteria:**

- [ ] Manager vê composição DISC da equipe
- [ ] Média Big Five mostra tendências coletivas
- [ ] Gaps identificados com sugestões actionáveis
- [ ] Privacidade respeitada (sem scores individuais detalhados)

---

### Story 29.5: Adaptation Hints Injection (WS1 Integration)

**SP:** 5 | **Priority:** P1

**Descrição:** Integrar perfil do aluno com o motor pedagógico (WS1). Injectar `adaptation_hints` no system prompt do Mestre para que adapte linguagem e abordagem.

**Tasks:**

- [ ] Criar função `buildAdaptationHints(userId)` em `packages/shared/src/utils/adaptation.ts`
- [ ] Buscar perfil do aluno: learner_profiles + assessment_history
- [ ] Gerar hints baseados nas regras de adaptação (tabela Adaptation Rules acima)
- [ ] Formato output: `{ communication_style, content_preferences, challenge_level, pace_preference, examples_type }`
- [ ] Integrar no pipeline do Mestre (WS1): antes de iniciar diálogo, buscar hints e injectar no system prompt
- [ ] Modificar `packages/agents/src/` — adicionar `adaptation_hints` ao contexto do Mestre
- [ ] Se aluno não tem assessment: usar defaults neutros (sem adaptação)
- [ ] Salvar adaptation_hints usados na session para analytics

**Acceptance Criteria:**

- [ ] Motor pedagógico recebe adaptation_hints no system prompt
- [ ] Diálogo adapta linguagem conforme perfil (ex: mais direto para alto D, mais detalhado para alto C)
- [ ] Funciona sem assessment (fallback para defaults)
- [ ] Hints registrados na session para análise futura

---

### Story 29.6: Trail Recommendation by Profile

**SP:** 3 | **Priority:** P2

**Descrição:** Refinar recomendação de trilhas (Epic 27.6) com base no perfil do aluno.

**Tasks:**

- [ ] Estender `suggestTrails(userId)` (Epic 27.6) com scoring por perfil
- [ ] Regras de matching:
  - Alto Openness → trilhas de inovação, liderança criativa
  - Alto Conscientiousness → trilhas de processos, compliance
  - Alto Dominance (DISC) → trilhas de liderança, gestão de resultados
  - Alto Influence → trilhas de comunicação, vendas, apresentações
  - Alto Steadiness → trilhas de operações, suporte, qualidade
- [ ] Peso do perfil na recomendação: 30% (70% continua sendo cargo/área)
- [ ] Se sem assessment: usar apenas cargo/área (100%)
- [ ] Mostrar tag "Recomendado para seu perfil" nas trilhas com match alto
- [ ] Server action `suggestTrailsByProfile(userId)` — estende suggestTrails

**Acceptance Criteria:**

- [ ] Recomendação considera perfil quando disponível
- [ ] Tag visual indica match com perfil
- [ ] Funciona sem assessment (fallback para cargo/área)
- [ ] Peso do perfil é complementar, não substitui cargo

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Epic 26 (Quiz engine) | Interna | Pendente |
| Epic 27 (Trails & Job Roles) | Interna | Pendente |
| WS1 Motor Pedagógico (Mestre) | Interna | Implementado |
| `learner_profiles` table | Interna | Implementado |
| `assessment_history` table | Interna | Implementado |
| Profiler agent (scoring logic) | Interna | Implementado parcialmente |

## Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| DISC/Big Five licensing concerns | Baixo | Usar versões open-source: IPIP-NEO (public domain) e DISC simplificado |
| Alunos não completam assessments | Médio | UX amigável (1 pergunta por vez), gamification leve, CTA no dashboard |
| Adaptação do Mestre perceptível (uncanny valley) | Médio | Adaptação sutil — hints são sugestões, não commands. Mestre mantém personalidade |
| Perfil desactualizado após meses | Baixo | Cooldown de 30 dias permite re-assessment. Alerta após 6 meses |
| Dependência de WS1 para Story 29.5 | Médio | Stories 29.1-29.4 podem ser entregues independentemente. 29.5 é incremental |

---

*Epic 29 — WS3 Adaptive Learning & Assessments v1.0*
