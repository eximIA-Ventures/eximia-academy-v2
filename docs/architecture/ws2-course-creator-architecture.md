# WS2: Arquitetura — Course Creator (Sistema Multi-Framework de Design Instrucional)

> Status: **v3.0** (Consolidação definitiva — review interativo incorporado)
> Data: 2026-02-16
> Agente: @architect (Aria)
> Supersede: `ws2-review-interativo-v1.md` (decisões D1-D13 incorporadas aqui)
> Referências:
> - `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
> - `Benchmarks/07_Course_Designer/COURSE_DESIGNER_LOGIC_ARCHITECTURE.md`
> - `Benchmarks/07_Course_Designer/COURSE_CREATOR_ANALYSIS.md`
> - `Benchmarks/07_Course_Designer/COURSE_DESIGN_METHODOLOGIES_RESEARCH.md`
> - `Benchmarks/07_Course_Designer/EXPERIENTIAL_LEARNING_METHODOLOGY.md`
> - `Benchmarks/Learning_Design/` (análise multi-framework)

---

## 1. Princípio Fundamental

**Design Instrucional Multi-Framework como First-Class Citizen.**

O Course Creator é um **motor de design instrucional** que permite ao instrutor (ou ao sistema via IA) selecionar e aplicar frameworks pedagógicos reconhecidos. O sistema transforma uma ideia de curso em um **Blueprint Instrucional** completo, aplicando a metodologia escolhida com rigor algorítmico.

Três princípios guiam o design:

1. **"Ao mudar o framework, a pipeline inteira se ajusta automaticamente."** — Zero lógica hardcoded para qualquer framework nos algoritmos (A1-A16). Todos recebem um `FrameworkConfig` e operam genericamente.
2. **"Conteúdo entra como ferramenta de decisão e ação — não como ponto de partida."** — Backward Design: objetivo → avaliação → instrução.
3. **"Neurociência é transversal."** — CLT, AGES, Spaced Repetition se aplicam a qualquer framework como camada de validação independente.

---

## 2. Registro de Decisões

Todas as decisões arquiteturais consolidadas (D1-D17):

| # | Decisão | Escolha | Justificativa |
|---|---------|---------|---------------|
| D1 | Frameworks v1 | **ELC+ 2026, Kolb 4-Stage, PBL (Hmelo-Silver)** | Foco em ciclos experienciais (Tipo A). Tipo B (Backward Design, ADDIE...) adiado para v2+ |
| D2 | Framework Registry | **Extensível via FrameworkConfig** | Cada framework = 1 config plugável. Pipeline nunca tem `if framework === "x"` |
| D3 | UX do Input | **Wizard multi-step 6 camadas + "Preencher com IA"** | Guia instrutores novos, não atrasa experientes |
| D4 | Linguagem | **TypeScript** (monorepo existente) | Consistência com `@eximia/agents`, reusa AI SDK + Zod |
| D5 | Substituição Proxy | **Big Bang — substituir microservice Python por agentes TS** | Lógica é prompt-driven, zero valor em manter Python |
| D6 | Neuroscience Layer | **Camada transversal separada, sempre ativa** | CLT, AGES, Spaced Rep aplicam-se a qualquer framework. Score Final = (Framework × 0.7) + (Neuro × 0.3) |
| D7 | FrameworkConfig | **Interface formal rica** | Define stages, time, interactions, quality, assessment, sequencing, special_requirements |
| D8 | Frameworks Tipo B | **Adiado para v2+** | Backward Design, Action Mapping, ADDIE, SAM operam na macro-estrutura |
| D9 | Modelo de Execução | **Hybrid SSE + DB Fallback** | SSE para progresso real-time + `blueprint_jobs` para estado durável. Zero infra adicional |
| D10 | UX Wizard | **Stepper linear 6 steps + "Preencher com IA"** | Familiar, Pre-validation Gate encaixa como step final |
| D11 | Editabilidade Blueprint | **Edição completa** | Instrutor edita textos, reordena módulos, muda interaction types. Scorecard recalcula ao salvar |
| D12 | Blueprint → Curso (Apply) | **Estrutura + conteúdo IA + perguntas variáveis** | Cria course + chapters (conteúdo IA) + questions (variável por interaction_type). Questions com status=pending |
| D13 | Integração WS1 | **Acoplamento leve — 3 campos opcionais** | `interaction_type`, `bloom_target`, `framework_stage`. Backward-compatible |
| D14 | Quality Gate | **Híbrido** | Auto-retry 1x silencioso. Se ainda falhar, mostra ao instrutor com opções (retry/editar/aceitar) |
| D15 | Content Analyzer | **LLM-only** | PDF nativo do Claude, sem engine de extração adicional |
| D16 | stage_mapped | **Adiado para v2** | Requer extensão WS1 (sessões com stages/transições). Complexo demais para v1 |
| D17 | Interaction Strategy default | **bloom_mapped** | IA decide por módulo baseado em Bloom + spiral level |

### Decisões técnicas complementares

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Padrão de agentes | **5 agentes de fase + 1 orquestrador** | Segue padrão WS1 (Mestre/Polidor/Guardiao) |
| Modelo padrão | **Via Model Router (Epic 16)**: gpt-4.1, DeepSeek V3, Gemini (fallback) | Consistência com WS1, zero Claude em produção. Structured output via `generateObject` + Zod. _(Corrigido: referência stale a claude-sonnet removida — @po validation 2026-02-16)_ |
| Database | **Estender `course_blueprints` existente** | Tabela já existe, adicionar campos de framework e módulos |
| Export | **JSON (v1), PDF (v2)** | JSON para integração; PDF para instrutores (adiado) |
| Problema-Motor | **Gerado por IA** com fórmula de tensão | `Tensão = Pressão × Ambiguidade × Stakes` |

---

## 3. Taxonomia de Frameworks

A análise dos benchmarks revelou **3 tipos fundamentais** de framework que operam em níveis diferentes:

### Tipo A: Frameworks de Ciclo de Aprendizagem (v1)

Definem **como o aluno passa por estágios** dentro de um módulo.

| Framework | Estágios | Foco | Status |
|-----------|---------|------|--------|
| **ELC+ 2026** | 6 (Immerse→Integrate) | Experiencial com calibração | **v1** |
| **Kolb 4-Stage** | 4 (Experience→Experiment) | Experiencial clássico | **v1** |
| **PBL (Hmelo-Silver)** | 4 (Problem→Application) | Problem-first + SDL | **v1** |
| Seven Jump (Maastricht) | 7 (Clarify→Synthesize) | PBL granular | Futuro |

### Tipo B: Frameworks de Design Instrucional (v2+)

Definem **como o curso inteiro é arquitetado** (macro-estrutura).

| Framework | Abordagem | Status |
|-----------|----------|--------|
| Backward Design | Resultado → avaliação → instrução | v2+ |
| Action Mapping | Business goal → comportamento → prática mínima | v2+ |
| ADDIE | Análise → Design → Dev → Implementação → Avaliação | v2+ |
| SAM | Iterativo: prototipar → testar → refinar | v2+ |
| Gagne's 9 Events | 9 eventos de instrução (checklist) | v2+ |
| Merrill's First Principles | Problem-centered, autêntico | v2+ |

### Tipo C: Princípios Neurocientíficos (Transversais — sempre ativos)

Se aplicam a **qualquer framework** como regras de validação.

| Princípio | Regra | Impacto no Pipeline |
|-----------|-------|---------------------|
| **CLT (Sweller)** | Máx 4±1 conceitos novos por bloco | Calculator: chunk_size |
| **AGES (NeuroLeadership)** | Attention <30min, Generation ativa, Emotion, Spacing | Calculator + Validator |
| **Spaced Repetition (Ebbinghaus)** | Revisões 1d, 3d, 7d, 14d, 30d | Generator: schedule |
| **Retrieval Practice (Roediger)** | Quizzes frequentes, recall ativo | Generator: quiz placement |
| **Dual Coding (Paivio)** | Texto + visual integrado | Generator: material specs |
| **12 Princípios Caine & Caine** | Segurança psicológica, significado, unicidade | Validator: environment checks |

---

## 4. Framework Registry

### 4.1. FrameworkConfig — Interface Formal

Cada framework é definido por um único objeto de configuração que toda a pipeline consome:

```typescript
interface FrameworkConfig {
  // Identidade
  id: string;                      // "elc_plus" | "kolb_4" | "pbl_hmelo"
  name: string;                    // "ELC+ 2026" | "Kolb 4-Stage" | "PBL Hmelo-Silver"
  type: "learning_cycle";          // v1 = apenas learning_cycle

