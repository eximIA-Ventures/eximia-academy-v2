# PRD: Evolução exímIA Academy — Ecossistema de Aprendizado IA

> Status: Pré-Estrutura (Brainstorming Output)
> Data: 2026-02-15
> Agente: @analyst (Atlas)

---

## Visão do Produto

Transformar a exímIA Academy em uma plataforma onde o conteúdo empresarial é dinamicamente processado por IA para criar trilhas de desenvolvimento personalizadas, materiais multimídia (foco em áudio/podcast) e gestão preditiva de performance para líderes.

## Público-Alvo

- **Líder Educador/Instrutor**: Agilidade para criar e atualizar cursos
- **Gestor (Manager)**: Controle de performance, recomendações de trilhas, análise de gaps
- **Aluno/Colaborador**: Consumo flexível (on-the-go), aprendizado adaptado ao perfil comportamental

---

## 3 Workstreams Independentes

### WS1: Motor Socrático (Reconstrução Total)

**Objetivo**: Reconstruir completamente o pipeline socrático baseado nos benchmarks IA-Socrática + Harven_Socrates.

**Estado atual**: Pipeline funcional (SocratOS → Editor → Analyst → Profiler → Creator) com 20 interações lineares.

**Estado alvo**: Sistema de diálogo socrático de última geração com progressão de profundidade, detecção cognitiva e feedback estruturado.

**Componentes principais**:
- Máquina de estados conversacional (7 camadas de profundidade: Fatos→Emoções→Significado→Padrões→Origem→Identidade→Transcendência)
- 4 prompts especializados:
  1. Mestre Socrático Core (6 tipos de pergunta por taxonomia Bloom)
  2. Detector de Padrões Cognitivos (Distorções, Loops, Defesa, Valores implícitos)
  3. Gerador de Perguntas Poderosas (Paradoxal, Temporal, Inversão, Essência, Permissão)
  4. Tratamento de Resistência (5 tipos com mitigação)
- Feedback Sandwich Socrático (Conexão→Nuance→Pergunta)
- Schema de dados enriquecido (jornada emocional, breakthrough moments, métricas de profundidade)
- Prompt de fechamento socrático
- Regras invioláveis (nunca dar resposta direta, sempre terminar com pergunta aberta, 1 pergunta por resposta, perguntas proibidas)

**Benchmarks de referência**:
- `Benchmarks/IA-Socrática/IA de Conversa Socráica.md`
- `Benchmarks/Agentes/Harven_Socrates/` (spec, DNA mental, KB_01-04, prompt operacional)

**Substitui**: SocratOS, Editor, Analyst, Creator, Profiler atuais (packages/agents/src/)

**Independência**: Sem dependências de WS2 ou WS3.

---

### WS2: Course Creator (Sistema Novo)

**Objetivo**: Implementar sistema completo de criação de cursos baseado na metodologia do benchmark 07_Course_Designer.

**Estado atual**: Não existe como sistema. Existe infraestrutura parcial (content ingestion, organizer agent, blueprint generation).

**Estado alvo**: Plataforma de criação de cursos com metodologia pedagógica algorítmica, micro-learning e geração de áudio.

**Componentes principais**:

#### Core (5 fases de processamento):
1. **ANALYZER**: Input parser, Framework selector (ADDIE/SAM/Action Mapping/Backward Design/etc.), Audience profiler (ZPD + Adult Learning)
2. **ARCHITECT**: Objective generator (ABCD + Bloom + spiral curriculum), Assessment designer (Backward Design), Module sequencer, ELC+ mapper (6 stages)
3. **CALCULATOR**: Duration allocator (attention span), Cognitive load analyzer (Miller 7±2), Chunk size optimizer
4. **VALIDATOR**: Alignment checker (1:1 objective↔assessment), Bloom progression validator, Completeness auditor (Gagné 9 Events), Quality scorecard
5. **GENERATOR**: JSON blueprint builder, Activity recommender, Material specs, Implementation checklist

#### Features adicionais:
- **Ingestão de Material Bruto**: Upload de PDFs, slides, documentos → conversão automática
- **Micro-learning Splitter**: Quebra automática em pílulas de 5-10min
- **Audio-First (Podcast Mode)**: Geração de áudio via TTS (ElevenLabs/OpenAI TTS)
- **ELC+ 6 Stages**: Immerse (18%) → Reflect (12%) → Conceptualize (18%) → Experiment (18%) → Calibrate (12%) → Integrate (22%)
- **Quality Scorecard**: Alignment (30%) + Bloom (20%) + ELC+ (25%) + Duration (15%) + Cognitive Load (10%)

**Benchmarks de referência**:
- `Benchmarks/07_Course_Designer/README.md`
- `Benchmarks/07_Course_Designer/COURSE_DESIGN_METHODOLOGIES_RESEARCH.md`
- `Benchmarks/07_Course_Designer/EXPERIENTIAL_LEARNING_METHODOLOGY.md`
- `Benchmarks/07_Course_Designer/COURSE_DESIGNER_LOGIC_ARCHITECTURE.md`

**Independência**: Sem dependências de WS1. WS3 (role instrutor) é quem vai usar o sistema, mas o Creator pode ser construído independentemente.

---

### WS3: Evolução da Plataforma (Features Complementares)

**Objetivo**: Expandir a plataforma com novos roles, gestão inteligente, avaliação e personalização.

**Estado atual**: Plataforma funcional com 4 roles, áreas, enrollments, analytics básico, biblioteca, multi-tenant.

