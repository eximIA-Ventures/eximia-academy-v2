# WS2 Course Creator — Revisão Interativa da Arquitetura

> Status: **Revisão Completa v3** — Todas as decisões tomadas (D1-D18). Pronto para criação de épicos
> Data: 2026-02-16
> Agentes: @architect (Aria) + @analyst (Atlas)
> Contexto: Sessão de revisão arquitetural interativa — Blocos A parcial + Arquitetura Modular

---

## Índice

1. [Decisões já tomadas](#1-decisões-já-tomadas)
2. [Modelo de Inputs — "Course Design Brief"](#2-modelo-de-inputs--course-design-brief)
3. [Os Dois Caminhos do Instrutor](#3-os-dois-caminhos-do-instrutor)
4. [Arquitetura Modular de 3 Camadas](#4-arquitetura-modular-de-3-camadas)
5. [Framework de Geração de Interações](#5-framework-de-geração-de-interações)
6. [Contrato WS2 → WS1](#6-contrato-ws2--ws1)
7. [Decisões em aberto](#7-decisões-em-aberto)
8. [Glossário](#8-glossário)

---

## 1. Decisões já tomadas

Estas decisões foram validadas durante a sessão interativa:

| # | Decisão | Escolha | Justificativa |
|---|---------|---------|---------------|
| D1 | Frameworks v1 | **ELC+ 2026 + Kolb 4-Stage + PBL (Hmelo-Silver)** | ELC+ e Kolb = diferencial experiencial. PBL = encaixe natural com WS1 (Mestre Socrático = facilitador PBL). Baseado na análise dos benchmarks Learning_Design |
| D2 | Registry | **Extensível via FrameworkConfig** | Cada framework = 1 arquivo de configuração. Pipeline nunca tem `if framework === "x"` |
| D3 | UX do Input | **Wizard multi-step + IA assistente** | Guia instrutores novos, não atrasa experientes. IA sugere preenchimento |
| D4 | Modelo de Execução | **Em aberto** (pausado para definir inputs primeiro) | — |
| D5 | Substituição Proxy | **Big Bang — substituir microservice Python por agentes TS** | DIALECTICA não existe no repo, lógica é prompt-driven, WS2 é reescrita completa. Zero valor em manter compatibilidade |
| D6 | Neuroscience Layer | **Camada transversal separada, sempre ativa** | CLT, AGES, Spaced Repetition, Retrieval Practice e Dual Coding aplicam-se a QUALQUER framework. Validação no Validator (Fase 4) é aditiva ao Quality Scorecard do framework |
| D7 | FrameworkConfig | **Interface formal — cada framework = 1 config plugável** | Define stages, time_distribution, interaction_map, quality_criteria, assessment_dimensions, sequencing, special_requirements |
| D8 | Frameworks Tipo B | **Adiado para v2+** | Backward Design, Action Mapping, ADDIE, SAM operam na macro-estrutura. v1 foca em Tipo A (ciclos de aprendizagem) |
| D9 | Modelo de Execução do Pipeline | **Hybrid SSE + DB Fallback** | SSE stream para progresso em tempo real (happy path) + tabela `blueprint_jobs` para estado durável (resiliência). Instrutor vê fase-a-fase, pode sair e voltar, retry parcial via `phase_results` JSONB. Zero dependência externa (Vercel + Supabase). Upgrade path para Inngest se pipeline > 800s ou precisar de human-in-the-loop |
| D10 | UX do Wizard | **Stepper linear de 6 steps + "Preencher com IA"** | Familiar para instrutores não-técnicos, Pre-validation Gate encaixa como step final, botão IA resolve velocidade para experientes. Simples de implementar, upgrade para híbrido com preview lateral no futuro |
| D11 | Editabilidade do Blueprint | **Edição completa** | Instrutor pode editar textos, reordenar/adicionar/remover módulos, mudar interaction types e durações. Quality Scorecard recalcula ao salvar. Blueprint = documento editável |
| D12 | Blueprint → Curso (Apply) | **Estrutura + conteúdo IA + perguntas variáveis** | Apply cria: course + chapters (conteúdo IA com placeholders [ADICIONAR CONTEÚDO]) + questions (quantidade variável por interaction_type: socratic 3-5, quiz 5-8, scenario 2-3, assignment 1-2). Questions criadas com status=pending (manager revisa antes de ativar). Mesmo fluxo do enrichment pipeline |
| D13 | Integração WS1 | **Acoplamento leve — 3 campos opcionais** | WS1 recebe `interaction_type`, `bloom_target` e `framework_stage` no contexto da sessão. Backward-compatible (campos opcionais). Mestre adapta comportamento conforme tipo de interação, calibra profundidade pelo Bloom, contextualiza por estágio do framework. Upgrade para acoplamento forte é incremental se necessário |
| D14 | Quality Gate | **Mostrar ao instrutor** | Pipeline já tem 1 auto-retry embutido (Architect→Calculator→Validator). Após retry, resultado é o melhor que a IA consegue. Instrutor vê: score + lista de issues + 3 botões (Ver Blueprint / Regenerar / Editar). D11 (edição completa) permite corrigir manualmente. Transparência gera confiança |
| D15 | Content Analyzer | **Adiado para v2** | V1 aceita topics_outline manual + source_course_id (Caminho B). Upload de PDFs/PPTX adiciona complexidade de storage/parsing que não é essencial para o lançamento. Caminho A2 (com materiais) fica para v2 |
| D16 | Auditor (Caminho B) | **Completo — 7 passos na v1** | Todos os passos na v1: Extração Estrutural → Análise de Conteúdo → Auditoria de Qualidade → Gap Identification → Preservation Map → Plano de Melhoria → Feed para Pipeline. Diagnóstico completo necessário para instrutor tomar boas decisões no wizard |
| D17 | stage_mapped | **V1 — core do sistema** | stage_mapped é o que materializa o framework na experiência do aluno. Cada estágio do FrameworkConfig (qualquer framework) recebe seu tipo de interação. WS1 precisa de extensão: sessions multi-stage com transições entre interaction types. Sem isso, os estágios são decorativos no blueprint |
| D18 | interaction_strategy default | **`stage_mapped`** | Default = máximo valor pedagógico. Instrutor vê o diferencial do produto de cara. Todas as 4 estratégias disponíveis na v1: stage_mapped (default), bloom_mapped, dominant, custom |

---

## 2. Modelo de Inputs — "Course Design Brief"

### 2.1. Por que um framework de input?

O benchmark original trata o input como "5 campos, 5 minutos". Isso é insuficiente porque:

- **O pipeline de 5 fases precisa de dados ricos** — cada algoritmo (A1-A16) consome campos específicos
- **Garbage in, garbage out** — um input pobre gera um blueprint genérico
- **O instrutor tem conhecimento valioso** que precisa ser capturado de forma estruturada
- **Existem dois caminhos** (novo curso vs. recriar existente) que precisam de inputs diferentes

### 2.2. As 6 Camadas do Brief

O input é organizado em 6 camadas. Cada uma existe porque alimenta algoritmos específicos do pipeline.

---

#### CAMADA 1: PROPÓSITO — "Por que este curso existe?"

**O que é:** Os campos que definem a razão de ser do curso. Sem isso, o pipeline não sabe para onde apontar.

**Campos:**

| Campo | O que é | Exemplo | Obrigatório | Quem usa no pipeline |
|-------|---------|---------|-------------|---------------------|
| `course_title` | Nome do curso | "Product Management Fundamentals" | Sim | Metadata do blueprint |
| `business_goal` | O que muda na **organização** depois que os alunos completam o curso | "Reduzir time-to-market em 30% através de decisões de produto mais ágeis" | Sim | A2 (Framework Selector) — entende o contexto corporativo para escolher framework adequado |
| `behavior_change` | O que o aluno **faz diferente** no dia-a-dia após o curso. Não é sobre saber, é sobre agir | "Conduzir discovery interviews antes de priorizar qualquer feature" | Sim | A4 (Objective Generator) — transforma em objetivos ABCD. Também alimenta o Problema-Motor |
| `success_metrics` | Como a empresa vai **medir** se o curso funcionou. Kirkpatrick Level 3-4 | ["% de PMs fazendo discovery", "Redução do cycle time de decisão"] | Não | A5 (Assessment Designer) — cria avaliações alinhadas com métricas reais |
| `problem_statement` | O **sintoma** que motivou a criação do curso. O "dói aqui" da organização | "PMs priorizam features baseado em opinião do CEO, sem dados" | Não | Problema-Motor Generator — usa como base para criar casos práticos realistas |

**Por que `business_goal` e `behavior_change` são campos separados?**

Isso vem do **Action Mapping** (Cathy Moore): o goal é da organização, o behavior é do indivíduo. Um curso pode ter o mesmo business_goal mas behavior_changes diferentes dependendo do público.

Exemplo:
- **business_goal:** "Reduzir riscos de compliance LGPD"
- **behavior_change para gestores:** "Identificar e escalar incidentes de dados em 24h"
- **behavior_change para devs:** "Implementar privacy by design em toda feature nova"

Mesmo goal → cursos diferentes → comportamentos diferentes.

**Por que `problem_statement` é opcional?**

Nem todo instrutor sabe articular o problema. Quando preenchido, enriquece enormemente o Problema-Motor de cada módulo. Quando não preenchido, a IA infere do `business_goal` + `behavior_change`.

---

#### CAMADA 2: AUDIÊNCIA — "Para quem é este curso?"

**O que é:** Perfil detalhado do público-alvo. Esses dados alimentam o Audience Profiler (A3) que calcula ZPD, estilo Kolb e perfil andragógico.

**Campos:**

| Campo | O que é | Exemplo | Obrigatório | Quem usa no pipeline |
|-------|---------|---------|-------------|---------------------|
| `role` | Cargo ou papel profissional do aluno | "Product Managers" | Sim | A3 — infere Kolb style dominante (PM = Divergente) |
| `experience_level` | Nível de experiência na área do curso. Opções: `iniciante`, `intermediario`, `avancado`, `especialista` | "intermediario" | Sim | A3 — calcula ZPD (o que consegue fazer sozinho vs. com ajuda). Define Bloom máximo alcançável |
| `prior_knowledge` | O que o aluno **já sabe** antes de começar. Tags ou frases curtas | ["básico agile", "básico UX", "nunca fez discovery"] | Não | A3 — Gap Analysis (distância entre o que sabe e o que precisa saber). Evita ensinar o que já sabe |
| `group_size` | Quantos alunos por turma | 25 | Não | A16 (Activity Recommender) — peer review precisa de grupo, assignment individual pode ter qualquer tamanho |
| `motivation_context` | **Por que** essas pessoas vão fazer o curso. O que as motiva ou desmotiva | "Promoção para PM Sr exige certificação interna" | Não | A3 — Andragogia profile. Adultos aprendem melhor quando entendem o porquê. Mestre usa para calibrar tom |
| `learning_environment` | Onde e como vão estudar. Opções: `presencial`, `remoto`, `hibrido` | "remoto" | Não | A16 — Filtra atividades viáveis (role-play presencial vs. fórum assíncrono) |
| `autonomy_level` | Quanto o aluno pode/deve se autodirigir. Opções: `guiado`, `semi_autonomo`, `autonomo` | "semi_autonomo" | Não | A7 (Framework Mapper) — define nível de scaffolding. Guiado = mais structure, Autônomo = mais liberdade |

**Como o ZPD é calculado (A3):**

```
experience_level    →  O que faz sozinho (Bloom)     O que faz com ajuda
───────────────────────────────────────────────────────────────────────
iniciante           →  Remember, Understand           Apply
intermediario       →  Remember...Apply               Analyze
avancado            →  Remember...Analyze             Evaluate, Create
especialista        →  Todos                          Create (novos contextos)
```

O ZPD define o teto do blueprint. Um curso para iniciantes nunca terá módulos exigindo Create.

**Como o Kolb style é inferido (A3):**

O pipeline infere o estilo dominante Kolb a partir do `role`:

```
role contém            →  Kolb style          →  Implicação no design
─────────────────────────────────────────────────────────────────────
"product", "design"    →  Divergente           →  Mais perspectivas, brainstorm
"engenheiro", "dev"    →  Convergente          →  Mais problemas práticos
"analista", "pesquisa" →  Assimilador          →  Mais frameworks, teoria
"vendas", "comercial"  →  Acomodador           →  Mais ação, experimentação
default                →  Divergente           →  Seguro para maioria
```

Isso é uma inferência inicial. O WS1 (Perfilador) refina ao longo das sessões com dados reais do aluno.

---

#### CAMADA 3: ESCOPO & CONTEÚDO — "O que precisa ser coberto?"

**O que é:** Define o que o curso vai cobrir. Pode ser preenchido pelo instrutor (competências, tópicos) ou extraído automaticamente de materiais (arquivos) ou de um curso existente (Caminho B).

**Campos:**

| Campo | O que é | Exemplo | Obrigatório | Quem usa no pipeline |
|-------|---------|---------|-------------|---------------------|
| `core_competencies` | As competências que o aluno **domina** ao final do curso. Verbos de ação | ["Conduzir discovery interviews", "Priorizar com RICE", "Criar roadmap trimestral"] | Não* | A4 (Objective Generator) — transforma diretamente em objetivos ABCD. Se preenchido, guia fortemente a estrutura |
| `topics_outline` | Tópicos que o instrutor quer cobrir. Mais livre que competências | ["Discovery", "Priorização", "Roadmap", "Stakeholder Management"] | Não* | A6 (Module Sequencer) — usa como base para definir módulos |
| `content_density` | Quanto conteúdo teórico por módulo. Opções: `lean`, `moderada`, `densa` | "lean" | Não | A10 (Chunk Optimizer) — lean = mais atividades, menos teoria. Densa = mais leitura, mais conceitos |
| `assessment_preference` | Tipo de avaliação preferido. Opções: `formativa`, `somativa`, `mista` | "mista" | Não | A5 (Assessment Designer) — formativa = durante o aprendizado (quizzes, reflexões). Somativa = no final (prova, projeto) |

**Contexto externo (sub-seção):**

| Campo | O que é | Formatos aceitos | Quem usa |
|-------|---------|-----------------|----------|
| `context_files` | Materiais que o instrutor já tem e quer usar como base | PDF, PPTX, DOCX, TXT | **Content Analyzer** (componente novo) — extrai tópicos, conceitos, estrutura. Alimenta A4, A6, A15 |
| `reference_urls` | Links para conteúdo de referência | URLs | Content enrichment (v2) |
| `existing_materials_summary` | Descrição textual do que já existe | Texto livre | Gap Analysis — entende o que já foi coberto |

**Curso existente (sub-seção — só no Caminho B):**

| Campo | O que é | Quem usa |
|-------|---------|----------|
| `source_course_id` | UUID de um curso existente no Academy | **Auditor** (componente novo) — extrai chapters, questions, content e infere estrutura atual |

\* Pelo menos 1 destas fontes de conteúdo deve existir: `core_competencies`, `topics_outline`, `context_files` ou `source_course_id`. Se nenhuma, a IA infere 100% do `business_goal` + `behavior_change` (resultado mais genérico).

**Como os arquivos de contexto são processados:**

```
Instrutor faz upload de 2 PDFs e 1 PPTX
            │
            ▼
    Content Analyzer (componente novo)
            │
            ├─ Extrai texto dos arquivos
            ├─ Identifica tópicos e conceitos-chave
            ├─ Detecta estrutura existente (capítulos, seções)
            ├─ Estima nível Bloom do conteúdo existente
            └─ Gera content_summary estruturado
            │
            ▼
    Resultado: enriquece Camada 3 automaticamente
    · topics_outline inferido dos headings/seções
    · core_competencies sugeridas do conteúdo
    · Conteúdo preservado para uso nos módulos do blueprint
```

---

#### CAMADA 4: RESTRIÇÕES & LOGÍSTICA — "Dentro de quais limites?"

**O que é:** Constraints que definem o que é possível. Um curso de 4h é radicalmente diferente de um de 40h.

**Campos:**

| Campo | O que é | Exemplo | Obrigatório | Quem usa no pipeline |
|-------|---------|---------|-------------|---------------------|
| `total_duration_hours` | Tempo total do curso em horas | 40 | Sim* | A8 (Duration Allocator) — distribui tempo entre módulos e estágios |
| `weeks` | Duração em semanas | 12 | Não | A8 — define pacing (ritmo semanal) |
| `hours_per_week` | Horas por semana | 3.5 | Não | A8 — junto com `weeks`, calcula `total_duration_hours` se não informado |
| `delivery_mode` | Como o curso é entregue. Opções: `presencial`, `online_sync`, `online_async`, `hibrido` | "online_async" | Não | A16 (Activity Recommender) — filtra atividades viáveis. Role-play é presencial/sync. Fórum é async |
| `cohort_based` | Alunos progridem juntos em turma? | true | Não | A16 — habilita atividades sociais: peer review, discussão em grupo, apresentações |
| `session_length_preference` | Duração preferida de cada sessão em minutos | 60 | Não | A10 (Chunk Optimizer) — define tamanho máximo de cada bloco de aprendizado |

\* Obrigatório diretamente **ou** calculado de `weeks × hours_per_week`.

**Como a duração afeta o blueprint:**

```
total_hours    módulos estimados    horas/módulo    Bloom máximo
────────────────────────────────────────────────────────────────
1-4h           1-2 módulos          1-2h            Apply
4-10h          3-5 módulos          2-3h            Analyze
10-40h         5-10 módulos         3-4h            Evaluate
40-100h        10-20 módulos        4-5h            Create
100-200h       20-30 módulos        5-7h            Create+
```

Cursos curtos ficam limitados nos níveis Bloom mais baixos porque não há tempo para completar o ciclo experiencial inteiro nos níveis superiores.

---

#### CAMADA 5: PREFERÊNCIAS DE DESIGN — "Como quer que o curso seja?"

**O que é:** Preferências que o instrutor pode definir ou deixar no automático. São as decisões "opinionadas" sobre o design do curso.

**Campos:**

| Campo | O que é | Opções | Default | Quem usa |
|-------|---------|--------|---------|----------|
| `framework` | Framework pedagógico principal | `elc_plus`, `kolb_4`, `pbl_hmelo`, `auto` | `auto` | A2 (Framework Selector) — se `auto`, IA escolhe baseado no contexto. Se instrutor escolheu, respeita |
| `interaction_strategy` | Como os tipos de interação são distribuídos no curso | Ver seção 4 detalhada | `bloom_mapped` | A7 (Framework Mapper) + Gerador de Interações |
| `language` | Idioma do blueprint e das perguntas geradas | `pt-br`, `en` | `pt-br` | Todos os prompts |

**Sobre `framework`:**

Quando o instrutor seleciona `auto`, o Framework Selector (A2) decide:

```
Se behavior_change envolve "resolver problemas complexos" OU "tomar decisões":
    → pbl_hmelo (problem-first, SDL, encaixe natural com diálogo socrático)

Se total_duration_hours <= 10h E experience_level != "iniciante":
    → kolb_4 (mais simples, 4 estágios, suficiente para curso curto)

Senão:
    → elc_plus (6 estágios, ciclo completo, máxima retenção)
```

Quando o instrutor seleciona um framework específico, o A2 respeita e pula a seleção automática.

**Nota:** O Framework Selector consulta o `FrameworkConfig` do framework escolhido. Toda a pipeline downstream opera genericamente sobre o config — nenhum algoritmo tem lógica específica para um framework.

**Sobre `interaction_strategy`:** Detalhado na Seção 5 deste documento.

---

#### CAMADA 6: PRE-VALIDATION GATE — "O brief é bom o suficiente?"

**O que é:** Antes de enviar o brief para o pipeline de 5 fases, o sistema valida se os dados são suficientes para gerar um blueprint de qualidade. Não é bloqueante (o instrutor pode prosseguir com warnings), mas comunica o impacto.

**Checks obrigatórios (bloqueiam geração se falharem):**

| Check | Regra | Mensagem se falhar |
|-------|-------|-------------------|
| Propósito mínimo | `business_goal` OU `behavior_change` preenchido | "Defina pelo menos o objetivo de negócio ou a mudança de comportamento esperada" |
| Audiência mínima | `role` E `experience_level` preenchidos | "Defina o público-alvo e seu nível de experiência" |
| Duração mínima | `total_duration_hours >= 1` (ou calculável de weeks × hours_per_week) | "Defina a duração do curso (mínimo 1 hora)" |
| Fonte de conteúdo | Ao menos 1 de: `core_competencies`, `topics_outline`, `context_files`, `source_course_id` | "Forneça pelo menos uma fonte de conteúdo: competências, tópicos, arquivos ou um curso existente" |

**Checks de qualidade (warnings — não bloqueiam, mas informam):**

| Check | Regra | Warning |
|-------|-------|---------|
| Goal sem verbo | `business_goal` não contém verbo de ação | "Sugestão: reformule o objetivo com verbo de ação (ex: 'Reduzir...', 'Aumentar...')" |
| Duração curta | `total_duration_hours < 4` | "Cursos abaixo de 4h geram blueprints limitados (máx 2 módulos, Bloom Apply)" |
| Sem contexto externo | Nenhum `context_files` e nenhum `topics_outline` | "Sem material de referência, a IA vai inferir 100% da estrutura. Resultado pode ser genérico" |
| Grupo grande sem cohort | `group_size > 50` e `cohort_based != true` | "Com mais de 50 alunos, considere ativar modo cohort para peer review e atividades sociais" |
| Sem métricas | `success_metrics` vazio | "Adicionar métricas de sucesso melhora as avaliações (Kirkpatrick L3-L4)" |

**Brief Score (0-100):**

O sistema calcula um "score de completude" do brief baseado nos campos preenchidos:

```
Pontuação por campo:
  course_title:          5 pts
  business_goal:        10 pts
  behavior_change:      10 pts
  success_metrics:       5 pts
  problem_statement:     5 pts
  role:                  8 pts
  experience_level:      8 pts
  prior_knowledge:       4 pts
  group_size:            2 pts
  motivation_context:    3 pts
  core_competencies:    10 pts  (ou topics_outline: 8 pts, ou context_files: 10 pts)
  total_duration_hours:  8 pts
  delivery_mode:         4 pts
  cohort_based:          3 pts
  framework:             3 pts
  interaction_strategy:  2 pts
                       ────
  Total possível:      100 pts

Faixas:
  90-100: Excelente — blueprint vai ser muito preciso
  70-89:  Bom — blueprint sólido, IA completa o resto
  50-69:  Suficiente — pipeline funciona, mas resultado mais genérico
  <50:    Mínimo — considere preencher mais campos
```

O Brief Score é informativo (não bloqueia) e aparece na tela de pre-validation para motivar o instrutor a enriquecer o brief.

---

## 3. Os Dois Caminhos do Instrutor

### 3.1. Visão Geral

O Course Designer tem dois pontos de entrada que convergem para o mesmo pipeline:

```
CAMINHO A: Novo Curso                    CAMINHO B: Recriar Curso Existente
─────────────────────                    ──────────────────────────────────

Instrutor quer criar                     Instrutor tem um curso no Academy
um curso do zero,                        que quer melhorar, reestruturar
opcionalmente com                        ou adaptar para outro público
materiais de contexto

    │                                        │
    │                                        ▼
    │                                    SELETOR DE CURSO
    │                                    Lista cursos do tenant
    │                                    Preview: título, chapters,
    │                                    questions, completude
    │                                        │
    │                                        ▼
    │                                    EXTRAÇÃO AUTOMÁTICA
    │                                    Lê course → chapters → questions
    │                                    Infere: topics, bloom levels,
    │                                    content summary, interaction types
    │                                    atuais
    │                                        │
    │                                        ▼
    │                                    PRÉ-PREENCHE CAMADAS 1-4
    │                                    com dados do curso existente
    │                                    (instrutor pode editar tudo)
    │                                        │
    ▼                                        ▼
┌──────────────────────────────────────────────────────────┐
│                                                          │
│               WIZARD DE INPUT (6 Camadas)                │
│                                                          │
│  Camada 1: Propósito ─────── preenchido ou vazio         │
│  Camada 2: Audiência ─────── preenchido ou vazio         │
│  Camada 3: Escopo ────────── com context_files e/ou      │
│                               source_course_id           │
│  Camada 4: Restrições ────── preenchido ou vazio         │
│  Camada 5: Preferências ──── instrutor escolhe           │
│  Camada 6: Pre-validation ── valida antes de gerar       │
│                                                          │
└───────────────────────────────┬──────────────────────────┘
                                │
                                ▼
                     PIPELINE DE 5 FASES
                     (Analyzer → Architect → Calculator
                      → Validator → Generator)
                                │
                                ▼
                          BLUEPRINT
```

### 3.2. Caminho A: Novo Curso — Detalhamento

**Quando usar:** Instrutor não tem um curso no Academy. Está criando algo novo.

**Variantes:**

| Variante | Descrição | Campos-chave |
|----------|-----------|-------------|
| **A1: Do zero puro** | Instrutor preenche tudo manualmente. Sem arquivos, sem referência | Camadas 1-5 preenchidas pelo instrutor |
| **A2: Com materiais** | Instrutor tem PDFs, slides, apostilas e quer que o curso seja baseado neles | `context_files` preenchido. Content Analyzer extrai tópicos e competências |
| **A3: Quick fill** | Instrutor preenche só título + público + duração e deixa IA completar o resto | Mínimo obrigatório + botão "Preencher com IA" |

Na variante **A2 (com materiais)**, o fluxo é:

```
1. Instrutor preenche Camada 1 (propósito) normalmente
2. Na Camada 3, faz upload dos arquivos
3. Content Analyzer processa os arquivos em background
4. Sistema sugere automaticamente:
   · core_competencies (extraídas do conteúdo)
   · topics_outline (dos headings/seções dos documentos)
5. Instrutor revisa, aceita, edita ou descarta sugestões
6. Prossegue com Camadas 4-6 normalmente
```

### 3.3. Caminho B: Recriar Curso Existente — Detalhamento

**Quando usar:** Instrutor tem um curso já publicado no Academy e quer melhorá-lo.

**Motivações típicas:**
- Curso foi criado "na intuição" sem metodologia pedagógica
- Quer aplicar framework ELC+ a um curso existente
- Quer reorganizar capítulos com spiral curriculum
- Quer adicionar avaliações e problemas-motor
- Quer adaptar para outro público

**Fluxo detalhado:**

```
1. Instrutor seleciona "Recriar curso existente"

2. SELETOR DE CURSO
   · Lista todos os cursos do tenant (com status published ou draft)
   · Cada curso mostra preview:
     - Título
     - N chapters
     - N questions
     - Status
     - Data de criação
   · Instrutor seleciona o curso

3. EXTRAÇÃO AUTOMÁTICA
   O sistema lê o curso e extrai:
   · chapters → topics_outline (títulos dos capítulos)
   · chapters.content → content_summary (resumo do conteúdo)
   · questions → bloom level inferido (do tipo de pergunta)
   · questions → interaction types atuais
   · Estrutura geral → estimated_duration_hours

4. PRÉ-PREENCHIMENTO DAS CAMADAS
   Com os dados extraídos, o sistema preenche automaticamente:
   · Camada 1: course_title (do curso), business_goal (inferido ou vazio)
   · Camada 2: (vazio — instrutor precisa definir público novo)
   · Camada 3: topics_outline (dos chapters), core_competencies (inferido)
   · Camada 4: total_duration_hours (estimado do conteúdo)
   · Todos os campos são editáveis — o instrutor ajusta o que quiser

5. Instrutor completa/ajusta as 6 camadas normalmente

6. Pipeline roda com contexto enriquecido do curso existente
   · O Architect (Fase 2) sabe que existe conteúdo anterior
   · O Generator (Fase 5) pode referenciar/preservar conteúdo

7. Blueprint gerado inclui:
   · Referência ao curso original (source_course_id)
   · Mapeamento: módulo novo ↔ chapter existente
   · Indicação do que é novo vs. reorganizado
```

### 3.4. Auditor — Framework de Análise de Curso Existente

Para o Caminho B funcionar bem, precisamos de um componente que analise o curso existente. Chamamos de **Auditor**.

**Objetivo:** Recebe um curso existente do Academy e produz um diagnóstico + dados estruturados que alimentam o pipeline.

**Passos do framework (a ser desenvolvido por outro agente):**

| Passo | Nome | O que faz | Output |
|-------|------|-----------|--------|
| 1 | Extração Estrutural | Parseia chapters, questions, content em formato normalizado | `existing_course_structure` |
| 2 | Análise de Conteúdo | Identifica temas, conceitos-chave, nível Bloom atual | `content_analysis` |
| 3 | Auditoria de Qualidade | Aplica Quality Scorecard (5 dimensões) ao curso existente | `quality_audit` (score 0-100) |
| 4 | Gap Identification | Compara estado atual vs. best practices do framework selecionado | `gap_report` |
| 5 | Preservation Map | Classifica cada elemento: MANTER, REORGANIZAR, MELHORAR, DESCARTAR | `preservation_map` |
| 6 | Plano de Melhoria | Recomendações priorizadas | `improvement_plan` |
| 7 | Feed para Pipeline | Empacota como input enriquecido para o pipeline de 5 fases | `enriched_input` |

**Perguntas que o framework do Auditor precisa responder:**
- Como pontuar objetivamente a qualidade de um curso existente?
- Que critérios determinam MANTER vs. REORGANIZAR vs. MELHORAR vs. DESCARTAR?
- Como preservar o conteúdo original enquanto reestrutura?
- Como lidar com cursos sem objetivos claros, sem avaliações, sem estrutura formal?
- Qual o threshold mínimo para "vale a pena recriar" vs. "melhor criar do zero"?

**Status:** Este framework precisa ser desenvolvido por outro agente com expertise em quality assurance educacional. Os 7 passos acima são o brief.

---

## 4. Arquitetura Modular de 3 Camadas

### 4.1. Princípio Fundamental

**"Ao mudar o framework de design instrucional, a pipeline inteira se ajusta automaticamente."**

Isso significa: ZERO lógica hardcoded para qualquer framework nos algoritmos (A1-A16). Todos os algoritmos recebem um `FrameworkConfig` e operam genericamente sobre ele.

### 4.2. As 3 Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1: FRAMEWORK CONFIG (Plugin)                         │
│                                                              │
│  Cada framework = 1 objeto de configuração completo          │
│  Define: stages, time, interactions, quality, assessment     │
│  v1: ELC+ 2026, Kolb 4-Stage, PBL (Hmelo-Silver)           │
│  Futuro: Backward Design, Action Mapping, SAM, ADDIE...     │
└──────────────────────────┬──────────────────────────────────┘
                           │ injeta config
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2: PIPELINE CORE (Genérica)                          │
│                                                              │
│  Analyzer → Architect → Calculator → Validator → Generator   │
│                                                              │
│  Todos os algoritmos recebem framework_config e operam       │
│  genericamente. Nenhum `if framework === "x"` existe.        │
│                                                              │
│  Exemplo: A8 (Duration Allocator) lê                         │
│    framework_config.stages[].time_percentage                  │
│    e distribui tempo. Funciona igual para ELC+ (6 stages),   │
│    Kolb (4 stages) ou PBL (4 phases).                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ valida output
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3: NEUROSCIENCE LAYER (Transversal)                  │
│                                                              │
│  Sempre ativa, independente do framework escolhido.          │
│  Aplica validações baseadas em evidência neurocientífica:    │
│                                                              │
│  • CLT (Sweller): max 4±1 conceitos novos por bloco          │
│  • AGES (Attention): nenhum bloco >30min sem pausa           │
│  • AGES (Generation): todo módulo tem ≥1 atividade ativa     │
│  • AGES (Emotion): ≥50% dos módulos com hook emocional       │
│  • Spaced Repetition: schedule de revisão (1d,3d,7d,14d,30d)│
│  • Retrieval Practice: ≥1 quiz formativo por módulo          │
│  • Dual Coding: material specs incluem visual + texto        │
│                                                              │
│  Score Final = (Framework Quality × 0.7)                     │
│              + (Neuroscience Compliance × 0.3)               │
└─────────────────────────────────────────────────────────────┘
```

### 4.3. Taxonomia de Frameworks

A análise dos benchmarks (`Benchmarks/Learning_Design/` + `Benchmarks/07_Course_Designer/`) revelou **3 tipos fundamentais** de framework. Cada tipo opera em nível diferente:

#### Tipo A: Frameworks de Ciclo de Aprendizagem (v1)
Definem **como o aluno passa por estágios** dentro de um módulo.

| Framework | Estágios | Foco | Status |
|-----------|---------|------|--------|
| **ELC+ 2026** | 6 (Immerse→Integrate) | Experiencial com calibração | v1 |
| **Kolb 4-Stage** | 4 (Experience→Experiment) | Experiencial clássico | v1 |
| **PBL (Hmelo-Silver)** | 4 (Problem→Application) | Problem-first + SDL | v1 |
| Seven Jump (Maastricht) | 7 (Clarify→Synthesize) | PBL granular | Futuro |

#### Tipo B: Frameworks de Design Instrucional (v2+)
Definem **como o curso inteiro é arquitetado** (macro-estrutura).

| Framework | Abordagem | Status |
|-----------|----------|--------|
| Backward Design | Resultado → avaliação → instrução | v2+ |
| Action Mapping | Business goal → comportamento → prática mínima | v2+ |
| ADDIE | Análise → Design → Dev → Implementação → Avaliação | v2+ |
| SAM | Iterativo: prototipar → testar → refinar | v2+ |

#### Tipo C: Princípios Neurocientíficos (Transversais — sempre ativos)
Se aplicam a **qualquer framework** como regras de validação.

| Princípio | Regra | Impacto no Pipeline |
|-----------|-------|---------------------|
| **CLT (Sweller)** | Máx 4±1 conceitos novos por bloco | Calculator: chunk_size |
| **AGES (NeuroLeadership)** | Attention <30min, Generation ativa, Emotion, Spacing | Calculator + Validator |
| **Spaced Repetition (Ebbinghaus)** | Revisões 1d, 3d, 7d, 14d, 30d | Generator: schedule |
| **Retrieval Practice (Roediger)** | Quizzes frequentes, recall ativo | Generator: quiz placement |
| **Dual Coding (Paivio)** | Texto + visual integrado | Generator: material specs |
| **12 Princípios Caine & Caine** | Segurança psicológica, significado, unicidade | Validator: environment checks |

### 4.4. FrameworkConfig — Interface Formal

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
    description: string;           // O que acontece neste estágio
    time_percentage: number;       // % do tempo total do módulo (soma = 100)
    default_interaction: InteractionType;  // Tipo WS1 padrão para este estágio
    purpose: string;               // "Vivência antes da teoria" | "Reflexão guiada"
  }[];

  // Sequenciamento entre módulos
  sequencing: {
    model: "spiral" | "linear" | "problem_complexity";
    levels?: {
      id: string;                  // "fundamentos" | "simple_problem"
      name: string;
      position: "early" | "mid" | "late";
      modules_range: string;       // "1-2" | "3-4"
    }[];
    progression_rule: string;      // "bloom_ascending" | "complexity_ascending"
  };

  // Mapeamento Bloom → Interaction (específico por framework)
  bloom_interaction_map: Record<BloomLevel, {
    interaction: InteractionType;
    turns: number;
    depth_range: string;           // "1-2" | "3-4" | "5-6"
  }>;

  // Ajustes posicionais (como spiral_level afeta o tipo)
  positional_adjustments: {
    position: "early" | "mid" | "late";
    condition: string;             // "bloom >= Analyze" | "bloom == Apply"
    action: string;                // "block_scenario" | "upgrade_to_scenario" | "force_assignment"
    rationale: string;
  }[];

  // Critérios de qualidade específicos do framework
  quality_criteria: {
    id: string;                    // "all_stages_present" | "problem_is_REAL"
    name: string;
    weight: number;                // 0-100 (soma = 100)
    validation_rule: string;       // Regra executável
    failure_message: string;       // Mensagem se falhar
  }[];

  // Dimensões de avaliação (assessment)
  assessment_dimensions: {
    name: string;                  // "Content Knowledge" | "Problem-Solving"
    weight: number;
    levels: string[];              // ["novice", "developing", "proficient", "expert"]
  }[];

  // Requisitos especiais (opcional — PBL precisa, ELC+ não)
  special_requirements?: {
    group_size?: { min: number; max: number };
    sdl_interval?: string;         // "3-5 days"
    facilitator_role?: string;     // "coach" | "guide" | "lecturer"
    problem_design_framework?: string;  // "REAL" | "3Cs" | null
    whiteboard_tool?: boolean;
  };
}
```

### 4.5. Configs dos 3 Frameworks v1

#### ELC+ 2026

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
  - { id: all_stages, name: "Todos os 6 estágios presentes", weight: 30, validation_rule: "every module has all 6 stages" }
  - { id: time_balance, name: "Distribuição de tempo ±5%", weight: 20, validation_rule: "stage time within 5% of target" }
  - { id: bloom_progression, name: "Progressão Bloom ascendente", weight: 25, validation_rule: "module N+1 bloom >= module N bloom" }
  - { id: objective_alignment, name: "Objetivo ↔ Avaliação 1:1", weight: 15, validation_rule: "every objective has assessment" }
  - { id: spiral_coherence, name: "Coerência spiral curriculum", weight: 10, validation_rule: "modules follow spiral levels" }

assessment_dimensions:
  - { name: "Knowledge Application", weight: 30, levels: ["novice", "developing", "proficient", "expert"] }
  - { name: "Experiential Depth", weight: 25, levels: ["surface", "adequate", "deep", "transformative"] }
  - { name: "Reflection Quality", weight: 20, levels: ["superficial", "descriptive", "analytical", "transformative"] }
  - { name: "Integration Transfer", weight: 25, levels: ["minimal", "partial", "substantial", "complete"] }
```

#### Kolb 4-Stage

```yaml
id: kolb_4
name: "Kolb 4-Stage (Experiential Learning Cycle)"
type: learning_cycle

stages:
  - id: experience
    name: "Concrete Experience (Sentir)"
    description: "Experiência direta com o conteúdo"
    time_percentage: 25
    default_interaction: scenario
    purpose: "Vivência concreta"

  - id: reflect
    name: "Reflective Observation (Observar)"
    description: "Observar e refletir sobre a experiência"
    time_percentage: 25
    default_interaction: socratic_dialogue
    purpose: "Reflexão guiada"

  - id: conceptualize
    name: "Abstract Conceptualization (Pensar)"
    description: "Formular teorias e frameworks"
    time_percentage: 25
    default_interaction: quiz
    purpose: "Conceituação abstrata"

  - id: experiment
    name: "Active Experimentation (Fazer)"
    description: "Testar em novos contextos"
    time_percentage: 25
    default_interaction: assignment
    purpose: "Experimentação ativa"

sequencing:
  model: linear
  progression_rule: bloom_ascending

quality_criteria:
  - { id: all_stages, name: "Todos os 4 estágios presentes", weight: 35, validation_rule: "every module has all 4 stages" }
  - { id: time_balance, name: "Distribuição de tempo equilibrada (25% cada ±10%)", weight: 20, validation_rule: "stage time within 10% of 25%" }
  - { id: bloom_progression, name: "Progressão Bloom ascendente", weight: 25, validation_rule: "bloom ascending" }
  - { id: objective_alignment, name: "Objetivo ↔ Avaliação 1:1", weight: 20, validation_rule: "every objective has assessment" }

assessment_dimensions:
  - { name: "Knowledge Application", weight: 35, levels: ["novice", "developing", "proficient", "expert"] }
  - { name: "Experiential Depth", weight: 30, levels: ["surface", "adequate", "deep", "transformative"] }
  - { name: "Reflection Quality", weight: 35, levels: ["superficial", "descriptive", "analytical", "transformative"] }
```

#### PBL (Hmelo-Silver)

```yaml
id: pbl_hmelo
name: "Problem-Based Learning (Hmelo-Silver 4-Phase)"
type: learning_cycle

stages:
  - id: problem_presentation
    name: "Problem Presentation (Problema)"
    description: "Problema complexo, ill-structured, autêntico apresentado ao aluno"
    time_percentage: 15
    default_interaction: scenario
    purpose: "Engajar com problema real ANTES de qualquer instrução"

  - id: group_collaboration
    name: "Group Collaboration (Investigação)"
    description: "Identificar o que sabe, o que precisa aprender, gerar hipóteses"
    time_percentage: 25
    default_interaction: socratic_dialogue
    purpose: "Ativação de prior knowledge, elaboração, hipóteses via questionamento socrático"

  - id: self_directed_learning
    name: "Self-Directed Learning (Pesquisa)"
    description: "Pesquisa independente dos learning issues identificados"
    time_percentage: 35
    default_interaction: assignment
    purpose: "Aluno busca conhecimento autonomamente, constrói entendimento"

  - id: application_reflection
    name: "Application & Reflection (Aplicação)"
    description: "Aplicar conhecimento novo ao problema, refletir sobre o processo"
    time_percentage: 25
    default_interaction: socratic_dialogue
    purpose: "Testar hipóteses, resolver problema, meta-cognição"

sequencing:
  model: problem_complexity
  levels:
    - { id: simple_structured, name: "Problemas Semi-Estruturados", position: early, modules_range: "1-2" }
    - { id: moderate_complex, name: "Problemas Moderados", position: mid, modules_range: "3-5" }
    - { id: ill_structured, name: "Problemas Ill-Structured", position: late, modules_range: "6+" }
  progression_rule: complexity_ascending

quality_criteria:
  - { id: problem_is_REAL, name: "Problemas são REAL (Realistic, Engaging, Aligned, Leads to SDL)", weight: 30, validation_rule: "problem passes REAL framework check" }
  - { id: five_pbl_goals, name: "5 Goals PBL cobertos (Knowledge, Problem-Solving, SDL, Collaboration, Motivation)", weight: 25, validation_rule: "course addresses all 5 PBL goals" }
  - { id: sdl_explicit, name: "Fase SDL explícita em todo módulo", weight: 20, validation_rule: "every module has SDL phase" }
  - { id: bloom_progression, name: "Progressão de complexidade dos problemas", weight: 15, validation_rule: "problems increase in complexity" }
  - { id: reflection_present, name: "Reflexão metacognitiva em todo módulo", weight: 10, validation_rule: "every module has reflection" }

assessment_dimensions:
  - { name: "Content Knowledge (Flexible)", weight: 20, levels: ["inert", "developing", "flexible", "transferable"] }
  - { name: "Problem-Solving", weight: 25, levels: ["surface", "adequate", "strong", "exceptional"] }
  - { name: "Self-Directed Learning", weight: 20, levels: ["minimal", "sufficient", "thorough", "exemplary"] }
  - { name: "Collaboration", weight: 15, levels: ["passive", "reactive", "active", "synergistic"] }
  - { name: "Reflection (Meta-cognition)", weight: 20, levels: ["superficial", "descriptive", "analytical", "transformative"] }

special_requirements:
  group_size: { min: 5, max: 8 }
  sdl_interval: "3-5 days between sessions"
  facilitator_role: "coach"
  problem_design_framework: "REAL"
  whiteboard_tool: true
```

### 4.6. PBL × WS1 — Compatibilidade Natural

O PBL é **extremamente compatível** com o WS1 existente. O Mestre Socrático já é, essencialmente, um facilitador PBL:

| Fase PBL | Comportamento do Mestre WS1 | InteractionType | Turns |
|----------|----------------------------|-----------------|-------|
| Problem Presentation | Apresenta cenário com dilema, trade-offs, decisão forçada | `scenario` | 3-4 |
| Group Collaboration | Questionamento socrático: "O que você já sabe?", "O que precisa descobrir?", "O que mais poderia explicar isso?" | `socratic_dialogue` | 5-6 |
| Self-Directed Learning | Guia pesquisa com perguntas de direção: "Onde você buscaria essa informação?", "Que evidência sustenta isso?" | `assignment` | 6-8 |
| Application & Reflection | Questiona conclusões: "Como isso resolve o problema original?", "O que faria diferente?", "O que aprendeu sobre seu processo?" | `socratic_dialogue` | 4-5 |

**Princípios PBL que o Mestre WS1 já segue:**
- Nunca dá respostas diretas (regra inviolável do WS1)
- Usa questionamento socrático (6 tipos de pergunta)
- Guia sem instruir (scaffolding, not lecturing)
- Provoca reflexão metacognitiva (7 camadas de profundidade)
- Detecta resistência e adapta (5 tipos de resistência)

**O que PBL adiciona ao WS1:**
- Sessão começa com problema ANTES de qualquer instrução (problem-first)
- Fase explícita de SDL onde o aluno pesquisa independentemente
- Assessment em 5 dimensões (não apenas conhecimento)
- Progressão por complexidade dos problemas (não por Bloom)

### 4.7. Como a Pipeline Opera Genericamente

**Exemplo: Algoritmo A8 (Duration Allocator)**

Antes (hardcoded):
```
if framework == "elc_plus":
    distribute(immerse=18%, reflect=12%, ...)
elif framework == "kolb_4":
    distribute(experience=25%, reflect=25%, ...)
```

Depois (genérico):
```
function allocateDuration(total_hours, framework_config):
    for stage in framework_config.stages:
        stage.allocated_hours = total_hours * (stage.time_percentage / 100)
    return stages
```

**Exemplo: Algoritmo A7 (Framework Mapper)**

Antes: lógica específica para mapear ELC+ stages a atividades.

Depois:
```
function mapFrameworkToModule(module, framework_config):
    for stage in framework_config.stages:
        module.addStage({
            stage_id: stage.id,
            interaction: stage.default_interaction,
            time: module.total_time * (stage.time_percentage / 100),
            description: stage.description
        })
    return module
```

**Exemplo: Validator (Fase 4)**

```
function validateBlueprint(blueprint, framework_config, neuroscience_rules):
    // Framework-specific validation
    framework_score = 0
    for criterion in framework_config.quality_criteria:
        passed = evaluate(criterion.validation_rule, blueprint)
        framework_score += passed ? criterion.weight : 0

    // Neuroscience validation (always active)
    neuro_score = 0
    for rule in neuroscience_rules:
        passed = evaluate(rule, blueprint)
        neuro_score += passed ? rule.weight : 0

    // Combined score
    final_score = (framework_score * 0.7) + (neuro_score * 0.3)
    return { framework_score, neuro_score, final_score }
```

### 4.8. Neuroscience Layer — Regras de Validação

Estas regras são aplicadas pelo Validator (Fase 4) a **todo blueprint**, independente do framework:

| # | Princípio | Regra | Threshold | Peso |
|---|-----------|-------|-----------|------|
| N1 | CLT: Chunk Size | Nenhum módulo tem >5 conceitos novos | Max 4±1 por bloco | 20 |
| N2 | AGES: Attention | Nenhum bloco contínuo >30min sem pausa ou atividade | Max 25-30min | 15 |
| N3 | AGES: Generation | Todo módulo tem ≥1 atividade de geração ativa (não consumo passivo) | Min 1 atividade | 20 |
| N4 | AGES: Emotion | ≥50% dos módulos têm hook emocional (story, case, curiosidade) | 50% mínimo | 10 |
| N5 | Spacing | Se total_hours > 4h: schedule de revisão incluído (1d, 3d, 7d) | Obrigatório >4h | 15 |
| N6 | Retrieval | ≥1 quiz formativo (low-stakes) por módulo | Min 1 | 15 |
| N7 | Dual Coding | Material specs incluem componente visual + textual | Sempre | 5 |

**Score Neuroscience (0-100):** Soma dos pesos das regras que passam.

**Score Final do Blueprint:**
```
Score Final = (Framework Quality Score × 0.7) + (Neuroscience Score × 0.3)

Faixas:
  90-100: Excelente — blueprint neurocientificamente otimizado
  70-89:  Bom — poucas melhorias necessárias
  50-69:  Suficiente — várias regras não atendidas
  <50:    Insuficiente — revisar com warnings detalhados
```

---

## 5. Framework de Geração de Interações

### 5.1. O Problema

O WS1 (Pipeline Socrático) suporta 4 tipos de interação:

| Tipo | O que é | Comportamento do Mestre (WS1) | Turns default |
|------|---------|-------------------------------|---------------|
| `socratic_dialogue` | Perguntas abertas que guiam o aluno a descobrir sozinho. Nunca dá respostas diretas. 7 camadas de profundidade | Pergunta socrática → aluno responde → Mestre aprofunda. Progressão: Fatos → Emoções → Significado → Padrões → Origem → Identidade → Transcendência | 20 |
| `quiz` | Perguntas de verificação: múltipla escolha, V/F, resposta curta. Feedback imediato | Apresenta pergunta → aluno responde → Mestre avalia e dá feedback. Mais direto, menos exploratório | 8 |
| `scenario` | Caso prático com dilema e trade-offs. Aluno toma decisões e defende | Apresenta cenário → aluno decide → Mestre questiona premissas e consequências. Foco em tomada de decisão | 12 |
| `assignment` | Guia a criação de um entregável concreto. Aluno produz algo | Mestre guia passo a passo → aluno executa → Mestre dá feedback sobre entregável. Foco em produção | 15 |

**A pergunta é:** Quem decide qual tipo de interação cada parte do curso usa?

### 5.2. As 4 Estratégias

O campo `interaction_strategy` na Camada 5 do Input define como os tipos de interação são distribuídos. Cada estratégia é uma abordagem diferente:

---

#### ESTRATÉGIA 1: `dominant` — "Um tipo para todo o curso"

**O que é:** O instrutor escolhe UM tipo de interação e todo o curso usa esse tipo.

**Quando faz sentido:**
- Instrutor quer uma experiência uniforme
- Curso focado em um único tipo de aprendizado (ex: só diálogo socrático)
- Curso curto (1-4h) onde não faz sentido variar

**Como funciona:**

```
Instrutor seleciona: socratic_dialogue

    Módulo 1 → socratic_dialogue (20 turns)
    Módulo 2 → socratic_dialogue (20 turns)
    Módulo 3 → socratic_dialogue (20 turns)
    ...todo o curso é diálogo socrático
```

**O que o pipeline faz:**
1. Ignora Bloom level e spiral level para efeito de interaction type
2. Aplica o tipo escolhido a TODOS os módulos
3. `expectedDepth` ainda é calculado do Bloom (progressão de profundidade existe)
4. `max_interactions` usa o default do tipo escolhido

**Prós:**
- Simplicidade total
- Instrutor tem controle absoluto
- Experiência previsível para o aluno

**Contras:**
- Perde variedade pedagógica
- Quiz para módulo de Create não faz sentido pedagogicamente
- Não aproveita o potencial do framework

**Exemplo concreto:**

```
Curso: "Feedback para Líderes" (8h)
Estratégia: dominant = socratic_dialogue

Módulo 1 (Bloom: Understand) → socratic (20t) — OK, funciona
Módulo 2 (Bloom: Apply)      → socratic (20t) — OK, funciona
Módulo 3 (Bloom: Evaluate)   → socratic (20t) — Funciona, mas scenario seria melhor
Módulo 4 (Bloom: Create)     → socratic (20t) — Funciona, mas assignment seria melhor
```

---

#### ESTRATÉGIA 2: `bloom_mapped` — "IA decide por módulo baseado no Bloom" (RECOMENDADA)

**O que é:** A IA atribui automaticamente o tipo de interação mais adequado para cada módulo, baseado no nível Bloom dos objetivos E no spiral level (posição no curso).

**Quando faz sentido:**
- Maioria dos casos (default recomendado)
- Instrutor confia na IA para fazer a distribuição
- Curso com progressão clara de complexidade

**Como funciona:**

```
PARA CADA MÓDULO DO BLUEPRINT:

    1. Pegar o Bloom level mais alto dos objetivos do módulo
    2. Pegar o spiral_level do módulo (fundamentos → síntese)
    3. Aplicar regra de mapeamento (tabela abaixo)
    4. Verificar ajustes por spiral_level
    5. Definir interaction_type + max_interactions + expectedDepth
```

**Tabela de mapeamento Bloom → Interaction Type:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  BLOOM LEVEL         →  INTERACTION TYPE     TURNS   DEPTH       │
│  ════════════════════════════════════════════════════════════════ │
│                                                                  │
│  Remember (Lembrar)  →  quiz                  8     "1"-"2"      │
│                                                                  │
│    Por quê: Neste nível o aluno precisa recordar fatos e         │
│    conceitos básicos. Quiz com perguntas diretas (V/F,           │
│    múltipla escolha) é o formato mais eficiente. Diálogo         │
│    socrático seria desperdício — não há profundidade a explorar. │
│                                                                  │
│  Understand (Compreender) → quiz              8     "2"-"3"      │
│                                                                  │
│    Por quê: Aluno precisa demonstrar compreensão, explicar       │
│    conceitos com suas palavras. Quiz com resposta aberta curta   │
│    verifica compreensão rapidamente. Mestre faz perguntas de     │
│    "explique com suas palavras" e "dê um exemplo".               │
│                                                                  │
│  Apply (Aplicar) → socratic_dialogue         20     "3"-"4"      │
│                                                                  │
│    Por quê: Aqui começa a profundidade. Aluno precisa usar       │
│    conhecimento em situações novas. O diálogo socrático guia     │
│    a aplicação sem dar respostas — o aluno descobre fazendo.     │
│    20 turns permite explorar nuances, erros e ajustes.           │
│                                                                  │
│  Analyze (Analisar) → socratic_dialogue      20     "4"-"5"      │
│                                                                  │
│    Por quê: Analisar = decompor, comparar, identificar padrões.  │
│    O diálogo socrático é perfeito para isso — o Mestre faz       │
│    perguntas que forçam decomposição ("O que está por trás       │
│    disso?", "Compare X com Y", "Que padrão você vê?").           │
│                                                                  │
│  Evaluate (Avaliar) → scenario               12     "5"-"6"      │
│                                                                  │
│    Por quê: Avaliar = julgar, defender uma posição, pesar         │
│    trade-offs. Um cenário com dilema real força o aluno a         │
│    tomar posição e justificar. 12 turns: o suficiente para       │
│    apresentar cenário, explorar opções e defender decisão.        │
│                                                                  │
│  Create (Criar) → assignment                 15     "6"-"7"      │
│                                                                  │
│    Por quê: Criar = produzir algo novo. Um assignment guia a     │
│    criação de um entregável concreto (plano, documento,          │
│    apresentação). 15 turns: tempo para briefing, execução         │
│    guiada e feedback sobre o artefato.                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Ajustes por spiral_level:**

Depois do mapeamento Bloom, o sistema verifica o spiral_level e pode ajustar:

```
┌──────────────────────────────────────────────────────────────────┐
│  SPIRAL LEVEL         REGRA DE AJUSTE                            │
│  ════════════════════════════════════════════════════════════════ │
│                                                                  │
│  fundamentos          Se Bloom >= Analyze:                       │
│  (módulos 1-2)          NÃO fazer scenario/assignment ainda.     │
│                         Manter como socratic_dialogue.           │
│                         Razão: é muito cedo no curso para        │
│                         cenários complexos. Aluno ainda está     │
│                         construindo base.                        │
│                                                                  │
│  variação             Manter o que o Bloom mapeou.               │
│  (módulos 3-4)        Sem ajuste.                                │
│                                                                  │
│  conflito_humano      Se Bloom == Apply:                         │
│  (módulos 5-6)          UPGRADE para scenario.                   │
│                         Razão: neste ponto do curso, mesmo       │
│                         "aplicação" envolve stakeholders e       │
│                         trade-offs humanos. Cenário é mais       │
│                         adequado que diálogo puro.               │
│                                                                  │
│  mundo_real           Se Bloom <= Analyze:                       │
│  (módulos 7-8)          UPGRADE para scenario.                   │
│                         Razão: estamos no contexto real do       │
│                         aluno. Tudo deve ter cara de "caso do    │
│                         trabalho", não de exercício acadêmico.   │
│                                                                  │
│  síntese              FORÇAR assignment.                         │
│  (módulos 9-10)       Razão: o módulo final SEMPRE deve ter      │
│                       um entregável concreto. É a demonstração   │
│                       de maestria. Independente do Bloom.        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Exemplo concreto — Curso de PM (40h, 10 módulos):**

```
Mod  Bloom      Spiral           Bloom→Type      Ajuste Spiral     RESULTADO
───────────────────────────────────────────────────────────────────────────────
 1   Apply      fundamentos      socratic(20)    —                 socratic (20t)
 2   Apply      fundamentos      socratic(20)    —                 socratic (20t)
 3   Analyze    variação         socratic(20)    —                 socratic (20t)
 4   Analyze    conflito_humano  socratic(20)    ↑ scenario(12)    scenario (12t)
 5   Evaluate   conflito_humano  scenario(12)    —                 scenario (12t)
 6   Evaluate   mundo_real       scenario(12)    —                 scenario (12t)
 7   Analyze    mundo_real       socratic(20)    ↑ scenario(12)    scenario (12t)
 8   Create     mundo_real       assignment(15)  —                 assignment (15t)
 9   Create     síntese          assignment(15)  forçar            assignment (15t)
10   Create     síntese          assignment(15)  forçar            assignment (15t)

Distribuição final: 3 socratic → 4 scenario → 3 assignment
Progressão: explorar → decidir → criar
```

---

#### ESTRATÉGIA 3: `stage_mapped` — "IA decide por estágio ELC+ dentro de cada módulo"

**O que é:** Ao invés de 1 tipo por módulo inteiro, cada estágio do framework (ELC+ = 6 estágios) dentro do módulo recebe seu próprio tipo de interação. Resultado: dentro de um mesmo módulo, o aluno passa por quiz, diálogo socrático, cenário e assignment.

**Quando faz sentido:**
- Máxima riqueza pedagógica
- Cursos longos (20h+) onde cada módulo é uma experiência completa
- Quando o framework ELC+ é central (é o diferencial do produto)

**Como funciona:**

```
PARA CADA MÓDULO DO BLUEPRINT:
    PARA CADA ESTÁGIO ELC+ DO MÓDULO:

    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    │  ESTÁGIO ELC+            INTERACTION TYPE    TURNS           │
    │  ════════════════════════════════════════════════════════    │
    │                                                              │
    │  IMMERSE (Sentir)    →   scenario             3              │
    │    O aluno VIVE o problema antes de saber a teoria.          │
    │    Cenário com decisão forçada, trade-offs reais.            │
    │    "Você é PM. CEO pede feature. Decida em 15 min."          │
    │                                                              │
    │  REFLECT (Observar)  →   socratic_dialogue    4              │
    │    Reflexão guiada sobre o que acabou de viver.              │
    │    "O que pesou mais na sua decisão?"                        │
    │    "Onde sentiu insegurança? Por quê?"                       │
    │                                                              │
    │  CONCEPTUALIZE       →   quiz                 3              │
    │  (Pensar)                                                    │
    │    Verificar compreensão da teoria/framework.                │
    │    "O que é RICE? Como se calcula?"                          │
    │    "Aplique RICE ao caso anterior."                          │
    │                                                              │
    │  EXPERIMENT (Fazer)  →   socratic_dialogue    5              │
    │    Guiar a REaplicação COM framework.                        │
    │    "Refaça a decisão usando RICE. O que mudou?"              │
    │    "Onde o framework ajudou? Onde limitou?"                   │
    │                                                              │
    │  CALIBRATE (Validar) →   socratic_dialogue    3              │
    │    Feedback e meta-avaliação.                                │
    │    "Compare sua v1 com v2. Qual é melhor? Por quê?"          │
    │    "O que faria diferente?"                                  │
    │                                                              │
    │  INTEGRATE           →   assignment           2              │
    │  (Internalizar)                                              │
    │    Transferência para o mundo real.                           │
    │    "Aplique RICE ao seu backlog real. Traga resultado."      │
    │    Entregável concreto + compromisso 7 dias.                 │
    │                                                              │
    │  TOTAL POR MÓDULO:                           20 turns        │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
```

**Diferença fundamental vs. bloom_mapped:**

```
bloom_mapped:   1 módulo = 1 tipo de interação = 1 sessão WS1 uniforme
stage_mapped:   1 módulo = 6 tipos de interação = 1 sessão WS1 com TRANSIÇÕES

bloom_mapped:   Módulo 3 inteiro é "scenario" (12 turns, mesmo behavior do Mestre)
stage_mapped:   Módulo 3 tem scenario(3) → socratic(4) → quiz(3) → socratic(5) → socratic(3) → assignment(2)
```

**Impacto no WS1:**

Esta estratégia requer uma **extensão do WS1** que ainda não existe:

```
Hoje (WS1 atual):
  Session tem 1 interactionType fixo
  Mestre mantém mesmo behavior por toda sessão

Necessário para stage_mapped:
  Session teria N "stages" com transições
  Mestre receberia stage_config com:
    · Qual estágio ELC+ está ativo
    · Quantos turns neste estágio
    · Quando transicionar
    · Behavior diferente por estágio
  Quando turns do estágio esgotam:
    · Mestre fecha estágio ("Ótimo, vamos para a próxima etapa...")
    · Transiciona para próximo interactionType
    · Reseta behavior
```

**Prós:**
- Experiência pedagogicamente superior — o aluno vive o ciclo ELC+ completo
- Cada estágio tem o tipo de interação ideal para seu propósito
- Diferencial de produto (nenhum concorrente faz isso)

**Contras:**
- Requer extensão do WS1 (sessões com stages)
- Mais complexo de gerar (N questions por módulo em vez de 1)
- Mestre precisa de lógica de transição entre estágios
- Experiência pode parecer "fragmentada" se transições não forem suaves

---

#### ESTRATÉGIA 4: `custom` — "Instrutor define tudo no blueprint"

**O que é:** O pipeline gera o blueprint com `bloom_mapped` como default, e depois o instrutor edita módulo a módulo no Blueprint Viewer, mudando interaction types manualmente.

**Quando faz sentido:**
- Instrutor experiente que sabe exatamente o que quer
- Ajuste fino após geração
- Casos específicos onde o mapeamento automático não faz sentido

**Como funciona:**

```
1. Pipeline gera blueprint com bloom_mapped (default)
2. Blueprint Viewer mostra todos os módulos com tipos atribuídos
3. Instrutor pode clicar em qualquer módulo e mudar:
   · interaction_type (dropdown: socratic, quiz, scenario, assignment)
   · max_interactions (slider: 5-30)
4. Sistema revalida (Quality Scorecard recalculado)
5. Se mudanças degradam qualidade, mostra warning
```

---

### 5.3. Resumo — Quando usar cada estratégia

| Estratégia | Melhor para | Complexidade | Riqueza pedagógica | Requer mudança WS1? |
|-----------|------------|-------------|-------------------|---------------------|
| `dominant` | Cursos curtos, experiência uniforme | Baixa | Baixa | Não |
| `bloom_mapped` | Maioria dos casos (default) | Média | Média-Alta | Não |
| `stage_mapped` | Cursos longos, ELC+ como core | Alta | Muito Alta | **Sim** |
| `custom` | Instrutores experientes, ajuste fino | Média | Variável | Não |

### 5.4. Recomendação

**V1 (lançamento):**
- Default: `bloom_mapped`
- Disponível: `dominant` e `custom`
- `stage_mapped`: roadmap (v2)

**V2 (futuro):**
- Implementar `stage_mapped` com extensão do WS1
- Tornar default para cursos com ELC+

---

## 6. Contrato WS2 → WS1

### 6.1. O que WS1 precisa receber

Quando o blueprint é "aplicado" (vira curso real no Academy), WS2 deve garantir:

**Na tabela `courses`:**

```json
courses.settings = {
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

**Na tabela `chapters` (1 chapter por módulo do blueprint):**

| Campo | Preenchido com | Vem de |
|-------|---------------|--------|
| `title` | Título do módulo | Blueprint module.title |
| `content` | Conteúdo markdown do módulo (resumo + teoria + atividades) | Blueprint module.description + framework_stages content |
| `learningObjective` | Objetivo ABCD do módulo | Blueprint module.objectives[0].text |
| `order` | Ordem do módulo no curso | Blueprint module.order |

**Na tabela `questions` (1+ question por chapter):**

| Campo | Preenchido com | Vem de |
|-------|---------------|--------|
| `text` | Pergunta inicial que inicia a sessão | Gerada alinhada ao módulo, tipo de interação e estágio |
| `expectedDepth` | "1"-"7" (profundidade esperada) | Mapeado do Bloom level do módulo |
| `skill` | Competência que a pergunta avalia | Blueprint module.objectives[0].abcd.behavior |
| `intention` | Intenção pedagógica | "exploração", "verificação", "aplicação", "meta-cognição" |

### 6.2. Mapeamento Bloom → expectedDepth

```
Bloom Level       expectedDepth    Significado no WS1
──────────────────────────────────────────────────────
Remember     →    "1"-"2"          Camadas: Fatos, Emoções
Understand   →    "2"-"3"          Camadas: Emoções, Significado
Apply        →    "3"-"4"          Camadas: Significado, Padrões
Analyze      →    "4"-"5"          Camadas: Padrões, Origem
Evaluate     →    "5"-"6"          Camadas: Origem, Identidade
Create       →    "6"-"7"          Camadas: Identidade, Transcendência
```

### 6.3. Conexão com Learner Profiles (Kolb)

O WS1 já detecta e rastreia o Kolb style de cada aluno no `learner_profiles`. O WS2 pode usar essa informação de duas formas:

1. **Na geração do blueprint:** Se o instrutor sabe o perfil dominante da turma, pode informar na Camada 2 (`role` → Kolb inference). O Architect adapta atividades.

2. **No runtime:** Quando o aluno inicia uma sessão, o Mestre recebe o `kolbDominantStyle` e adapta:
   - **Divergente** → mais perguntas de perspectiva, brainstorm
   - **Assimilador** → mais frameworks, teoria estruturada
   - **Convergente** → mais problemas práticos, aplicação direta
   - **Acomodador** → mais ação, experimentação hands-on

---

## 7. Decisões em aberto

Pontos que precisam do parecer do Hugo:

### 7.1. Bloco A — Escopo & Estratégia (continuação)

| # | Ponto | Status |
|---|-------|--------|
| A1 | Frameworks v1 | **Decidido**: ELC+ + Kolb 4-Stage + PBL (Hmelo-Silver) → ver D1 |
| A2 | Modelo de execução do pipeline (sync/async/streaming) | **Decidido** → D9 |
| A3 | Substituição do Blueprint Proxy Python | **Decidido** → D5 (Big Bang) |

### 7.2. Bloco B — UX & Fluxo (não iniciado)

| # | Ponto | Status |
|---|-------|--------|
| B1 | Experiência de criação (wizard confirmado, detalhes pendentes) | **Decidido** → D10 (Stepper linear 6 steps) |
| B2 | Editabilidade do blueprint pós-geração | **Decidido** → D11 (Edição completa + recálculo Scorecard) |

### 7.3. Bloco C — Dados & Integração (não iniciado)

| # | Ponto | Status |
|---|-------|--------|
| C1 | Blueprint → Curso: o que é criado automaticamente | **Decidido** → D12 |
| C2 | Integração WS1 (Socratic Pipeline): nível de acoplamento | **Decidido** → D13 (Acoplamento leve) |

### 7.4. Bloco D — Qualidade & Limites (não iniciado)

| # | Ponto | Status |
|---|-------|--------|
| D1 | Quality Gate: auto-retry vs. mostrar ao instrutor | **Decidido** → D14 (Mostrar ao instrutor com score + issues + 3 botões) |

### 7.5. Novas questões levantadas nesta sessão

| # | Questão |
|---|---------|
| N1 | Content Analyzer (processa PDFs/PPTX): como implementar? | **Decidido** → D15 (Adiado para v2. V1 aceita topics_outline manual + source_course_id) |
| N2 | Auditor (Caminho B): framework completo ou leve? | **Decidido** → D16 (Auditor completo — todos os 7 passos na v1) |
| N3 | `stage_mapped` requer extensão do WS1 — priorizar para v1 ou v2? | **Decidido** → D17 (V1 — stage_mapped é o coração do sistema. WS1 precisa de sessions multi-stage) |
| N4 | `interaction_strategy`: qual deve ser o default e quais ficar disponíveis na v1? | **Decidido** → D18 (Default = `stage_mapped`. Disponíveis na v1: stage_mapped, bloom_mapped, dominant, custom) |

---

## 8. Glossário

| Termo | Definição |
|-------|-----------|
| **ABCD** | Framework para escrever objetivos de aprendizagem: Audience, Behavior, Condition, Degree |
| **Action Mapping** | Metodologia de Cathy Moore. Foco: comportamento > conteúdo. Tudo deve linkar ao business goal |
| **AGES** | Framework neurocientífico do NeuroLeadership Institute. 4 dimensões: Attention (<30min), Generation (aprendizado ativo), Emotion (engajamento emocional), Spacing (espaçamento) |
| **Andragogia** | Teoria de aprendizagem adulta (Knowles). Adultos são auto-dirigidos, experienciais, orientados a problemas |
| **Bloom's Taxonomy** | Hierarquia cognitiva: Remember → Understand → Apply → Analyze → Evaluate → Create |
| **Blueprint** | Documento JSON completo que descreve a arquitetura pedagógica de um curso |
| **Caminho A** | Criar curso do zero (com ou sem materiais de contexto) |
| **Caminho B** | Recriar/melhorar um curso existente do Academy |
| **CLT (Cognitive Load Theory)** | Teoria de Sweller. Limite cognitivo de 4±1 conceitos novos por bloco de aprendizado. Regra de validação da Neuroscience Layer |
| **Content Analyzer** | Componente novo que extrai conteúdo estruturado de PDFs, PPTX, DOCX |
| **Dual Coding** | Teoria de Paivio. Aprendizado melhora quando informação é apresentada em texto + visual simultaneamente |
| **ELC+ 2026** | Experiential Learning Cycle expandido. 6 estágios: Immerse → Reflect → Conceptualize → Experiment → Calibrate → Integrate |
| **expectedDepth** | Campo em `questions` que indica a profundidade de Bloom esperada ("1"-"7"). O Mestre WS1 usa para calibrar |
| **FrameworkConfig** | Interface TypeScript que define a configuração completa de um framework: stages, time_distribution, interaction_map, quality_criteria, assessment_dimensions, sequencing, special_requirements. Cada framework = 1 FrameworkConfig |
| **Hmelo-Silver** | Cindy Hmelo-Silver — pesquisadora que formalizou o modelo PBL de 4 fases e os 5 Goals do PBL |
| **interaction_strategy** | Campo da Camada 5 que define como os tipos de interação são distribuídos no curso |
| **InteractionType** | Tipo de interação WS1: `socratic_dialogue`, `quiz`, `scenario`, `assignment` |
| **Kirkpatrick** | Framework de avaliação de treinamento. L1: Reação, L2: Aprendizagem, L3: Comportamento, L4: Resultados |
| **Kolb 4-Stage** | Ciclo experiencial original: Experience → Reflection → Conceptualization → Experimentation |
| **Mestre** | Agente WS1 que conduz o diálogo socrático. Recebe interactionType e adapta comportamento |
| **Neuroscience Layer** | Camada transversal de validação (Camada 3 da arquitetura modular). Aplica regras neurocientíficas (CLT, AGES, Spaced Rep, Retrieval, Dual Coding) a qualquer framework. Score = 30% do Score Final |
| **PBL (Problem-Based Learning)** | Aprendizagem baseada em problemas. Modelo Hmelo-Silver 4 fases: Problem Presentation → Group Collaboration → Self-Directed Learning → Application & Reflection |
| **Pre-validation Gate** | Verificação do brief antes do pipeline. Checks obrigatórios + warnings de qualidade |
| **Quality Scorecard** | Score 0-100 composto: (Framework Quality × 0.7) + (Neuroscience Score × 0.3) |
| **REAL Framework** | Critérios para design de problemas PBL: Realistic (autêntico), Engaging (motivador), Aligned (aos objetivos), Leads to SDL (gera pesquisa autônoma) |
| **Retrieval Practice** | Princípio de Roediger & Karpicke. Praticar recordação (quizzes, recall) fortalece memória mais que reler. Mínimo 1 quiz formativo por módulo |
| **SDL (Self-Directed Learning)** | Aprendizagem autodirigida. No PBL, fase onde o aluno pesquisa independentemente os "learning issues" identificados durante a investigação em grupo |
| **Spaced Repetition** | Baseado na curva de esquecimento de Ebbinghaus. Schedule de revisão: 1d, 3d, 7d, 14d, 30d. Obrigatório para cursos >4h |
| **Spiral Curriculum** | Progressão de complexidade: Fundamentos → Variação → Conflito Humano → Mundo Real → Síntese |
| **Tipo A / Tipo B / Tipo C** | Taxonomia de frameworks. A = Ciclos de Aprendizagem (ELC+, Kolb, PBL). B = Design Instrucional (Backward Design, Action Mapping). C = Princípios Neurocientíficos (CLT, AGES, transversais) |
| **ZPD** | Zone of Proximal Development (Vygotsky). O que o aluno faz sozinho vs. com ajuda. Define o teto do blueprint |

---

## Change Log

| Data | Descrição | Autor |
|------|-----------|-------|
| 2026-02-16 | Criação do documento de revisão interativa v1 | Aria (Architect) |
| 2026-02-16 | Upgrade para v2: análise de benchmarks Learning_Design, adição de PBL como framework v1, arquitetura modular de 3 camadas, FrameworkConfig interface, Neuroscience Layer transversal, taxonomia de frameworks (A/B/C), renumeração de seções, expansão do glossário (D6-D8) | Aria (Architect) + Atlas (Analyst) |
| 2026-02-16 | D9: Modelo de Execução = Hybrid SSE + DB Fallback. Análise completa de 4 opções (Sync SSE, Async+Broadcast, Inngest, Hybrid). Hybrid venceu por zero infra adicional, consistência com padrões existentes (ingestion/enrichment SSE), e cobertura de todos os cenários (progresso real-time, navegação livre, retry parcial). Tabela `blueprint_jobs` com `phase_results` JSONB. Upgrade path para Inngest se necessário | Aria (Architect) |
| 2026-02-16 | D10-D13: Stepper linear 6 steps, Edição completa do blueprint, Apply Blueprint (conteúdo IA + questions variáveis), Integração WS1 (acoplamento leve 3 campos opcionais) | Aria (Architect) |
| 2026-02-16 | D14: Quality Gate = Mostrar ao instrutor. Pipeline tem 1 auto-retry embutido; após retry, instrutor vê score + issues + 3 botões (Ver Blueprint / Regenerar / Editar). Transparência sobre qualidade, edição manual via D11 | Aria (Architect) |
| 2026-02-16 | D15-D18: Content Analyzer adiado v2, Auditor completo (7 passos) na v1, stage_mapped na v1 (core do sistema, WS1 extensão necessária), interaction_strategy default = stage_mapped. **Revisão interativa COMPLETA — todas as questões decididas (D1-D18)** | Aria (Architect) |

---

> **Próximo passo:** Revisão interativa COMPLETA. Todas as 18 decisões tomadas (D1-D18). Criar épicos WS2 com base neste documento + `ws2-course-creator-architecture.md`.