  // Estágios do ciclo (core — toda a pipeline opera sobre isso)
  stages: {
    id: string;                    // "immerse" | "experience" | "problem_presentation"
    name: string;                  // "Immerse (Sentir)" | "Concrete Experience"
    description: string;
    time_percentage: number;       // % do tempo total do módulo (soma = 100)
    default_interaction: InteractionType;
    purpose: string;
  }[];

  // Sequenciamento entre módulos
  sequencing: {
    model: "spiral" | "linear" | "problem_complexity";
    levels?: {
      id: string;
      name: string;
      position: "early" | "mid" | "late";
      modules_range: string;
    }[];
    progression_rule: string;      // "bloom_ascending" | "complexity_ascending"
  };

  // Mapeamento Bloom → Interaction (específico por framework)
  bloom_interaction_map: Record<BloomLevel, {
    interaction: InteractionType;
    turns: number;
    depth_range: string;
  }>;

  // Ajustes posicionais (como spiral_level afeta o tipo)
  positional_adjustments: {
    position: "early" | "mid" | "late";
    condition: string;
    action: string;
    rationale: string;
  }[];

  // Critérios de qualidade específicos do framework
  quality_criteria: {
    id: string;
    name: string;
    weight: number;                // 0-100 (soma = 100)
    validation_rule: string;
    failure_message: string;
  }[];

  // Dimensões de avaliação (assessment)
  assessment_dimensions: {
    name: string;
    weight: number;
    levels: string[];
  }[];

  // Requisitos especiais (opcional)
  special_requirements?: {
    group_size?: { min: number; max: number };
    sdl_interval?: string;
    facilitator_role?: string;
    problem_design_framework?: string;
    whiteboard_tool?: boolean;
  };
}
```

### 4.2. ELC+ 2026 — Config

```yaml
id: elc_plus
name: "ELC+ 2026 (Experiential Learning Cycle Extended)"
type: learning_cycle

stages:
  - id: immerse
    name: "Immerse (Sentir)"
    description: "Aluno VIVE o problema antes de saber a teoria"
    time_percentage: 18
    default_interaction: scenario
    purpose: "Experiência concreta com decisão forçada"
  - id: reflect
    name: "Reflect (Observar)"
    description: "Reflexão guiada sobre o que acabou de viver"
    time_percentage: 12
    default_interaction: socratic_dialogue
    purpose: "Meta-cognição sobre a experiência"
  - id: conceptualize
    name: "Conceptualize (Pensar)"
    description: "Framework teórico e conceitos"
    time_percentage: 18
    default_interaction: quiz
    purpose: "Verificar compreensão da teoria"
  - id: experiment
    name: "Experiment (Fazer)"
    description: "Reaplicar COM framework"
    time_percentage: 18
    default_interaction: socratic_dialogue
    purpose: "Prática guiada com novo conhecimento"
  - id: calibrate
    name: "Calibrate (Validar)"
    description: "Feedback e meta-avaliação"
    time_percentage: 12
    default_interaction: socratic_dialogue
    purpose: "Comparar antes/depois, ajustar"
  - id: integrate
    name: "Integrate (Internalizar)"
    description: "Transferência para mundo real"
    time_percentage: 22
    default_interaction: assignment
    purpose: "Entregável concreto + compromisso"

sequencing:
  model: spiral
  levels:
    - { id: fundamentos, name: "Fundamentos", position: early, modules_range: "1-2" }
    - { id: variacao, name: "Variação", position: mid, modules_range: "3-4" }
    - { id: conflito_humano, name: "Conflito Humano", position: mid, modules_range: "5-6" }
    - { id: mundo_real, name: "Mundo Real", position: late, modules_range: "7-8" }
    - { id: sintese, name: "Síntese", position: late, modules_range: "9-10" }
  progression_rule: bloom_ascending

quality_criteria:
  - { id: all_stages, name: "Todos os 6 estágios presentes", weight: 30 }
  - { id: time_balance, name: "Distribuição de tempo ±5%", weight: 20 }
  - { id: bloom_progression, name: "Progressão Bloom ascendente", weight: 25 }
  - { id: objective_alignment, name: "Objetivo ↔ Avaliação 1:1", weight: 15 }
  - { id: spiral_coherence, name: "Coerência spiral curriculum", weight: 10 }

assessment_dimensions:
  - { name: "Knowledge Application", weight: 30, levels: [novice, developing, proficient, expert] }
  - { name: "Experiential Depth", weight: 25, levels: [surface, adequate, deep, transformative] }
  - { name: "Reflection Quality", weight: 20, levels: [superficial, descriptive, analytical, transformative] }
  - { name: "Integration Transfer", weight: 25, levels: [minimal, partial, substantial, complete] }
```

### 4.3. Kolb 4-Stage — Config

```yaml
id: kolb_4
name: "Kolb 4-Stage (Experiential Learning Cycle)"
type: learning_cycle

stages:
  - { id: experience, name: "Concrete Experience (Sentir)", time_percentage: 25, default_interaction: scenario, purpose: "Vivência concreta" }
  - { id: reflect, name: "Reflective Observation (Observar)", time_percentage: 25, default_interaction: socratic_dialogue, purpose: "Reflexão guiada" }
  - { id: conceptualize, name: "Abstract Conceptualization (Pensar)", time_percentage: 25, default_interaction: quiz, purpose: "Conceituação abstrata" }
  - { id: experiment, name: "Active Experimentation (Fazer)", time_percentage: 25, default_interaction: assignment, purpose: "Experimentação ativa" }

sequencing:
  model: linear
  progression_rule: bloom_ascending

quality_criteria:
  - { id: all_stages, name: "Todos os 4 estágios presentes", weight: 35 }
  - { id: time_balance, name: "Distribuição equilibrada (25% cada ±10%)", weight: 20 }
  - { id: bloom_progression, name: "Progressão Bloom ascendente", weight: 25 }
  - { id: objective_alignment, name: "Objetivo ↔ Avaliação 1:1", weight: 20 }
```

### 4.4. PBL (Hmelo-Silver) — Config

```yaml
id: pbl_hmelo
name: "Problem-Based Learning (Hmelo-Silver 4-Phase)"
type: learning_cycle

stages:
  - id: problem_presentation
    name: "Problem Presentation (Problema)"
    description: "Problema complexo, ill-structured, autêntico"
    time_percentage: 15
    default_interaction: scenario
    purpose: "Engajar com problema real ANTES de instrução"
  - id: group_collaboration
    name: "Group Collaboration (Investigação)"
    description: "Identificar o que sabe, o que precisa aprender, gerar hipóteses"
    time_percentage: 25
    default_interaction: socratic_dialogue
    purpose: "Ativação de prior knowledge, elaboração, hipóteses"
  - id: self_directed_learning
    name: "Self-Directed Learning (Pesquisa)"
    description: "Pesquisa independente dos learning issues"
    time_percentage: 35
    default_interaction: assignment
    purpose: "Aluno busca conhecimento autonomamente"
  - id: application_reflection
    name: "Application & Reflection (Aplicação)"
    description: "Aplicar conhecimento ao problema, refletir"
    time_percentage: 25
    default_interaction: socratic_dialogue
    purpose: "Testar hipóteses, resolver, meta-cognição"

sequencing:
  model: problem_complexity
  levels:
    - { id: simple_structured, name: "Problemas Semi-Estruturados", position: early, modules_range: "1-2" }
    - { id: moderate_complex, name: "Problemas Moderados", position: mid, modules_range: "3-5" }
    - { id: ill_structured, name: "Problemas Ill-Structured", position: late, modules_range: "6+" }
  progression_rule: complexity_ascending

quality_criteria:
  - { id: problem_is_REAL, name: "Problemas são REAL (Realistic, Engaging, Aligned, Leads to SDL)", weight: 30 }
  - { id: five_pbl_goals, name: "5 Goals PBL cobertos", weight: 25 }
  - { id: sdl_explicit, name: "Fase SDL explícita em todo módulo", weight: 20 }
  - { id: bloom_progression, name: "Progressão de complexidade", weight: 15 }
  - { id: reflection_present, name: "Reflexão metacognitiva em todo módulo", weight: 10 }

special_requirements:
  group_size: { min: 5, max: 8 }
  sdl_interval: "3-5 days between sessions"
  facilitator_role: "coach"
  problem_design_framework: "REAL"
  whiteboard_tool: true
```

### 4.5. PBL × WS1 — Compatibilidade Natural

O Mestre Socrático do WS1 já é, essencialmente, um facilitador PBL:

| Fase PBL | Comportamento do Mestre WS1 | InteractionType | Turns |
|----------|----------------------------|-----------------|-------|
| Problem Presentation | Apresenta cenário com dilema, trade-offs, decisão forçada | `scenario` | 3-4 |
| Group Collaboration | Questionamento: "O que você já sabe?", "O que precisa descobrir?" | `socratic_dialogue` | 5-6 |
| Self-Directed Learning | Guia pesquisa: "Onde buscaria essa informação?" | `assignment` | 6-8 |
| Application & Reflection | "Como isso resolve o problema original?", "O que faria diferente?" | `socratic_dialogue` | 4-5 |

### 4.6. Framework Selector — Decision Tree (v1)

```
INPUT: project_characteristics