**Estado alvo**: Ecossistema completo com instrutor, trilhas inteligentes, avaliação automatizada e aprendizado adaptativo.

**Módulos**:

#### A.1 — Role de Instrutor
- Novo role `instructor` no sistema de auth/RBAC
- Permissões: criar cursos, definir trilhas por cargo, atribuir cursos, criar provas
- Público: consultores, líderes de treinamento, RH
- Impacto DB: novo enum value, ~8-10 RLS policies, possível `instructor_assignments`
- **Decisões pendentes**: instrutor por tenant ou cross-tenant? Permissões próprias ou herda de manager?

#### B — Gestão Inteligente de Trilhas (AI Manager)
- Trilhas baseadas em cargo (job_roles + matching IA contra catálogo)
- Recomendação de sequência lógica (agent "Advisor")
- Dashboard preditivo (quem está atrasado, alertas de atenção, sugestão de coaching)
- Depende de: A.1 (instrutor define trilhas)

#### C — Avaliação e Retenção (AI Tutor)
- Gerador de provas formais (novo tipo de sessão "exam")
- Importação de provas antigas para modernização IA
- Correção automatizada com feedback imediato
- Recuperação inteligente (mapeia falha → módulo específico → reforço direcionado)
- Depende parcialmente de: WS1 (motor de avaliação)

#### D — Personalização e Perfil (Adaptive Learning)
- Ingestão de resultados DISC/MBTI reais (CSV/PDF upload)
- Análise coletiva de perfil de equipe (novo agent "Team Profiler")
- Adaptação de linguagem/formato baseada no perfil dominante
- Infraestrutura parcial já existe (Profiler agent integra Big Five, DISC, Enneagram)

#### Infraestrutura de Plugins (Monetização)
- Feature flags no `tenants.plan` ou novo `tenants.plugins` (JSONB)
- Modelo Core + Plugins:
  - Base: gestão de usuários, conteúdo, IA básica
  - Plugin 1: Creator (WS2)
  - Plugin 2: Designer (visual IA — futuro)
  - Plugin 3: Profiler (DISC/MBTI + personalização)
  - Plugin 4: Agent Framework (futuro)

---

## Dependências entre Workstreams

```
WS1 (Motor Socrático)     ← independente
WS2 (Course Creator)      ← independente
WS3 (Evolução Plataforma) ← parcialmente depende de WS1 (módulo C) e WS2 (UI do instrutor)
```

WS1 e WS2 podem ser executados em paralelo ou sequencialmente sem bloqueio mútuo.

---

## Riscos Identificados

| Risco | Impacto | Mitigação |
|---|---|---|
| Novo role `instructor` quebra RLS existentes | Alto | Migração cuidadosa, testes de RLS por role |
| TTS costs escalarem | Médio | Caching agressivo, limites por plan |
| Reformulação socrática regredir qualidade | Alto | A/B testing entre pipeline atual e novo |
| Complexidade de plugins fragmentar UX | Médio | Design system unificado, progressive disclosure |
| Course Designer overengineered | Baixo | Implementar core primeiro, expandir iterativamente |

---

## Próximos Passos

- [x] Criar PRD detalhado para WS1 (Motor Socrático) → `docs/architecture/ws1-motor-socratico-architecture.md` (Ready)
- [x] Criar PRD detalhado para WS2 (Course Creator) → `docs/architecture/ws2-course-creator-architecture.md` (v3.0)
- [x] Criar PRD detalhado para WS3 (Evolução da Plataforma) → `docs/architecture/ws3-platform-evolution-architecture.md` (v1.0)
- [ ] Definir priorização entre workstreams
- [x] Criar épicos e stories para WS1
- [x] Criar épicos e stories para WS3 (Epics 25-29, 128 SP)

---

## Épicos WS1 — Motor Socrático (4 epics, 26 stories, 136 SP)

| Epic | Título | Stories | SP | Status | Referência |
|------|--------|--------:|---:|--------|-----------|
| **16** | Core Agents & Pipeline Socrático | 7 | 35 | Draft | `docs/epics/epic-16-ws1-core-agents-pipeline-socratico.md` |
| **17** | Shadow Analysis Pipeline (Detector + Perfilador) | 6 | 31 | Draft | `docs/epics/epic-17-ws1-shadow-analysis-pipeline.md` |
| **18** | Analytics & Output Analítico Avançado | 7 | 39 | Draft | `docs/epics/epic-18-ws1-analytics-output-analitico.md` |
| **19** | Quality Framework & Testes | 5 | 31 | Draft | `docs/epics/epic-19-ws1-quality-framework-testes.md` |

### Grafo de Dependência dos Epics

```
Epic 16 (Core Pipeline — schemas, prompts, model router, orchestrator v2)
    ↓
    ├── Epic 17 (Shadow Pipeline — detector, perfilador, DB, gestão interações)
    │       ↓
    │       Epic 18 (Analytics — dashboard UC3, perfil UC2, sessão detalhe)
    │
    └── Epic 19 (Quality — fixtures, unit tests, E2E, golden dataset)
```

### Ordem de Execução Sugerida

1. **Epic 16** (Core Pipeline) — fundação: schemas, prompts, model router, orchestrator v2, migração
2. **Epic 17** (Shadow Pipeline) — detector + perfilador + DB + gestão de interações
3. **Epic 19** (Quality) — testes unit + E2E Onda 1 (launch readiness, GO/NO-GO)
4. **Epic 18** (Analytics Frontend) — dashboards e visualizações (após dados fluindo)
5. **Epic 19** (Quality cont.) — E2E Onda 2 + Golden Dataset benchmark