IF instructor_preferred_framework IS SET:
    RETURN instructor_preferred_framework  // Instrutor sempre tem prioridade

IF behavior_change envolve "resolver problemas complexos" OU "tomar decisões":
    RETURN "pbl_hmelo"  // Problem-first, SDL, encaixe natural com WS1

IF total_duration_hours <= 10h AND experience_level != "iniciante":
    RETURN "kolb_4"  // Mais simples, 4 estágios, suficiente para curso curto

DEFAULT:
    RETURN "elc_plus"  // 6 estágios, ciclo completo, máxima retenção
```

---

## 5. Arquitetura Modular de 3 Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1: FRAMEWORK CONFIG (Plugin)                         │
│  Cada framework = 1 FrameworkConfig plugável                 │
│  v1: ELC+ 2026, Kolb 4-Stage, PBL (Hmelo-Silver)           │
│  v2+: Backward Design, Action Mapping, SAM, ADDIE...        │
└──────────────────────────┬──────────────────────────────────┘
                           │ injeta config
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2: PIPELINE CORE (Genérica)                          │
│  Analyzer → Architect → Calculator → Validator → Generator   │
│  Todos os algoritmos recebem framework_config e operam       │
│  genericamente. Nenhum `if framework === "x"` existe.        │
└──────────────────────────┬──────────────────────────────────┘
                           │ valida output
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3: NEUROSCIENCE LAYER (Transversal)                  │
│  Sempre ativa, independente do framework escolhido.          │
│  CLT, AGES, Spaced Repetition, Retrieval Practice,           │
│  Dual Coding — validação baseada em evidência.               │
│                                                              │
│  Score Final = (Framework Quality × 0.7)                     │
│              + (Neuroscience Compliance × 0.3)               │
└─────────────────────────────────────────────────────────────┘
```

### 5.1. Neuroscience Layer — Regras de Validação

| # | Princípio | Regra | Threshold | Peso |
|---|-----------|-------|-----------|------|
| N1 | CLT: Chunk Size | Nenhum módulo tem >5 conceitos novos | Max 4±1 por bloco | 20 |
| N2 | AGES: Attention | Nenhum bloco contínuo >30min sem pausa | Max 25-30min | 15 |
| N3 | AGES: Generation | Todo módulo tem ≥1 atividade de geração ativa | Min 1 atividade | 20 |
| N4 | AGES: Emotion | ≥50% dos módulos têm hook emocional | 50% mínimo | 10 |
| N5 | Spacing | Se total_hours > 4h: schedule de revisão incluído | Obrigatório >4h | 15 |
| N6 | Retrieval | ≥1 quiz formativo (low-stakes) por módulo | Min 1 | 15 |
| N7 | Dual Coding | Material specs incluem componente visual + textual | Sempre | 5 |

**Score Neuroscience (0-100):** Soma dos pesos das regras que passam.

**Score Final:** `(Framework Quality Score × 0.7) + (Neuroscience Score × 0.3)`

| Faixa | Verdict | Ação |
|-------|---------|------|
| 90-100 | excellent | Blueprint aprovado automaticamente |
| 70-89 | good | Aprovado com observações |
| 50-69 | needs_revision | Auto-retry 1x → se falhar, mostra ao instrutor (D14) |
| < 50 | poor | Mostra ao instrutor com opções |

---

## 6. Input Model — Course Design Brief (6 Camadas)

O input é organizado em 6 camadas. Cada uma alimenta algoritmos específicos do pipeline.

### 6.1. Camada 1: Propósito — "Por que este curso existe?"

| Campo | O que é | Obrigatório | Quem usa no pipeline |
|-------|---------|-------------|---------------------|
| `course_title` | Nome do curso | Sim | Metadata do blueprint |
| `business_goal` | O que muda na **organização** | Sim | A2 (Framework Selector) |
| `behavior_change` | O que o aluno **faz diferente** no dia-a-dia | Sim | A4 (Objective Generator), Problema-Motor |
| `success_metrics` | Como a empresa vai **medir** resultado (Kirkpatrick L3-L4) | Não | A5 (Assessment Designer) |
| `problem_statement` | O **sintoma** que motivou o curso | Não | Problema-Motor Generator |

**`business_goal` ≠ `behavior_change`** (Action Mapping de Cathy Moore): goal = organização, behavior = indivíduo.

### 6.2. Camada 2: Audiência — "Para quem é este curso?"

| Campo | O que é | Obrigatório | Quem usa no pipeline |
|-------|---------|-------------|---------------------|
| `role` | Cargo/papel profissional | Sim | A3 — infere Kolb style |
| `experience_level` | `iniciante`, `intermediario`, `avancado`, `especialista` | Sim | A3 — calcula ZPD |
| `prior_knowledge` | O que já sabe (tags ou frases) | Não | A3 — Gap Analysis |
| `group_size` | Alunos por turma | Não | A16 — filtra atividades viáveis |
| `motivation_context` | Por que vão fazer o curso | Não | A3 — Andragogia profile |
| `learning_environment` | `presencial`, `remoto`, `hibrido` | Não | A16 — filtra atividades |
| `autonomy_level` | `guiado`, `semi_autonomo`, `autonomo` | Não | A7 — nível de scaffolding |

**ZPD (A3):**

```
experience_level    →  Faz sozinho (Bloom)        Faz com ajuda
────────────────────────────────────────────────────────────
iniciante           →  Remember, Understand        Apply
intermediario       →  Remember...Apply            Analyze
avancado            →  Remember...Analyze          Evaluate, Create
especialista        →  Todos                       Create (novos contextos)
```

### 6.3. Camada 3: Escopo & Conteúdo — "O que precisa ser coberto?"

| Campo | O que é | Obrigatório | Quem usa |
|-------|---------|-------------|----------|
| `core_competencies` | Competências que o aluno domina ao final | Não* | A4 — transforma em objetivos ABCD |
| `topics_outline` | Tópicos que o instrutor quer cobrir | Não* | A6 — base para módulos |
| `content_density` | `lean`, `moderada`, `densa` | Não | A10 — lean = mais atividades |
| `assessment_preference` | `formativa`, `somativa`, `mista` | Não | A5 — tipo de avaliação |
| `context_files` | PDFs, PPTX, DOCX do instrutor | Não* | Content Analyzer (LLM-only, D15) |
| `existing_materials_summary` | Descrição textual do que já existe | Não | Gap Analysis |
| `source_course_id` | UUID de curso existente (Caminho B) | Não* | Auditor — extrai estrutura atual |

\* Ao menos 1 fonte: `core_competencies`, `topics_outline`, `context_files` ou `source_course_id`.

### 6.4. Camada 4: Restrições — "Dentro de quais limites?"

| Campo | O que é | Obrigatório | Quem usa |
|-------|---------|-------------|----------|
| `total_duration_hours` | Tempo total em horas | Sim* | A8 (Duration Allocator) |
| `weeks` | Duração em semanas | Não | A8 — define pacing |
| `hours_per_week` | Horas por semana | Não | A8 — calcula total se não informado |
| `delivery_mode` | `presencial`, `online_sync`, `online_async`, `hibrido` | Não | A16 — filtra atividades viáveis |
| `cohort_based` | Turma progride junta? | Não | A16 — habilita atividades sociais |
| `session_length_preference` | Duração preferida por sessão (min) | Não | A10 — chunk máximo |

\* Obrigatório diretamente ou calculado de `weeks × hours_per_week`.

**Duração → Escopo:**

```
total_hours    módulos estimados    Bloom máximo
──────────────────────────────────────────────
1-4h           1-2 módulos          Apply
4-10h          3-5 módulos          Analyze
10-40h         5-10 módulos         Evaluate
40-100h        10-20 módulos        Create
100-200h       20-30 módulos        Create+
```

### 6.5. Camada 5: Preferências de Design

| Campo | Opções | Default | Quem usa |
|-------|--------|---------|----------|
| `framework` | `elc_plus`, `kolb_4`, `pbl_hmelo`, `auto` | `auto` | A2 (Framework Selector) |
| `interaction_strategy` | `bloom_mapped`, `dominant`, `custom` | `bloom_mapped` (D17) | A7 + Gerador de Interações |
| `language` | `pt-br`, `en` | `pt-br` | Todos os prompts |

**Nota:** `stage_mapped` adiado para v2 (D16).

### 6.6. Camada 6: Pre-validation Gate

Antes de enviar ao pipeline, o sistema valida se os dados são suficientes.

**Checks obrigatórios (bloqueiam geração):**

| Check | Regra | Mensagem se falhar |
|-------|-------|-------------------|
| Propósito mínimo | `business_goal` OU `behavior_change` preenchido | "Defina pelo menos o objetivo de negócio ou a mudança de comportamento" |
| Audiência mínima | `role` E `experience_level` preenchidos | "Defina o público-alvo e seu nível de experiência" |
| Duração mínima | `total_duration_hours >= 1` | "Defina a duração do curso (mínimo 1 hora)" |
| Fonte de conteúdo | Ao menos 1 de: `core_competencies`, `topics_outline`, `context_files`, `source_course_id` | "Forneça pelo menos uma fonte de conteúdo" |

**Checks de qualidade (warnings — não bloqueiam):**

| Check | Regra | Warning |
|-------|-------|---------|
| Goal sem verbo | `business_goal` não contém verbo de ação | "Reformule com verbo de ação (ex: 'Reduzir...', 'Aumentar...')" |
| Duração curta | `total_duration_hours < 4` | "Cursos abaixo de 4h geram blueprints limitados (máx 2 módulos)" |
| Sem contexto externo | Nenhum `context_files` e nenhum `topics_outline` | "Sem material de referência, resultado pode ser genérico" |
| Grupo grande sem cohort | `group_size > 50` e `cohort_based != true` | "Considere ativar cohort para peer review" |
| Sem métricas | `success_metrics` vazio | "Adicionar métricas melhora as avaliações (Kirkpatrick L3-L4)" |

**Brief Score (0-100):**

```
course_title:          5 pts     business_goal:        10 pts
behavior_change:      10 pts     success_metrics:       5 pts
problem_statement:     5 pts     role:                  8 pts
experience_level:      8 pts     prior_knowledge:       4 pts
group_size:            2 pts     motivation_context:    3 pts
core_competencies:    10 pts     total_duration_hours:  8 pts
delivery_mode:         4 pts     cohort_based:          3 pts
framework:             3 pts     interaction_strategy:  2 pts
                               ────
                               Total: 100 pts

90-100: Excelente   70-89: Bom   50-69: Suficiente   <50: Mínimo
```

### 6.7. Input Schema (TypeScript)

```typescript
// schemas/input.ts
export const courseDesignerInputSchema = z.object({
  // Camada 1: Propósito
  course_title: z.string().min(5).max(200),
  business_goal: z.string().min(10).max(1000),
  behavior_change: z.string().min(10).max(1000),
  success_metrics: z.array(z.string()).optional(),
  problem_statement: z.string().max(2000).optional(),

  // Camada 2: Audiência
  target_audience: z.object({
    role: z.string().min(3),
    experience_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
    prior_knowledge: z.array(z.string()).optional(),
    group_size: z.number().min(1).max(500).optional(),
    motivation_context: z.string().optional(),
    learning_environment: z.enum(["presencial", "remoto", "hibrido"]).optional(),
    autonomy_level: z.enum(["guiado", "semi_autonomo", "autonomo"]).optional(),
  }),

  // Camada 3: Escopo
  core_competencies: z.array(z.string()).optional(),
  topics_outline: z.array(z.string()).optional(),
  content_density: z.enum(["lean", "moderada", "densa"]).optional(),
  assessment_preference: z.enum(["formativa", "somativa", "mista"]).optional(),
  context_files: z.array(z.object({
    name: z.string(),
    type: z.enum(["pdf", "pptx", "docx", "txt"]),
    content_summary: z.string().optional(), // Preenchido pelo Content Analyzer
  })).optional(),
  existing_materials_summary: z.string().max(5000).optional(),
  source_course_id: z.string().uuid().optional(), // Caminho B

  // Camada 4: Restrições
  total_duration_hours: z.number().min(1).max(200),
  constraints: z.object({
    weeks: z.number().optional(),
    hours_per_week: z.number().optional(),
    delivery_mode: z.enum(["presencial", "online_sync", "online_async", "hibrido"]).optional(),
    cohort_based: z.boolean().optional(),
    session_length_preference: z.number().min(15).max(240).optional(),
  }).optional(),

  // Camada 5: Preferências
  framework: z.enum(["elc_plus", "kolb_4", "pbl_hmelo", "auto"]).default("auto"),
  interaction_strategy: z.enum(["bloom_mapped", "dominant", "custom"]).default("bloom_mapped"),
  dominant_interaction_type: z.enum([
    "socratic_dialogue", "quiz", "scenario", "assignment",
  ]).optional(), // Só usado se interaction_strategy === "dominant"
  language: z.enum(["pt-br", "en"]).default("pt-br"),
})
```

---

## 7. Os Dois Caminhos do Instrutor

### 7.1. Visão Geral

```
CAMINHO A: Novo Curso                    CAMINHO B: Recriar Curso Existente
─────────────────────                    ──────────────────────────────────
Instrutor cria do zero                   Instrutor tem curso no Academy
(opcionalmente com materiais)            que quer melhorar/reestruturar
    │                                        │
    │                                        ▼
    │                                    SELETOR DE CURSO
    │                                    (lista cursos do tenant)
    │                                        │
    │                                        ▼
    │                                    AUDITOR
    │                                    (extrai + analisa curso existente)
    │                                        │
    │                                        ▼
    │                                    PRÉ-PREENCHE CAMADAS 1-4
    │                                        │
    ▼                                        ▼
┌──────────────────────────────────────────────────────────┐
│               WIZARD DE INPUT (6 Camadas)                │
└───────────────────────────────┬──────────────────────────┘
                                │
                                ▼
                     PIPELINE DE 5 FASES
                                │
                                ▼
                          BLUEPRINT
```

### 7.2. Caminho A: Variantes

| Variante | Descrição | Campos-chave |
|----------|-----------|-------------|
| **A1: Do zero puro** | Preenche tudo manualmente | Camadas 1-5 |
| **A2: Com materiais** | Upload de PDFs/slides → Content Analyzer (LLM, D15) extrai tópicos | `context_files` preenchido |
| **A3: Quick fill** | Só título + público + duração → botão "Preencher com IA" | Mínimo obrigatório |

### 7.3. Caminho B: Recriar Curso Existente

**Fluxo:**
1. Instrutor seleciona "Recriar curso existente"
2. Seletor mostra cursos do tenant (título, N chapters, N questions, status)
3. **Auditor** analisa o curso selecionado
4. Sistema pré-preenche camadas 1-4 com dados extraídos
5. Instrutor ajusta e completa
6. Pipeline roda com contexto enriquecido

### 7.4. Auditor — Framework de Análise de Curso Existente

| Passo | Nome | Output |
|-------|------|--------|
| 1 | Extração Estrutural | `existing_course_structure` (chapters, questions, content normalizado) |
| 2 | Análise de Conteúdo | `content_analysis` (temas, conceitos, Bloom atual) |
| 3 | Auditoria de Qualidade | `quality_audit` (Score 0-100 nas 5 dimensões) |
| 4 | Gap Identification | `gap_report` (estado atual vs. best practices) |
| 5 | Preservation Map | Classifica cada elemento: MANTER, REORGANIZAR, MELHORAR, DESCARTAR |
| 6 | Plano de Melhoria | Recomendações priorizadas |
| 7 | Feed para Pipeline | `enriched_input` (empacotado para as 5 fases) |

**Status:** Framework definido, implementação em Epic 23 (Integração).

---

## 8. Pipeline de 5 Fases (16 Algoritmos)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COURSE DESIGN BRIEF (6 Camadas)                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                     ORQUESTRADOR DE DESIGN                           │
│          Hybrid SSE + DB Fallback (D9). Timeout: 5min.               │
│          Retry: auto 1x silencioso → se falhar, mostra ao           │
│          instrutor com opções (D14).                                 │
└──┬───────────┬───────────┬───────────┬───────────┬──────────────────┘
   │           │           │           │           │
   ▼           ▼           ▼           ▼           ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│FASE 1  │  │FASE 2  │  │FASE 3  │  │FASE 4  │  │FASE 5  │
│ANALYZER│→ │ARCHITECT│→ │CALCULA-│→ │VALIDA- │→ │GENERA- │
│        │  │        │  │  TOR   │  │  TOR   │  │  TOR   │
│3 algos │  │4 algos │  │3 algos │  │4+neuro │  │2 algos │
└────────┘  └────────┘  └────────┘  └────────┘  └────────┘
                                                    │
                                                    ▼
                                    ┌────────────────────────────┐
                                    │       BLUEPRINT             │
                                    │  (JSON completo no DB)      │
                                    └──────────┬─────────────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         ▼                     ▼                     ▼
                ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
                │  ORGANIZER   │    │     CREATOR       │    │   ENRICHER   │
                │(se tem PDF)  │    │(gerar perguntas)  │    │(fontes ext.) │
                └──────────────┘    └──────────────────┘    └──────────────┘
```

### 8.1. Os 16 Algoritmos por Fase

| Fase | # | Algoritmo | Descrição |
|------|---|-----------|-----------|
| **1. Analyzer** | A1 | Input Parser & Validator | Valida e normaliza input |
| | A2 | **Framework Selector** | Decision tree: seleciona framework (§4.6) |
| | A3 | Audience Profiler | ZPD, motivação, Kolb style, andragogia |
| **2. Architect** | A4 | Objective Generator | Bloom Taxonomy (6 níveis) + ABCD format |
| | A5 | Assessment Designer | Backward Design: avaliação antes do conteúdo |
| | A6 | Module Sequencer | Prerequisites, spiral curriculum, progressão |
| | A7 | **Framework Mapper** | Aplica estágios do framework a cada módulo |
| **3. Calculator** | A8 | Duration Allocator | Distribui tempo entre módulos e estágios |
| | A9 | Cognitive Load Analyzer | Sweller CLT, intrinsic/extraneous/germane |
| | A10 | Chunk Optimizer | Miller 7±2, chunks de 5-15min |
| **4. Validator** | A11 | Alignment Checker | 1:1 objetivo ↔ avaliação |
| | A12 | Bloom Progression Validator | Sem drops > 1 nível |
| | A13 | Completeness Auditor | Completude do framework selecionado |
| | A14 | **Quality Scorecard** | Score composto: (Framework × 0.7) + (Neuro × 0.3) |
| **5. Generator** | A15 | Blueprint Builder | JSON final consolidado |
| | A16 | Activity Recommender | Atividades do ACTIVITY_BANK por estágio |

### 8.2. Schemas dos Agentes

#### Analyzer Output (Fase 1)

```typescript
export const analyzerOutputSchema = z.object({
  selected_framework: z.object({
    primary: frameworkId,
    complementary: z.array(frameworkId),
    rationale: z.string(),
    was_user_selected: z.boolean(),
    recommendation_confidence: z.number(),
  }),
  audience_profile: z.object({
    zpd_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
    motivation_type: z.enum(["intrinseca", "extrinseca", "mista"]),
    prior_knowledge_summary: z.string(),
    learning_preferences: z.array(z.string()),
    attention_span_minutes: z.number().min(5).max(120),
    adult_learning_profile: z.object({
      self_directed: z.boolean(),
      experience_based: z.boolean(),
      problem_oriented: z.boolean(),
      immediate_application: z.boolean(),
    }),
    kolb_style: z.enum(["diverging", "assimilating", "converging", "accommodating"]).optional(),
  }),
  gap_analysis: z.object({
    current_state: z.string(),
    desired_state: z.string(),
    critical_gaps: z.array(z.string()),
    estimated_modules: z.number().min(1).max(30),
  }),
  recommendations: z.array(z.string()),
})
```

#### Architect Output (Fase 2)

```typescript
export const frameworkStageSchema = z.object({
  key: z.string(),
  name: z.string(),
  percentage: z.number(),
  activities: z.array(z.string()),
  deliverable: z.string().optional(),
})

export const moduleSchema = z.object({
  order: z.number().min(1),
  title: z.string(),
  description: z.string(),
  spiral_level: z.enum(["fundamentos", "variacao", "conflito_humano", "mundo_real", "sintese"]),
  objectives: z.array(z.object({
    text: z.string(),
    bloom_level: z.enum(["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"]),
    abcd: z.object({
      audience: z.string(),
      behavior: z.string(),
      condition: z.string(),
      degree: z.string(),
    }),
  })).min(1).max(7),
  assessments: z.array(z.object({
    type: z.enum(["formativa", "somativa", "diagnostica"]),
    method: z.string(),
    description: z.string(),
    alignment: z.string(),
    kirkpatrick_level: z.number().min(1).max(4),
  })).min(1),
  framework_stages: z.array(frameworkStageSchema),
  problema_motor: z.object({
    title: z.string(),
    context: z.string(),
    role: z.string(),
    tension: z.string(),
    mission: z.string(),
    constraints: z.array(z.string()),
    deliverable: z.string(),
    tension_formula: z.object({
      pressure: z.number().min(1).max(5),
      ambiguity: z.number().min(1).max(5),
      stakes: z.number().min(1).max(5),
    }),
  }).nullable(),
  rubrics: z.array(z.object({
    criterion: z.string(),
    level_0: z.string(),
    level_1: z.string(),
    level_2: z.string(),
  })).nullable(),
  interaction_type: z.enum(["socratic_dialogue", "quiz", "scenario", "assignment"]),
  prerequisites: z.array(z.number()).optional(),
})

export const architectOutputSchema = z.object({
  course_structure: z.object({
    total_modules: z.number(),
    primary_framework: frameworkId,
    complementary_frameworks: z.array(frameworkId),
    bloom_progression: z.array(z.string()),
    spiral_levels: z.number().min(1).max(5),
  }),
  modules: z.array(moduleSchema).min(1).max(30),
  assessment_strategy: z.object({
    formative_count: z.number(),
    summative_count: z.number(),
    diagnostica_count: z.number(),
    overall_approach: z.string(),
    kirkpatrick_coverage: z.object({
      level_1_reaction: z.boolean(),
      level_2_learning: z.boolean(),
      level_3_behavior: z.boolean(),
      level_4_results: z.boolean(),
    }),
  }),
  facilitation_notes: z.string().optional(),
})
```

#### Calculator Output (Fase 3)

```typescript
export const calculatorOutputSchema = z.object({
  time_allocation: z.object({
    total_minutes: z.number(),
    modules: z.array(z.object({
      module_order: z.number(),
      total_minutes: z.number(),
      per_stage: z.record(z.string(), z.number()),
      chunks: z.array(z.object({
        title: z.string(),
        duration_min: z.number().min(5).max(30),
        type: z.enum(["content", "activity", "assessment", "break", "reflection"]),
      })),
    })),
    attention_span_respected: z.boolean(),
  }),
  cognitive_load: z.object({
    modules: z.array(z.object({
      module_order: z.number(),
      intrinsic_load: z.enum(["low", "medium", "high"]),
      extraneous_load: z.enum(["low", "medium", "high"]),
      germane_load: z.enum(["low", "medium", "high"]),
      new_concepts_count: z.number(),
      concurrent_concepts: z.number(),
      recommendation: z.string(),
    })),
    overall_balance: z.enum(["optimal", "adjustable", "overloaded"]),
    warnings: z.array(z.string()),
  }),
  pacing_strategy: z.object({
    recommended_schedule: z.string(),
    spaced_repetition_points: z.array(z.string()),
    break_pattern: z.string(),
  }),
})
```

#### Validator Output (Fase 4)

```typescript
export const qualityScorecardSchema = z.object({
  // Framework Quality (70% do score final)
  framework_score: z.object({
    total: z.number().min(0).max(100),
    dimensions: z.object({
      alignment: z.object({ score: z.number(), weight: z.literal(0.30), details: z.string(), issues: z.array(z.string()) }),
      bloom_progression: z.object({ score: z.number(), weight: z.literal(0.20), details: z.string(), issues: z.array(z.string()) }),
      framework_completeness: z.object({
        score: z.number(), weight: z.literal(0.25), details: z.string(), issues: z.array(z.string()),
        framework_used: frameworkId, stages_covered: z.array(z.string()), stages_missing: z.array(z.string()),
      }),
      duration: z.object({ score: z.number(), weight: z.literal(0.15), details: z.string(), issues: z.array(z.string()) }),
      cognitive_load: z.object({ score: z.number(), weight: z.literal(0.10), details: z.string(), issues: z.array(z.string()) }),
    }),
  }),
  // Neuroscience Score (30% do score final)
  neuroscience_score: z.object({
    total: z.number().min(0).max(100),
    rules: z.array(z.object({
      id: z.string(),       // "N1", "N2", etc.
      name: z.string(),
      passed: z.boolean(),
      weight: z.number(),
      details: z.string(),
    })),
  }),
  // Score Final Composto
  final_score: z.number().min(0).max(100),
  verdict: z.enum(["excellent", "good", "needs_revision", "poor"]),
  critical_issues: z.array(z.string()),
  recommendations: z.array(z.string()),
})
```

#### Blueprint Schema (Fase 5 — output final)

```typescript
export const blueprintSchema = z.object({
  metadata: z.object({
    title: z.string(),
    version: z.literal("3.0"),
    generated_at: z.string(),
    primary_framework: frameworkId,
    complementary_frameworks: z.array(frameworkId),
    total_duration_hours: z.number(),
    total_modules: z.number(),
    quality_score: z.number(),
    neuroscience_score: z.number(),
    language: z.string(),
    interaction_strategy: z.string(),
  }),
  audience: z.object({
    role: z.string(),
    experience_level: z.string(),
    zpd_level: z.string(),
    motivation_type: z.string(),
    kolb_style: z.string().optional(),
    adult_learning_profile: z.object({
      self_directed: z.boolean(),
      experience_based: z.boolean(),
      problem_oriented: z.boolean(),
      immediate_application: z.boolean(),
    }),
  }),
  course_architecture: z.object({
    bloom_progression: z.array(z.string()),
    spiral_curriculum: z.object({
      levels: z.number(),
      progression: z.array(z.string()),
    }),
  }),
  modules: z.array(z.object({
    order: z.number(),
    title: z.string(),
    description: z.string(),
    duration_minutes: z.number(),
    spiral_level: z.string(),
    objectives: z.array(z.object({
      text: z.string(),
      bloom_level: z.string(),
      abcd: z.object({ audience: z.string(), behavior: z.string(), condition: z.string(), degree: z.string() }),
    })),
    framework_stages: z.array(z.object({
      key: z.string(), name: z.string(), percentage: z.number(), duration_minutes: z.number(),
      activities: z.array(z.string()), deliverable: z.string().optional(), facilitator_script: z.string().optional(),
    })),
    problema_motor: z.object({
      title: z.string(), context: z.string(), role: z.string(), tension: z.string(),
      mission: z.string(), constraints: z.array(z.string()), deliverable: z.string(), tension_score: z.number(),
    }).nullable(),
    assessments: z.array(z.object({
      type: z.string(), method: z.string(), description: z.string(), alignment: z.string(), kirkpatrick_level: z.number(),
    })),
    rubrics: z.array(z.object({ criterion: z.string(), level_0: z.string(), level_1: z.string(), level_2: z.string() })).nullable(),
    chunks: z.array(z.object({ title: z.string(), duration_min: z.number(), type: z.string() })),
    interaction_type: z.string(),
  })),
  evaluation_plan: z.object({
    kirkpatrick: z.object({
      level_1: z.object({ method: z.string(), timing: z.string() }),
      level_2: z.object({ method: z.string(), timing: z.string() }),
      level_3: z.object({ method: z.string(), timing: z.string() }),
      level_4: z.object({ method: z.string(), timing: z.string() }),
    }),
  }),
  quality_scorecard: qualityScorecardSchema,
  implementation_checklist: z.array(z.object({
    item: z.string(),
    priority: z.enum(["must", "should", "could"]),
  })),
})
```

---

## 9. Framework de Geração de Interações

O WS1 suporta 4 tipos de interação:

| Tipo | Turns default | Comportamento do Mestre |
|------|---------------|------------------------|
| `socratic_dialogue` | 20 | Perguntas abertas, 7 camadas de profundidade, nunca dá respostas |
| `quiz` | 8 | Verificação: múltipla escolha, V/F, resposta curta, feedback imediato |
| `scenario` | 12 | Caso prático com dilema e trade-offs, aluno decide e defende |
| `assignment` | 15 | Guia criação de entregável concreto, feedback sobre artefato |

### 9.1. Estratégia `bloom_mapped` (Default — D17)

A IA atribui automaticamente o tipo de interação por módulo, baseado no Bloom + spiral level.

**Mapeamento Bloom → Interaction:**

| Bloom Level | Interaction Type | Turns | Depth | Justificativa |
|-------------|-----------------|-------|-------|---------------|
| Remember | quiz | 8 | "1"-"2" | Recordar fatos. Quiz direto é eficiente |
| Understand | quiz | 8 | "2"-"3" | Compreensão. "Explique com suas palavras" |
| Apply | socratic_dialogue | 20 | "3"-"4" | Profundidade começa. Guia aplicação sem dar respostas |
| Analyze | socratic_dialogue | 20 | "4"-"5" | Decompor, comparar, identificar padrões |
| Evaluate | scenario | 12 | "5"-"6" | Julgar, defender posição, pesar trade-offs |
| Create | assignment | 15 | "6"-"7" | Produzir algo novo. Entregável concreto |

**Ajustes por spiral_level:**

| Spiral Level | Regra de Ajuste |
|-------------|-----------------|
| fundamentos (1-2) | Se Bloom >= Analyze: manter socratic (cedo demais para scenario) |
| variação (3-4) | Sem ajuste |
| conflito_humano (5-6) | Se Bloom == Apply: upgrade para scenario (trade-offs humanos) |
| mundo_real (7-8) | Se Bloom <= Analyze: upgrade para scenario (contexto real) |
| síntese (9-10) | FORÇAR assignment (entregável final obrigatório) |

### 9.2. Estratégia `dominant`

Instrutor escolhe UM tipo para todo o curso. Simples, experiência uniforme. Melhor para cursos curtos (1-4h).

### 9.3. Estratégia `custom`

Pipeline gera com `bloom_mapped`, depois instrutor edita módulo a módulo no Blueprint Viewer. Scorecard recalcula automaticamente.

### 9.4. Estratégia `stage_mapped` (v2 — D16)

Cada estágio ELC+ dentro de um módulo recebe seu próprio interaction type. Requer extensão do WS1 para sessões com transições entre estágios. Diferencial de produto máximo, mas complexidade alta.

---

## 10. Orquestrador de Design

### 10.1. Modelo de Execução: Hybrid SSE + DB Fallback (D9)

```
Instrutor clica "Gerar Blueprint"
    │
    ▼
POST /api/course-designer/generate
    │
    ├─ Cria blueprint_generation_job (status: "processing")
    ├─ Inicia SSE stream para progresso real-time
    │
    ▼
[Fase 1: Analyzer]  → SSE: {phase: 1, status: "running"}
[Fase 2: Architect]  → SSE: {phase: 2, status: "running"}
[Fase 3: Calculator] → SSE: {phase: 3, status: "running"}
[Fase 4: Validator]  → SSE: {phase: 4, status: "running"}
[Fase 5: Generator]  → SSE: {phase: 5, status: "running"}
    │
    ▼
SSE: {status: "completed", blueprint_id: "uuid"}

Se instrutor sair e voltar:
    → GET /api/course-designer/jobs/[jobId]
    → Retorna estado do DB (phase_results JSONB)
```

**Tabela `blueprint_jobs`:** Contém `phase_results` JSONB para retry parcial e resiliência.

### 10.2. Quality Gate: Híbrido (D14)

```typescript
export async function designCourse(input: CourseDesignerInput): Promise<Blueprint> {
  const analysis = await runAnalyzer(input)
  let architecture = await runArchitect({ ...input, analysis })
  let calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
  let validation = await runValidator({ analysis, architecture, calculations })

  // Auto-retry 1x silencioso (D14)
  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    architecture = await runArchitect({
      ...input, analysis,
      revision_feedback: validation.scorecard.recommendations,
    })
    calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
    validation = await runValidator({ analysis, architecture, calculations })
  }

  // Se ainda falhar após retry: retorna com flag para instrutor decidir
  const blueprint = await runGenerator({ analysis, architecture, calculations, validation })

  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    blueprint.metadata.requires_instructor_review = true
    blueprint.metadata.review_reason = validation.scorecard.recommendations
  }

  return blueprint
}
```

**Timeout total:** 5 minutos. Upgrade path para Inngest se pipeline > 800s.

---

## 11. Contrato WS2 → WS1 (D13)

Acoplamento leve — 3 campos opcionais, backward-compatible.

### 11.1. courses.settings

```json
{
  "tenantPlan": "pro",
  "interactionConfig": {
    "max_interactions": 20,
    "configured_by": "blueprint",
    "type_defaults": {
      "socratic_dialogue": 20,
      "quiz": 8,
      "scenario": 12,
      "assignment": 15
    },
    "smart_closing": {
      "enabled": true,
      "min_interactions_before": 5,
      "depth_threshold": 6,
      "insights_threshold": 2,
      "remaining_threshold": 5
    }
  },
  "blueprint_id": "uuid-do-blueprint",
  "primary_framework": "elc_plus"
}
```

### 11.2. chapters (1 per módulo do blueprint)

| Campo | Vem de |
|-------|--------|
| `title` | Blueprint module.title |
| `content` | Module description + framework_stages (markdown com placeholders [ADICIONAR CONTEÚDO]) |
| `learningObjective` | module.objectives[0].text |
| `order` | module.order |

### 11.3. questions (variável por interaction_type — D12)

| interaction_type | Questions geradas | Status |
|-----------------|-------------------|--------|
| socratic_dialogue | 3-5 perguntas | pending |
| quiz | 5-8 perguntas | pending |
| scenario | 2-3 cenários | pending |
| assignment | 1-2 assignments | pending |

Todas com `status=pending` — manager revisa antes de ativar.

### 11.4. Bloom → expectedDepth

```
Bloom Level       expectedDepth    Camadas WS1
──────────────────────────────────────────────
Remember     →    "1"-"2"          Fatos, Emoções
Understand   →    "2"-"3"          Emoções, Significado
Apply        →    "3"-"4"          Significado, Padrões
Analyze      →    "4"-"5"          Padrões, Origem
Evaluate     →    "5"-"6"          Origem, Identidade
Create       →    "6"-"7"          Identidade, Transcendência
```

---

## 12. Blueprint Editability (D11)

Após geração, o instrutor pode:
- Editar textos (títulos, descrições, objetivos)
- Reordenar, adicionar ou remover módulos
- Mudar interaction_type de cada módulo
- Ajustar durações
- Editar problemas-motor

**Ao salvar:** Quality Scorecard recalcula automaticamente (chamada ao Validator). Se mudanças degradam qualidade, mostra warning com score anterior vs. novo.

---

## 13. Content Analyzer (D15)

**Abordagem:** LLM-only — envia arquivo direto ao Claude (PDF support nativo).

```
Instrutor faz upload de PDFs/PPTX
    │
    ▼
Content Analyzer (Claude com PDF nativo)
    │
    ├─ Extrai texto e identifica tópicos
    ├─ Detecta estrutura (capítulos, seções)
    ├─ Estima nível Bloom do conteúdo
    └─ Gera content_summary estruturado
    │
    ▼
Pré-preenche: topics_outline, core_competencies sugeridas
Instrutor revisa, aceita, edita ou descarta
```

Sem dependência externa — zero engine de extração adicional.

---

## 14. UX: Wizard de 6 Steps (D10)

```
Step 1: Propósito       → business_goal, behavior_change, title
Step 2: Audiência        → role, experience_level, group_size, motivation
Step 3: Escopo           → competencies, topics, upload files, ou selecionar curso existente
Step 4: Restrições       → duration, weeks, delivery_mode, cohort
Step 5: Preferências     → framework selector (3 opções + auto), interaction_strategy
Step 6: Pre-validation   → Brief Score, checks, warnings, botão "Gerar Blueprint"
```

**Botão "Preencher com IA":** Disponível em cada step. Completa campos vazios baseado nos já preenchidos.

---

## 15. Modelo de Dados (Database)

### 15.1. Extensão das Tabelas Existentes

```sql
-- Migration: extend_blueprints_for_ws2.sql

ALTER TABLE course_blueprints
  ADD COLUMN IF NOT EXISTS primary_framework text,
  ADD COLUMN IF NOT EXISTS complementary_frameworks text[],
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS neuroscience_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS quality_verdict text
    CHECK (quality_verdict IN ('excellent', 'good', 'needs_revision', 'poor')),
  ADD COLUMN IF NOT EXISTS audience_profile jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_plan jsonb,
  ADD COLUMN IF NOT EXISTS interaction_strategy text DEFAULT 'bloom_mapped',
  ADD COLUMN IF NOT EXISTS source_course_id uuid REFERENCES courses(id),
  ADD COLUMN IF NOT EXISTS version text DEFAULT '3.0';

CREATE TABLE IF NOT EXISTS blueprint_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES course_blueprints(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "order" integer NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL,
  spiral_level text,
  interaction_type text NOT NULL
    CHECK (interaction_type IN ('socratic_dialogue', 'quiz', 'scenario', 'assignment')),
  framework_stages jsonb NOT NULL,
  problema_motor jsonb,
  cognitive_load jsonb,
  chunks jsonb,
  rubrics jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blueprint_id, "order")
);

ALTER TABLE blueprint_objectives
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES blueprint_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS abcd jsonb;

ALTER TABLE blueprint_assessments
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES blueprint_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kirkpatrick_level integer,
  ADD COLUMN IF NOT EXISTS rubrics jsonb;

-- RLS
ALTER TABLE blueprint_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON blueprint_modules
  FOR ALL USING (tenant_id = auth_tenant_id());
CREATE POLICY "Manager/Admin access" ON blueprint_modules
  FOR ALL USING (auth_user_role() IN ('manager', 'admin'));

CREATE INDEX idx_blueprint_modules_blueprint ON blueprint_modules(blueprint_id);
```

### 15.2. Fluxo de Dados

```
CourseDesignerInput (wizard 6 steps)
    ↓
course_blueprints (status: "generating")
    ↓
blueprint_generation_jobs (status: "processing", phase_results: JSONB)
    ↓ [5 phases via SSE]
course_blueprints.blueprint_data = full JSON
course_blueprints.quality_score + neuroscience_score
course_blueprints.status = "draft"
    ↓ [modules extracted]
blueprint_modules, blueprint_objectives, blueprint_assessments
    ↓ [instructor edits + approves]
course_blueprints.status = "approved"
    ↓ [apply to course — D12]
courses + chapters (conteúdo IA) + questions (variável por tipo)
course_blueprints.status = "applied"
```

---

## 16. API Routes

```
POST   /api/course-designer/generate               # Inicia pipeline (retorna jobId + SSE)
GET    /api/course-designer/jobs/[jobId]            # Poll status do job (DB fallback)
GET    /api/course-designer/blueprints              # Lista blueprints do tenant
GET    /api/course-designer/blueprints/[id]         # Blueprint completo com módulos
PUT    /api/course-designer/blueprints/[id]         # Editar blueprint draft (recalcula score)
POST   /api/course-designer/blueprints/[id]/apply   # Aplicar: cria curso + capítulos + questions
DELETE /api/course-designer/blueprints/[id]         # Deletar blueprint draft
GET    /api/course-designer/blueprints/[id]/export  # JSON export
GET    /api/course-designer/frameworks              # Lista frameworks disponíveis (v1: 3)
POST   /api/course-designer/analyze-content         # Content Analyzer (LLM-only, PDF upload)
```

Todos requerem `manager` ou `admin` role.

O endpoint existente `POST /api/blueprint/generate` (proxy Python) será **deprecado** (D5).

---

## 17. Estrutura de Arquivos

```
packages/agents/src/
├── course-designer/
│   ├── orchestrator.ts              # Pipeline controller (5 fases + SSE)
│   ├── analyzer.ts                  # Fase 1
│   ├── architect.ts                 # Fase 2
│   ├── calculator.ts                # Fase 3
│   ├── validator.ts                 # Fase 4 (framework + neuroscience)
│   ├── generator.ts                 # Fase 5
│   ├── content-analyzer.ts          # LLM-only PDF/PPTX analysis (D15)
│   ├── auditor.ts                   # Course audit for Path B
│   ├── framework-registry.ts        # 3 FrameworkConfigs (v1)
│   ├── neuroscience-rules.ts        # 7 regras transversais
│   ├── interaction-mapper.ts        # bloom_mapped / dominant / custom logic
│   ├── schemas/
│   │   ├── input.ts                 # 6-layer Course Design Brief
│   │   ├── analyzer.ts              # Fase 1 I/O
│   │   ├── architect.ts             # Fase 2 I/O
│   │   ├── calculator.ts            # Fase 3 I/O
│   │   ├── validator.ts             # Fase 4 I/O (Quality Scorecard + Neuro)
│   │   ├── generator.ts             # Fase 5 I/O (Blueprint final)
│   │   └── shared.ts               # FrameworkConfig, Bloom, InteractionType
│   └── prompts/
│       ├── analyzer.ts
│       ├── architect.ts
│       ├── calculator.ts
│       ├── validator.ts
│       └── generator.ts

apps/web/src/app/api/course-designer/
├── generate/route.ts                # POST — inicia pipeline + SSE
├── jobs/[jobId]/route.ts            # GET — status (DB fallback)
├── frameworks/route.ts              # GET — lista frameworks
├── analyze-content/route.ts         # POST — Content Analyzer
├── blueprints/
│   ├── route.ts                     # GET (list)
│   └── [blueprintId]/
│       ├── route.ts                 # GET, PUT, DELETE
│       ├── apply/route.ts           # POST — blueprint → curso
│       └── export/route.ts          # GET — JSON export

apps/web/src/app/(platform)/courses/new/design/
├── page.tsx                         # Wizard 6 steps
├── _components/
│   ├── course-designer-wizard.tsx   # Stepper principal
│   ├── purpose-step.tsx             # Step 1: Propósito
│   ├── audience-step.tsx            # Step 2: Audiência
│   ├── scope-step.tsx               # Step 3: Escopo (+ upload + course selector)
│   ├── constraints-step.tsx         # Step 4: Restrições
│   ├── preferences-step.tsx         # Step 5: Framework selector + strategy
│   ├── prevalidation-step.tsx       # Step 6: Brief Score + generate
│   ├── framework-selector.tsx       # Seletor visual (3 frameworks + auto)
│   └── design-progress.tsx          # Stepper das 5 fases do pipeline

apps/web/src/app/(platform)/courses/[courseId]/blueprint/
├── page.tsx
├── _components/
│   ├── blueprint-viewer.tsx         # Layout completo (editável — D11)
│   ├── module-card.tsx
│   ├── framework-stage-bar.tsx
│   ├── quality-scorecard.tsx        # Framework Score + Neuro Score
│   ├── bloom-progression.tsx
│   ├── problema-motor-card.tsx
│   ├── rubric-viewer.tsx
│   ├── assessment-timeline.tsx
│   └── kirkpatrick-summary.tsx
```

---

## 18. Problema-Motor — Detalhamento

Gerado pela IA para cada módulo (frameworks experienciais).

### Fórmula de Tensão

```
Tensão = Pressão (1-5) × Ambiguidade (1-5) × Stakes (1-5)
Total: 1-125
```

### Tipos

1. **Caso Real (Adaptado)** — situação verídica, nomes alterados, contexto rico com ruído
2. **Simulação (Role-Play)** — papéis definidos, restrições explícitas
3. **Dilema com Trade-offs** — sem resposta óbvia, todas opções têm prós/contras
4. **Desafio Prático** — construir algo com restrições e entregável tangível

### Progressão por Spiral Level

| Spiral Level | Tensão Típica |
|-------------|---------------|
| Fundamentos | Baixa (1-25): 1 variável, decisão binária |
| Variação | Média (26-50): ambiguidade, múltiplas variáveis |
| Conflito Humano | Alta (51-75): stakeholders com agendas ocultas |
| Mundo Real | Muito Alta (76-100): situação do trabalho real |
| Síntese | Máxima (100-125): apresentação pública, consequências reais |

---

## 19. Componentes UI

### 19.1. Reutilizar do Design System (`@eximia/ui`)

`Card`, `CardContent`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Button`, `Input`, `Textarea`, `Select`, `Badge`, `ProgressBar`, `Table`, `Accordion`, `Alert`, `Skeleton`, `Toast`

### 19.2. Novos Componentes (específicos WS2)

| Componente | Tipo | Descrição |
|------------|------|-----------|
| `CourseDesignerWizard` | Organism | Stepper 6 steps completo |
| `FrameworkSelector` | Molecule | Grid visual: 3 frameworks + auto, "Recomendado" badge |
| `DesignProgress` | Molecule | Stepper visual das 5 fases do pipeline |
| `BlueprintViewer` | Organism | Layout completo, editável (D11) |
| `ModuleCard` | Molecule | Card com framework stage bar |
| `FrameworkStageBar` | Atom | Barra horizontal N segmentos % (genérico) |
| `QualityScorecard` | Molecule | Framework Score + Neuro Score (2 gauges) |
| `BloomProgression` | Molecule | Progressão visual 6 níveis |
| `ProblemaMotorCard` | Molecule | Case study: contexto, papel, tensão, missão |
| `RubricViewer` | Molecule | Tabela 3 níveis (0-2) por critério |
| `BriefScoreIndicator` | Atom | Score 0-100 do Brief na Pre-validation |

---

## 20. Estimativa de Epics e Stories

| Epic | Título | Stories | SP (est.) |
|------|--------|--------:|----------:|
| **20** | Framework Registry, Schemas e Agentes (5 fases) | 7 | ~38 |
| **21** | Orquestrador, API e Database | 5 | ~28 |
| **22** | UI (Wizard 6 steps, Framework Selector, Blueprint Viewer) | 6 | ~30 |
| **23** | Integração (Organizer, Creator, WS1, Auditor) | 4 | ~20 |
| **24** | Quality (Testes, Benchmarks, Polish) | 4 | ~22 |
| **Total** | | **26** | **~138** |

### Ordem de Execução

```
Epic 20 (Framework Registry + Schemas + Agentes)   ← fundação
    ↓
Epic 21 (Orquestrador + API + DB + SSE)
    ↓
    ├── Epic 22 (UI — Wizard + Viewer)
    │       ↓
    └── Epic 23 (Integração — Auditor, Organizer, Creator, WS1)
            ↓
        Epic 24 (Quality — testes, benchmarks, polish)
```

---

## 21. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Pipeline 5 fases lento (>5min) | Médio | SSE para progresso visual, retry parcial via phase_results |
| Output LLM inconsistente entre fases | Alto | Zod validation rigorosa, auto-retry 1x (D14) |
| Instrutor não entende frameworks | Médio | "Auto" mode, tooltips, Brief Score guia preenchimento |
| Quality Scorecard muito restritivo | Baixo | Thresholds configuráveis, híbrido retry+instrutor (D14) |
| PBL requer grupo (special_requirements) | Médio | Warning na Pre-validation se group_size < 5 |
| Content Analyzer LLM-only impreciso | Baixo | Instrutor revisa sugestões antes de aceitar |
| Problema-motor genérico | Médio | Prompts ricos com contexto do instrutor, exemplos do benchmark |

---

## 22. Compatibilidade e Não-Impacto

- [x] Pipeline socrático WS1 continua funcionando sem WS2
- [x] Fluxo de Content Ingestion existente não é afetado
- [x] Creator continua gerando perguntas sem blueprint
- [x] Dashboard/Analytics WS1 não são afetados
- [x] Novos endpoints não conflitam (`/api/course-designer/` vs `/api/blueprint/`)
- [x] Tabelas novas não alteram schema existente (apenas ADD COLUMN e CREATE TABLE)
- [x] WS1 integration é backward-compatible (3 campos opcionais — D13)

---

## 23. Próximos Passos

1. [x] ~~Review da arquitetura~~ → Consolidada como v3.0
2. [x] ~~Criar Epics 20-24 com stories detalhadas~~ → 26 stories, 140 SP
3. [ ] Validar stories com @po
4. [ ] Iniciar implementação: Epic 20 → 21 → 22/23 → 24

---

## 24. Glossário

| Termo | Definição |
|-------|-----------|
| **ABCD** | Framework para objetivos: Audience, Behavior, Condition, Degree |
| **AGES** | Attention (<30min), Generation (ativo), Emotion, Spacing |
| **Auditor** | Componente que analisa curso existente (Caminho B) |
| **Bloom's Taxonomy** | Remember → Understand → Apply → Analyze → Evaluate → Create |
| **Blueprint** | JSON completo que descreve a arquitetura pedagógica de um curso |
| **Brief Score** | Score 0-100 de completude do input (Pre-validation Gate) |
| **CLT** | Cognitive Load Theory (Sweller). Máx 4±1 conceitos por bloco |
| **Content Analyzer** | Componente LLM-only que extrai conteúdo de PDFs/PPTX |
| **ELC+ 2026** | 6 estágios: Immerse → Reflect → Conceptualize → Experiment → Calibrate → Integrate |
| **FrameworkConfig** | Interface TS que define config completa de um framework |
| **InteractionType** | `socratic_dialogue`, `quiz`, `scenario`, `assignment` |
| **Kirkpatrick** | L1: Reação, L2: Aprendizagem, L3: Comportamento, L4: Resultados |
| **Neuroscience Layer** | Camada transversal (CLT, AGES, Spaced Rep, Retrieval, Dual Coding) |
| **PBL** | Problem-Based Learning (Hmelo-Silver 4 fases) |
| **Quality Scorecard** | (Framework Quality × 0.7) + (Neuroscience Score × 0.3) |
| **REAL Framework** | Realistic, Engaging, Aligned, Leads to SDL (design de problemas PBL) |
| **Spiral Curriculum** | Fundamentos → Variação → Conflito Humano → Mundo Real → Síntese |
| **Tipo A/B/C** | A = Ciclos (ELC+, Kolb, PBL). B = Design (Backward, ADDIE). C = Neuro (transversal) |
| **ZPD** | Zone of Proximal Development (Vygotsky) |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do documento (ELC+-only) | Aria (Architect) |
| 2026-02-16 | 2.0 | Reescrita multi-framework: 8 frameworks, 12 algoritmos, Framework Selector genérico | Aria (Architect) |
| 2026-02-16 | **3.0** | **Consolidação definitiva.** Incorpora D1-D17 do review interativo. Frameworks v1 = 3 (ELC+, Kolb, PBL). Taxonomia A/B/C. Neuroscience Layer separada. Input 6 camadas (Course Design Brief). Dois caminhos (novo + recriar). Auditor framework. 4 interaction strategies (bloom_mapped default). Hybrid SSE + DB. Quality Gate híbrido. Content Analyzer LLM-only. Contrato WS1 detalhado. Blueprint editável. Wizard 6 steps. FrameworkConfig rica. Supersede `ws2-review-interativo-v1.md` | Aria (Architect) + Hugo |
