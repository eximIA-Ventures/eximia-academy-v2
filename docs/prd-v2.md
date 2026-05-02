# PRD — exímIA Academy v2.0

**Product Requirements Document**
**Versão:** 2.0
**Data:** 2026-03-03
**Autor:** Orion (AIOS Master Orchestrator)
**Status:** Referência completa para reconstrução do zero

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Personas e Jornadas](#2-personas-e-jornadas)
3. [Requisitos Funcionais](#3-requisitos-funcionais)
4. [Requisitos Não-Funcionais](#4-requisitos-não-funcionais)
5. [Arquitetura Técnica](#5-arquitetura-técnica)
6. [Schema do Banco de Dados](#6-schema-do-banco-de-dados)
7. [Pipeline de IA](#7-pipeline-de-ia)
8. [Mapa de Telas e Rotas](#8-mapa-de-telas-e-rotas)
9. [API REST Pública](#9-api-rest-pública)
10. [Design System](#10-design-system)
11. [Segurança e Compliance](#11-segurança-e-compliance)
12. [Planos e Feature Gating](#12-planos-e-feature-gating)
13. [Integrações](#13-integrações)
14. [Roadmap de Epics](#14-roadmap-de-epics)
15. [Glossário](#15-glossário)

---

## 1. Visão Geral do Produto

### 1.1 O que é

**exímIA Academy** é um LMS (Learning Management System) B2B SaaS para universidades corporativas e academias de treinamento empresarial, com motor de **diálogo pedagógico nativo** baseado em IA generativa.

### 1.2 Problema que resolve

LMS tradicionais medem conclusão e nota em provas — não medem se o colaborador sabe **aplicar** o que aprendeu. A exímIA Academy resolve isso com IA que conversa com o aluno usando técnicas pedagógicas, forçando raciocínio ativo ao invés de consumo passivo.

### 1.3 Proposta de valor

> Uma plataforma onde aprender é fazer — com IA que desafia, questiona e guia o colaborador até a aplicação prática demonstrável.

### 1.4 Mercado-alvo

- Universidades corporativas (empresas de médio/grande porte)
- Academias de treinamento empresarial
- Departamentos de T&D (Treinamento e Desenvolvimento)
- Consultorias de educação corporativa

### 1.5 Idioma

PT-BR como idioma principal. Toda a UI, prompts de IA e documentação são em português brasileiro. Multilingual é scope futuro.

---

## 2. Personas e Jornadas

### 2.1 Personas

#### P1 — Colaborador (Student)

| Atributo | Detalhe |
|----------|---------|
| **Quem é** | Funcionário da empresa matriculado em cursos |
| **Objetivo** | Aprender habilidades relevantes para o cargo atual e crescimento |
| **Dor** | Cursos genéricos, provas que não refletem o trabalho real |
| **Motivação** | Crescimento profissional, reconhecimento, mandatório |
| **Nível técnico** | Variado (júnior a sênior) |

#### P2 — Instrutor (Instructor)

| Atributo | Detalhe |
|----------|---------|
| **Quem é** | Especialista de conteúdo (interno ou externo) |
| **Objetivo** | Criar cursos de alta qualidade rapidamente |
| **Dor** | Criação de conteúdo é lenta e manual |
| **Motivação** | Produtividade, qualidade pedagógica |
| **Nível técnico** | Médio-alto |

#### P3 — Gestor T&D (Manager)

| Atributo | Detalhe |
|----------|---------|
| **Quem é** | Responsável pelo programa de treinamento da empresa |
| **Objetivo** | Métricas reais de aprendizagem, não apenas conclusão |
| **Dor** | ROI de T&D invisível para a diretoria |
| **Motivação** | Provar valor, reduzir turnover, desenvolver equipe |
| **Nível técnico** | Médio |

#### P4 — Admin

| Atributo | Detalhe |
|----------|---------|
| **Quem é** | Responsável técnico pela plataforma na empresa |
| **Objetivo** | Configurar e manter a plataforma |
| **Dor** | Plataformas complexas de configurar |
| **Motivação** | Autonomia, controle |
| **Nível técnico** | Alto |

#### P5 — Super Admin (Eximia)

| Atributo | Detalhe |
|----------|---------|
| **Quem é** | Operador da plataforma (equipe Eximia) |
| **Objetivo** | Gestão de todos os clientes (tenants) |
| **Dor** | Precisar acessar banco de dados para operações |
| **Motivação** | Eficiência operacional |

### 2.2 Jornadas

#### J1 — Jornada do Colaborador (Student)

```
1. Recebe convite por email do admin
2. Aceita convite → define senha
3. Primeiro login → Onboarding Wizard:
   a. Status profissional (cargo, experiência)
   b. Estilo de aprendizagem preferido (ler/ouvir/assistir)
   c. Objetivos e áreas de interesse
4. Dashboard → vê cursos matriculados + disponíveis
5. Entra em curso → lê capítulo → clica "Iniciar Sessão"
6. Chat com IA pedagógica:
   a. IA faz pergunta provocativa baseada no conteúdo
   b. Aluno responde
   c. IA analisa resposta, faz nova pergunta aprofundando
   d. Ciclo repete até N interações (default 20)
   e. Smart closing sugere encerramento quando profundidade atingida
7. Sessão encerra → resumo com score
8. [Opcional] Faz assessment Big Five / DISC
9. Vê "Meu Perfil" com perfil implícito (Kolb) + explícito (Big Five/DISC)
10. Recebe recomendação de trilha baseada em cargo + perfil
11. Segue trilha → completa cursos na ordem → progresso visível
12. Faz quiz/exame quando disponível
13. Completa trilha → próxima sugestão baseada em crescimento
```

#### J2 — Jornada do Instrutor

```
1. Admin promove usuário para instructor + configura permissões
2. Instrutor acessa dashboard `/instructor`
3. Opção A — Criação manual:
   a. Cria curso (título, descrição, área)
   b. Cria capítulos (rich text, vídeo, áudio)
   c. Gera questões pedagógicas via IA (até 3/capítulo)
   d. Revisa/aprova questões
   e. Publica curso
4. Opção B — Course Designer (IA):
   a. Wizard de 6 etapas (brief → upload → framework → config → review → apply)
   b. IA gera blueprint pedagógico completo
   c. Instrutor revisa/edita blueprint
   d. "Apply" cria curso + capítulos + questões automaticamente
5. Opção C — Ingestão de conteúdo:
   a. Upload PDF/DOCX/PPTX/TXT/áudio
   b. IA extrai e estrutura conteúdo em capítulos
   c. Instrutor revisa e aprova
6. [Opcional] Cria quizzes a partir do pool de questões
7. [Opcional] Enriquece curso (IA busca fontes externas complementares)
8. Monitora analytics dos seus alunos
```

#### J3 — Jornada do Gestor T&D (Manager)

```
1. Acessa dashboard com métricas executivas
2. Vê: alunos ativos, taxa de engajamento, taxa de conclusão
3. Cria áreas organizacionais (departamentos)
4. Cria cargos com senioridade (junior → manager)
5. Cria trilhas de aprendizagem por cargo
6. Ativa trilha → auto-enrollment dos colaboradores do cargo
7. Monitora progresso da equipe por trilha e cargo
8. Vê perfil comportamental agregado da equipe (DISC + Big Five)
9. Identifica gaps de competência
10. Exporta dados em CSV
```

#### J4 — Jornada do Admin

```
1. Configura branding (logo, cores)
2. Configura whitelabel (nome da app, tagline, login text, CSS)
3. Convida usuários por email
4. Gerencia roles (student → instructor → manager → admin)
5. Configura permissões granulares de instructors
6. Gerencia áreas e vincula usuários
7. Configura SSO (Google OAuth, SAML)
8. Configura session timeout
9. Gerencia API keys e webhooks
10. Vê plano atual e features disponíveis
11. Gerencia biblioteca digital (livros)
```

#### J5 — Jornada do Super Admin

```
1. Acessa portal `/super-admin`
2. Cria novo tenant (nome, slug, plano, SSO, branding)
3. Visualiza todos os tenants com métricas
4. Seleciona tenant para "impersonar" contexto
5. Gerencia feature matrix por plano
6. Visualiza audit log cross-tenant
7. Gerencia usuários de qualquer tenant
```

---

## 3. Requisitos Funcionais

### 3.1 Autenticação e Multi-tenancy

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-AUTH-01** | Autenticação por email/senha com Supabase Auth | P0 |
| **FR-AUTH-02** | OAuth com Google (callback → sync avatar/nome → auto-provisioning com tenant_id) | P0 |
| **FR-AUTH-03** | SAML SSO para Azure AD e Okta (auto-provisioning, role=student por padrão) | P1 |
| **FR-AUTH-04** | Convite por email (token-based, rota `/accept-invite`) | P0 |
| **FR-AUTH-05** | Reset de senha via email | P0 |
| **FR-AUTH-06** | Multi-tenancy por subdomínio (`empresa.eximia.academy`) | P0 |
| **FR-AUTH-07** | Isolamento de dados via RLS (PostgreSQL) com `auth_tenant_id()` | P0 |
| **FR-AUTH-08** | 5 roles: `student`, `instructor`, `manager`, `admin`, `super_admin` | P0 |
| **FR-AUTH-09** | Session timeout configurável por tenant (polling a cada 60s) | P1 |
| **FR-AUTH-10** | Whitelabel: app name, tagline, login text, favicon, footer, custom CSS | P1 |
| **FR-AUTH-11** | Branding: logo URL, cor primária, cor secundária (CSS vars runtime) | P0 |

### 3.2 Gestão de Cursos

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-COURSE-01** | CRUD de cursos com status: draft → published → archived | P0 |
| **FR-COURSE-02** | Campos: título, descrição, tipo (regular/onboarding), área, settings JSONB | P0 |
| **FR-COURSE-03** | CRUD de capítulos com: título, conteúdo rich text, learning_objective, ordem, status | P0 |
| **FR-COURSE-04** | Upload multimídia por capítulo: vídeo (URL), áudio (URL) | P1 |
| **FR-COURSE-05** | Content blocks JSONB (editor Plate.js com blocos estruturados) | P1 |
| **FR-COURSE-06** | Configuração por capítulo: `interaction_type` (socratic/quiz/scenario/assignment), `bloom_target` | P1 |
| **FR-COURSE-07** | Key concepts (TEXT[]) e estimated_reading_time_min por capítulo | P2 |
| **FR-COURSE-08** | Geração de até 3 questões pedagógicas por capítulo via IA (Creator Agent) | P0 |
| **FR-COURSE-09** | Questões com: text, skill, intention, expected_depth, common_shallow_answer, followup_prompts, citations | P0 |
| **FR-COURSE-10** | Tipos de questão: multiple_choice, true_false, open_ended | P0 |
| **FR-COURSE-11** | Questões com status: draft → pending → active → archived | P0 |
| **FR-COURSE-12** | Geração batch de questões por curso inteiro (async job) | P1 |
| **FR-COURSE-13** | Publicação de curso requer ≥1 questão ativa por capítulo | P0 |
| **FR-COURSE-14** | Cursos vinculados a áreas organizacionais | P1 |

### 3.3 Ingestão de Conteúdo

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-INGEST-01** | Upload de PDF com extração de texto (pdf-parse) | P1 |
| **FR-INGEST-02** | Upload de DOCX com extração (mammoth) | P1 |
| **FR-INGEST-03** | Upload de PPTX com extração (pptx-parser) | P1 |
| **FR-INGEST-04** | Upload de TXT direto | P1 |
| **FR-INGEST-05** | Upload de áudio com transcrição (OpenAI Whisper) | P2 |
| **FR-INGEST-06** | Ingestão de URL de YouTube (transcrição) | P2 |
| **FR-INGEST-07** | Paste de texto direto | P1 |
| **FR-INGEST-08** | Pipeline: upload → extract → AI process → review → approve → criar capítulo | P1 |
| **FR-INGEST-09** | IA (Organizer Agent) estrutura conteúdo bruto em capítulos | P1 |
| **FR-INGEST-10** | Status SSE polling para jobs de ingestão | P1 |

### 3.4 Enriquecimento de Conteúdo

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ENRICH-01** | Job de enriquecimento por curso (IA busca fontes web via Tavily) | P2 |
| **FR-ENRICH-02** | Tabela `enrichment_jobs` com status: pending → processing → review → applying → completed/failed | P2 |
| **FR-ENRICH-03** | Fontes com: título, URL, snippet, relevance_score, ai_rationale | P2 |
| **FR-ENRICH-04** | Instrutor revisa e aprova/rejeita cada fonte | P2 |
| **FR-ENRICH-05** | Ações: `incorporate` (adicionar ao capítulo) ou `reference` (link externo) | P2 |
| **FR-ENRICH-06** | SSE polling para progresso do job | P2 |

### 3.5 Course Designer (Design Instrucional por IA)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-DESIGN-01** | Wizard de 6 etapas: brief → upload → framework → config → review → apply | P1 |
| **FR-DESIGN-02** | 3 frameworks pedagógicos: ELC+ 2026, Kolb 4-Stage, PBL (Hmelo-Silver) | P1 |
| **FR-DESIGN-03** | 5 sub-agentes: Analyzer, Architect, Calculator, Generator, Validator | P1 |
| **FR-DESIGN-04** | Camada de neurociência: CLT (Carga Cognitiva), AGES, Spaced Repetition | P1 |
| **FR-DESIGN-05** | Quality Scorecard: Alinhamento (30%) + Bloom (20%) + ELC+ (25%) + Duração (15%) + Carga Cognitiva (10%) | P1 |
| **FR-DESIGN-06** | Blueprint editável pelo instrutor antes de "Apply" | P1 |
| **FR-DESIGN-07** | "Apply" cria curso + capítulos + questões automaticamente | P1 |
| **FR-DESIGN-08** | Blueprint com: módulos, objetivos ABCD, assessments Kirkpatrick, Bloom progression | P1 |
| **FR-DESIGN-09** | Módulos com: spiral_level, interaction_type, framework_stages, cognitive_load, chunks, rubrics | P1 |
| **FR-DESIGN-10** | Audit de curso existente (IA avalia qualidade pedagógica) | P2 |
| **FR-DESIGN-11** | AI-fill: preenche campos do curso automaticamente baseado em conteúdo | P2 |

### 3.6 Motor de Diálogo Pedagógico

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-DIALOG-01** | Pipeline síncrono: Mestre → Polidor → Guardião com retry até 2x | P0 |
| **FR-DIALOG-02** | Mestre: resposta de 2 parágrafos (feedback + 1 pergunta aberta), max 150 palavras | P0 |
| **FR-DIALOG-03** | Polidor: refinamento linguístico, gramática PT-BR, remove rótulos artificiais | P0 |
| **FR-DIALOG-04** | Guardião: validação em 6 critérios (não dá resposta direta, termina com pergunta, sem labels, referencia input, conectado ao capítulo, pedagogicamente eficaz). Retorna verdict (APPROVED/REJECTED), score 0-10, criteria_results | P0 |
| **FR-DIALOG-05** | Retry: se Guardião rejeita, Mestre recebe feedback e tenta novamente (max 2x) | P0 |
| **FR-DIALOG-06** | Claim atômico de turno via RPC PostgreSQL (`claim_session_turn`) | P0 |
| **FR-DIALOG-07** | Release de turno em caso de falha de pipeline (`release_session_turn`) | P0 |
| **FR-DIALOG-08** | Counter de interações restantes visível no chat | P0 |
| **FR-DIALOG-09** | Auto-complete de sessão quando interações = 0 | P0 |
| **FR-DIALOG-10** | Streaming word-by-word via DataStream protocol | P0 |
| **FR-DIALOG-11** | 8 circuit breakers no Mestre: off-topic, frustração, pedido de resposta, etc. | P0 |
| **FR-DIALOG-12** | 4 tipos de interação com limites default: socratic (20), quiz (8), scenario (12), assignment (15) | P1 |
| **FR-DIALOG-13** | Bloom target por capítulo: remembering → understanding → applying → analyzing → evaluating → creating | P1 |
| **FR-DIALOG-14** | 7 camadas de profundidade: Fatos → Emoções → Significado → Padrões → Origem → Identidade → Transcendência | P1 |
| **FR-DIALOG-15** | Smart closing: sugere encerramento quando profundidade ≥ 6, insights ≥ 2, restam ≤ 5 | P1 |
| **FR-DIALOG-16** | Max interações configurável por tenant (default 20, min 3) | P0 |
| **FR-DIALOG-17** | Questão aleatória por capítulo via `get_random_active_question()` RPC | P0 |
| **FR-DIALOG-18** | Sanitização de mensagem do aluno (anti-prompt-injection) | P0 |
| **FR-DIALOG-19** | Persistência: messages (role/content/turn), analyses (ai_detection/metrics/flags), qa_reports (verdict/score/criteria) | P0 |

### 3.7 Shadow Pipeline (Background)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-SHADOW-01** | Pipeline fire-and-forget após cada turno (não bloqueia resposta) | P1 |
| **FR-SHADOW-02** | Detector: sempre roda — detecção de IA/cópia, padrões cognitivos, jornada de profundidade | P1 |
| **FR-SHADOW-03** | Perfilador: roda a cada 5 turnos — perfil Kolb (grasping_axis, transforming_axis, dominant_style) | P1 |
| **FR-SHADOW-04** | Merge incremental: média móvel exponencial para numéricos, union para arrays (cap 5) | P1 |
| **FR-SHADOW-05** | Confidence caps por session_count: 1→0.15, 3→0.30, 5→0.50, 10→0.70, 10+→0.90 | P1 |
| **FR-SHADOW-06** | Persiste em `sessions.analytics` (Detector) e `learner_profiles` (Perfilador) | P1 |
| **FR-SHADOW-07** | Analyst: roda em paralelo ao pipeline síncrono — métricas de qualidade, depth_score, relevance | P1 |

### 3.8 Model Router

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ROUTER-01** | Tabela de roteamento: 6 agentes × 3 planos = 18 combinações | P0 |
| **FR-ROUTER-02** | 3 providers: OpenAI (`@ai-sdk/openai`), DeepSeek (`@ai-sdk/openai-compatible`), Google (`@ai-sdk/google`) | P0 |
| **FR-ROUTER-03** | Fallback chains automáticas: gpt-4.1 → deepseek → gemini-2.5-pro | P0 |
| **FR-ROUTER-04** | Override de custo: standard + mestre + quiz → gpt-4.1-mini | P1 |
| **FR-ROUTER-05** | Providers inicializados como singletons lazy | P1 |
| **FR-ROUTER-06** | Zero Claude/Anthropic em produção | P0 |

### 3.9 Matrículas e Progresso

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ENROLL-01** | Auto-enrollment ao publicar curso (alunos do tenant) | P0 |
| **FR-ENROLL-02** | Status: active → completed → dropped | P0 |
| **FR-ENROLL-03** | Progress JSONB com % por capítulo e % geral | P0 |
| **FR-ENROLL-04** | `update_enrollment_progress()` RPC atômico | P0 |
| **FR-ENROLL-05** | Enrollment com `trail_id` + `trail_course_order` para trilhas | P1 |
| **FR-ENROLL-06** | Soft delete (deleted_at) para LGPD | P0 |

### 3.10 Quizzes e Avaliações

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-QUIZ-01** | 3 tipos: practice (repetível, sem nota), exam (limitado, nota), diagnostic (gaps, sem nota) | P1 |
| **FR-QUIZ-02** | Instrutor seleciona questões do pool → configura regras | P1 |
| **FR-QUIZ-03** | Regras: time_limit_minutes, passing_score (70 default), max_attempts (3 default), shuffle_questions, show_answers_after (completion/never/always) | P1 |
| **FR-QUIZ-04** | Aluno: timer countdown → navega questões → submete → score instantâneo | P1 |
| **FR-QUIZ-05** | Auto-scoring para multiple_choice e true_false | P1 |
| **FR-QUIZ-06** | Open-ended: status `pending_review` → instrutor avalia manualmente (v1) | P1 |
| **FR-QUIZ-07** | Status do attempt: in_progress → completed/timed_out/abandoned → passed/failed/pending_review | P1 |
| **FR-QUIZ-08** | Answers JSONB + feedback JSONB por attempt | P1 |
| **FR-QUIZ-09** | Analytics: taxa de aprovação, questões mais difíceis, distribuição de notas | P1 |
| **FR-QUIZ-10** | Retry: se falhou → mostra capítulos para revisar → pode tentar novamente se attempts restam | P1 |

### 3.11 Trilhas de Aprendizagem

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-TRAIL-01** | Modelo: Área → Cargo (com senioridade) → Trilha (sequência de cursos) | P1 |
| **FR-TRAIL-02** | Trail builder com drag-and-drop (dnd-kit/sortable) para ordenação | P1 |
| **FR-TRAIL-03** | Cursos na trilha: order, is_required (obrigatório/opcional), estimated_hours | P1 |
| **FR-TRAIL-04** | Status machine: draft → active → archived | P1 |
| **FR-TRAIL-05** | Auto-enrollment ao ativar trilha (batch até 500 usuários com matching job_role) | P1 |
| **FR-TRAIL-06** | Progresso agregado por trilha (% de cursos concluídos) | P1 |
| **FR-TRAIL-07** | "Próximo curso" quando aluno completa etapa da trilha | P1 |
| **FR-TRAIL-08** | Dashboard de manager: progresso da equipe por trilha e cargo | P1 |
| **FR-TRAIL-09** | Recomendação: 70% cargo/área + 30% perfil comportamental | P1 |
| **FR-TRAIL-10** | Badge "Recomendado para seu perfil" se profile_score > 70 | P1 |
| **FR-TRAIL-11** | Trilhas são lineares em v1 (branching em v2) | - |

### 3.12 Cargos (Job Roles)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-JOB-01** | CRUD de cargos por tenant | P1 |
| **FR-JOB-02** | Campos: name, slug (unique/tenant), area_id, seniority_level | P1 |
| **FR-JOB-03** | Seniority: junior, mid, senior, lead, manager | P1 |
| **FR-JOB-04** | Users vinculados via `users.job_role_id` | P1 |
| **FR-JOB-05** | Trilhas vinculadas via `learning_trails.target_job_role_id` | P1 |

### 3.13 Assessments Comportamentais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ASSESS-01** | Big Five (IPIP-NEO): 44 itens, Likert 5 pontos, 5 dimensões 0-100 | P1 |
| **FR-ASSESS-02** | DISC: 28 itens, 7 grupos de 4, ranking forçado, 12 tipos possíveis | P1 |
| **FR-ASSESS-03** | Cooldown de 30 dias entre repetições (enforced server-side) | P0 |
| **FR-ASSESS-04** | Resultados em RadarChart (recharts) | P1 |
| **FR-ASSESS-05** | Linguagem não-julgadora nas descrições de resultados | P1 |
| **FR-ASSESS-06** | Persistência em `assessment_history` (assessment_type, result JSONB) | P1 |
| **FR-ASSESS-07** | Server actions NÃO aceitam userId como parâmetro — usam `supabase.auth.getUser()` | P0 |

### 3.14 Perfil de Aprendizagem

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-PROFILE-01** | Dashboard unificado `/profile/learning`: perfil implícito (Kolb) + explícito (Big Five + DISC) | P1 |
| **FR-PROFILE-02** | Funciona sem assessments (mostra perfil implícito + CTAs para completar) | P1 |
| **FR-PROFILE-03** | Learning insights personalizados (3-5 actionable, rule-based) | P1 |
| **FR-PROFILE-04** | Navegação "Meu Perfil" no menu do student | P1 |
| **FR-PROFILE-05** | Visão agregada de equipe para manager `/team/profiles`: DISC pie, Big Five radar avg, gap analysis | P1 |
| **FR-PROFILE-06** | Privacidade: manager vê apenas tipo dominante, não scores individuais | P0 |
| **FR-PROFILE-07** | Filtros por área e cargo na visão de equipe | P1 |
| **FR-PROFILE-08** | Super admin excluído de queries de equipe (tenant_id=NULL) | P0 |

### 3.15 Adaptation Hints (Personalização da IA)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ADAPT-01** | Função `buildAdaptationHints(scores)`: BigFive + DISC → 5 hints pedagógicos | P1 |
| **FR-ADAPT-02** | Hints: communication_style, content_preferences, challenge_level, pace_preference, examples_type | P1 |
| **FR-ADAPT-03** | Regras Big Five: openness → examples_type, conscientiousness → pace, extraversion → communication, neuroticism → challenge | P1 |
| **FR-ADAPT-04** | DISC override se tipo dominante > 35% do total | P1 |
| **FR-ADAPT-05** | Injetado como seção `## Adaptation Hints` no system prompt do Mestre | P1 |
| **FR-ADAPT-06** | Default neutro se sem assessment (fallback gracioso) | P1 |
| **FR-ADAPT-07** | Authorization guard: só o próprio user ou admin/super_admin pode acessar hints | P0 |
| **FR-ADAPT-08** | Hints salvos em `sessions.adaptation_hints` para analytics | P2 |

### 3.16 Dashboards

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-DASH-01** | Student dashboard: cursos matriculados, progresso, sessões recentes, próxima ação | P0 |
| **FR-DASH-02** | Instructor dashboard: meus cursos, meus alunos (filtrado por área), analytics summary, sessões da semana | P1 |
| **FR-DASH-03** | Manager dashboard: alunos ativos, taxa de engajamento, taxa de conclusão, cursos table, KPIs pedagógicos | P0 |
| **FR-DASH-04** | Admin dashboard: hero overview + 3 feature cards | P0 |
| **FR-DASH-05** | Super admin dashboard: métricas cross-tenant | P1 |
| **FR-DASH-06** | Analytics avançado `/analytics`: depth distribution, breakthrough rate, AI detection, Kolb scatter, cognitive patterns, emotional journey, divergence table | P1 |
| **FR-DASH-07** | Session detail view `/analytics/sessions/[id]` | P1 |
| **FR-DASH-08** | Student detail view `/analytics/students/[id]` | P1 |
| **FR-DASH-09** | Weekly engagement chart (12 semanas, recharts) | P1 |

### 3.17 Administração

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ADMIN-01** | Gestão de usuários: convidar por email, editar role, desativar | P0 |
| **FR-ADMIN-02** | Gestão de áreas organizacionais (CRUD + vincular usuários) | P1 |
| **FR-ADMIN-03** | Gestão de cargos (job roles) | P1 |
| **FR-ADMIN-04** | Configuração de tenant: branding, AI model, max interações, features, whitelabel, SSO, timeout | P0 |
| **FR-ADMIN-05** | Promoção para instructor com permissões granulares | P1 |
| **FR-ADMIN-06** | Gestão de API keys: criar, rotacionar, ver usage | P2 |
| **FR-ADMIN-07** | Gestão de webhooks: URL, eventos, testar, ver deliveries | P2 |
| **FR-ADMIN-08** | Gestão de planos/features (super admin): editar matrix por plano | P1 |
| **FR-ADMIN-09** | Audit log para operações de super admin | P1 |

### 3.18 Super Admin

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-SUPER-01** | Portal `/super-admin` com layout próprio | P1 |
| **FR-SUPER-02** | CRUD de tenants (nome, slug, plano, SSO, branding) | P1 |
| **FR-SUPER-03** | Impersonação de tenant via cookie `x-sa-active-tenant` | P1 |
| **FR-SUPER-04** | Visualização de audit log cross-tenant | P1 |
| **FR-SUPER-05** | Gestão de feature matrix global | P1 |

### 3.19 Biblioteca Digital

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-LIB-01** | CRUD de livros: título, autor, synopsis, categorias, tags, cover image, PDF | P2 |
| **FR-LIB-02** | Upload de PDF e cover para Supabase Storage | P2 |
| **FR-LIB-03** | Capítulos de livro (chapter + summary type) | P2 |
| **FR-LIB-04** | Busca por título, autor, categoria | P2 |
| **FR-LIB-05** | Leitor integrado (PDF viewer) | P2 |
| **FR-LIB-06** | Ratings e reviews | P2 |

### 3.20 Onboarding

| ID | Requisito | Prioridade |
|----|-----------|------------|
| **FR-ONBOARD-01** | Wizard de onboarding para students no primeiro login | P0 |
| **FR-ONBOARD-02** | Etapas: status profissional, estilo de aprendizagem, objetivos | P0 |
| **FR-ONBOARD-03** | `users.onboarding_completed` flag | P0 |
| **FR-ONBOARD-04** | Redirect automático se onboarding não completado (middleware) | P0 |
| **FR-ONBOARD-05** | Curso de onboarding (type=onboarding) opcional por tenant | P2 |

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-PERF-01** | LCP (Largest Contentful Paint) | < 2s |
| **NFR-PERF-02** | Pipeline de IA (Mestre→Polidor→Guardião) com streaming | < 5s first token |
| **NFR-PERF-03** | API routes (não-IA) | < 500ms |
| **NFR-PERF-04** | Feature gate check (cached) | < 5ms |
| **NFR-PERF-05** | Claim de turno atômico | < 100ms |

### 4.2 Disponibilidade

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-AVAIL-01** | Uptime geral | 99.5% |
| **NFR-AVAIL-02** | Fallback de provider IA | Automático, < 10s switch |
| **NFR-AVAIL-03** | Graceful degradation sem IA | Conteúdo acessível, chat indisponível |

### 4.3 Segurança

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-SEC-01** | RLS em todas as tabelas (zero cross-tenant leak) | Mandatório |
| **NFR-SEC-02** | Sanitização de input do aluno (anti-injection) | Mandatório |
| **NFR-SEC-03** | OWASP Top 10 compliance | Mandatório |
| **NFR-SEC-04** | API keys com HMAC hash (nunca armazenado plain) | Mandatório |
| **NFR-SEC-05** | Webhook secrets com HMAC signing | Mandatório |
| **NFR-SEC-06** | Rate limiting em todas as rotas | Mandatório |
| **NFR-SEC-07** | Session timeout enforcement (server-validated) | Mandatório |
| **NFR-SEC-08** | CORS configurável por API key | Mandatório |

### 4.4 Privacidade (LGPD)

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-LGPD-01** | Export de dados pessoais via API (`/api/privacy/export`) | Mandatório |
| **NFR-LGPD-02** | Soft delete com 30 dias de retenção | Mandatório |
| **NFR-LGPD-03** | Anonimização via `lgpd_soft_delete_user()` | Mandatório |
| **NFR-LGPD-04** | Audit log de operações de super admin | Mandatório |
| **NFR-LGPD-05** | Sessions com `student_id` nullable (para anonimização) | Mandatório |

### 4.5 Acessibilidade

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-A11Y-01** | WCAG AA | Mandatório |
| **NFR-A11Y-02** | ARIA roles corretos em formulários de assessment | Mandatório |
| **NFR-A11Y-03** | Componentes @eximia/ui com labels/roles | Mandatório |
| **NFR-A11Y-04** | Contraste mínimo 4.5:1 (texto normal), 3:1 (texto grande) | Mandatório |

### 4.6 Observabilidade

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-OBS-01** | Error tracking: Sentry (client/server/edge) | Mandatório |
| **NFR-OBS-02** | Product analytics: PostHog (eventos + feature flags) | Mandatório |
| **NFR-OBS-03** | Pipeline analytics: tokens, custo, retry count via PostHog events | Recomendado |
| **NFR-OBS-04** | Sentry spans nos agentes de IA (agent.Socrates, agent.Editor, etc.) | Recomendado |
| **NFR-OBS-05** | Vercel Analytics + SpeedInsights | Recomendado |

### 4.7 Compatibilidade

| ID | Requisito | Target |
|----|-----------|--------|
| **NFR-COMPAT-01** | Chrome, Firefox, Safari, Edge (últimas 2 versões) | Mandatório |
| **NFR-COMPAT-02** | Responsive (desktop + tablet) | Mandatório |
| **NFR-COMPAT-03** | Mobile web básico (não-otimizado para mobile-first) | Desejável |

---

## 5. Arquitetura Técnica

### 5.1 Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 15 (App Router, React Server Components)               │
│  Tailwind v4 + @eximia/ui (Design System)                       │
│  PostHog (analytics) + Sentry (errors) + Vercel SpeedInsights   │
├─────────────────────────────────────────────────────────────────┤
│                         API LAYER                                │
│  Next.js API Routes + Server Actions                             │
│  Rate Limiting: Upstash Redis (13 limiters)                      │
│  Public API: /api/v1/* (Bearer token, scopes, CORS)              │
├─────────────────────────────────────────────────────────────────┤
│                         AI LAYER                                 │
│  Vercel AI SDK (generateObject + DataStream)                     │
│  Model Router (3 providers × 6 agents × 3 plans)                │
│  ┌─ OpenAI (gpt-4.1, gpt-4.1-mini)                             │
│  ├─ DeepSeek V3 (@ai-sdk/openai-compatible)                     │
│  └─ Google Gemini (fallback: 2.5-pro, 2.5-flash)               │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                               │
│  PostgreSQL 16 (Supabase) + Drizzle ORM                         │
│  RLS: auth_tenant_id() + auth_user_role() + is_super_admin()    │
│  33 tabelas, 43 migrações SQL                                    │
│  Storage: Supabase Storage (books, materials)                    │
├─────────────────────────────────────────────────────────────────┤
│                         AUTH LAYER                               │
│  Supabase Auth (email/senha + Google OAuth + SAML SSO)           │
│  Session: cookie-based, server-validated                         │
│  API Keys: HMAC-hashed, scoped, rate-limited                    │
├─────────────────────────────────────────────────────────────────┤
│                         HOSTING                                  │
│  Vercel (app + API routes + edge functions)                      │
│  Supabase Cloud (DB + Auth + Storage + Edge Functions)           │
│  Upstash Redis (rate limiting)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Monorepo

| Package | Nome | Propósito |
|---------|------|-----------|
| `apps/web` | @eximia/web | Next.js 15 — frontend + API |
| `packages/agents` | @eximia/agents | Motor de diálogo pedagógico (6 agentes) |
| `packages/course-designer` | @eximia/course-designer | Pipeline de design instrucional (5 agentes) |
| `packages/database` | @eximia/database | Schema Drizzle + client PostgreSQL |
| `packages/shared` | @eximia/shared | Tipos, validators Zod, constantes, utils |
| `packages/ui` | @eximia/ui | Design system (29+ componentes) |

### 5.3 Middleware Pipeline

```
Request
  ├── /api/v1/* → API Key Auth → Scope Check → Per-key Rate Limit → CORS → Handler
  ├── /api/* → IP Rate Limit → User Rate Limit (post-auth) → Handler
  └── /* → Supabase Session Check
       ├── Unauthenticated → /login redirect
       ├── Student + !onboarding → /onboarding redirect
       ├── Super Admin → /super-admin redirect (or cookie check)
       ├── Instructor → block /admin/users, /admin/settings, etc.
       └── Authenticated → Handler
```

### 5.4 Context Providers (Client)

```
<RootLayout>
  <PostHogProvider>
    <ToastProvider>
      <PlatformLayout>  ← Server: auth + tenant resolution
        <QueryProvider>
          <PostHogIdentify>
            <TenantProvider>
              <AreaProvider>
                <SessionTimeoutProvider>
                  <Sidebar />
                  <Header />
                  {children}
                </SessionTimeoutProvider>
              </AreaProvider>
            </TenantProvider>
          </PostHogIdentify>
        </QueryProvider>
      </PlatformLayout>
    </ToastProvider>
  </PostHogProvider>
</RootLayout>
```

---

## 6. Schema do Banco de Dados

### 6.1 Diagrama de Relações (Simplificado)

```
tenants (root)
  ├── users (tenant_id FK) ← auth.users
  │    ├── enrollments (student_id FK)
  │    ├── sessions (student_id FK, nullable for LGPD)
  │    ├── instructor_permissions (user_id FK)
  │    ├── assessment_history (user_id FK)
  │    ├── learner_profiles (student_id FK)
  │    └── user_areas (M:N → areas)
  ├── areas (tenant_id FK)
  │    └── job_roles (area_id FK)
  │         └── learning_trails (target_job_role_id FK)
  │              └── trail_courses (M:N → courses)
  ├── courses (tenant_id FK, area_id FK, created_by FK)
  │    ├── chapters (course_id FK)
  │    │    ├── questions (chapter_id FK)
  │    │    └── enrichment_sources (chapter_id FK)
  │    ├── quiz_sessions (course_id FK)
  │    │    └── quiz_attempts (quiz_id FK, student_id FK)
  │    ├── enrollments (course_id FK)
  │    ├── course_blueprints (course_id FK, nullable)
  │    │    ├── blueprint_modules (blueprint_id FK)
  │    │    ├── blueprint_objectives
  │    │    └── blueprint_assessments
  │    └── enrichment_jobs (course_id FK)
  │         └── enrichment_sources (job_id FK)
  ├── sessions (tenant_id FK)
  │    ├── messages (session_id FK)
  │    │    └── analyses (message_id FK)
  │    └── qa_reports (session_id FK, message_id FK)
  ├── content_ingestions (tenant_id FK)
  ├── question_generation_jobs (tenant_id FK)
  ├── api_keys (tenant_id FK)
  │    └── api_key_usage_log (api_key_id FK)
  ├── webhooks (tenant_id FK)
  │    └── webhook_deliveries (webhook_id FK)
  ├── materials (tenant_id FK)
  ├── books (tenant_id FK)
  │    └── book_chapters (book_id FK)
  └── platform_audit_log (actor_id FK)

plan_features (global, no tenant_id)
  └── plan × feature_key matrix
```

### 6.2 Tabelas Detalhadas

#### tenants

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'essencial' CHECK (plan IN ('essencial','standard','premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  branding JSONB DEFAULT '{}',     -- {logo_url, primary_color, secondary_color}
  settings JSONB DEFAULT '{}',     -- {max_interactions_per_session, ai_model, features}
  whitelabel_enabled BOOLEAN DEFAULT false,
  whitelabel_config JSONB DEFAULT '{}', -- {custom_texts, favicon_url, footer_text, support_email, custom_css}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for super_admin
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student','manager','admin','super_admin','instructor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  avatar_url TEXT,
  profile JSONB DEFAULT '{}',       -- extensible profile data (Big Five, DISC, etc.)
  onboarding_completed BOOLEAN DEFAULT false,
  learning_mode TEXT DEFAULT 'read' CHECK (learning_mode IN ('read','listen','watch')),
  job_role_id UUID REFERENCES job_roles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### courses

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'regular' CHECK (type IN ('regular','onboarding')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  area_id UUID REFERENCES areas(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### chapters

```sql
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),  -- auto-populated via trigger
  title TEXT NOT NULL,
  content TEXT,
  content_blocks JSONB,               -- Plate.js block editor content
  learning_objective TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  video_url TEXT,
  audio_url TEXT,
  key_concepts TEXT[],
  estimated_reading_time_min INTEGER,
  created_by UUID REFERENCES auth.users(id),
  interaction_type TEXT CHECK (interaction_type IN ('socratic_dialogue','quiz','scenario','assignment')),
  bloom_target TEXT CHECK (bloom_target IN ('remembering','understanding','applying','analyzing','evaluating','creating')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### questions

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),  -- auto-populated via trigger
  text TEXT NOT NULL,
  skill TEXT,           -- analise, sintese, aplicacao, reflexao
  intention TEXT,
  expected_depth TEXT,
  common_shallow_answer TEXT,
  followup_prompts JSONB,
  citations JSONB,
  question_type TEXT DEFAULT 'open_ended'
    CHECK (question_type IN ('multiple_choice','true_false','open_ended')),
  correct_answer TEXT,
  explanation TEXT,
  options JSONB,        -- [{text, is_correct}] for multiple_choice
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','active','archived')),
  job_id UUID REFERENCES question_generation_jobs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id),  -- nullable for LGPD soft delete
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  question_id UUID REFERENCES questions(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','abandoned')),
  interactions_remaining INTEGER NOT NULL DEFAULT 3,
  turn_number INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  analytics JSONB DEFAULT '{}',   -- shadow pipeline results (depth, patterns, emotions)
  adaptation_hints JSONB,         -- hints used in this session
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### messages, analyses, qa_reports

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,  -- auto-populated via trigger
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  turn_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,  -- auto-populated via trigger
  ai_detection JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  flags JSONB DEFAULT '{}',
  observations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qa_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,  -- auto-populated via trigger
  verdict TEXT NOT NULL,    -- APPROVED or REJECTED
  score REAL NOT NULL,      -- 0-10
  criteria_results JSONB DEFAULT '{}',
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabelas de Trilha

```sql
CREATE TABLE job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  seniority_level TEXT NOT NULL DEFAULT 'mid'
    CHECK (seniority_level IN ('junior','mid','senior','lead','manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE learning_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_job_role_id UUID REFERENCES job_roles(id),
  estimated_hours REAL,
  is_mandatory BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trail_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES learning_trails(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  estimated_hours REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trail_id, course_id)
);
```

#### Tabelas de Quiz

```sql
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  quiz_type TEXT NOT NULL DEFAULT 'practice'
    CHECK (quiz_type IN ('practice','exam','diagnostic')),
  time_limit_minutes INTEGER,
  passing_score NUMERIC(5,2) DEFAULT 70.00,
  max_attempts INTEGER DEFAULT 3,
  shuffle_questions BOOLEAN DEFAULT false,
  show_answers_after TEXT DEFAULT 'completion'
    CHECK (show_answers_after IN ('completion','never','always')),
  question_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,2),
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','timed_out','abandoned','passed','failed','pending_review')),
  answers JSONB DEFAULT '[]',    -- [{question_id, answer, is_correct, time_spent_seconds}]
  feedback JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabelas de Feature Gating

```sql
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL CHECK (plan IN ('essencial','standard','premium')),
  feature_key TEXT NOT NULL CHECK (feature_key IN (
    'courses','course_designer','quizzes','trails','assessments','webhooks','api_access'
  )),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  quota INTEGER,  -- NULL = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan, feature_key)
);

-- Seed data:
-- essencial: courses(5), quizzes(10); rest disabled
-- standard: courses(50), quizzes(unlimited), course_designer, assessments, trails(10), webhooks(5), api_access
-- premium: all unlimited
```

#### Tabelas de Instructor Permissions

```sql
CREATE TABLE instructor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  can_create_courses BOOLEAN DEFAULT true,
  can_create_quizzes BOOLEAN DEFAULT true,
  can_manage_trails BOOLEAN DEFAULT false,
  can_view_analytics BOOLEAN DEFAULT true,
  can_manage_enrollments BOOLEAN DEFAULT false,
  assigned_area_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);
```

### 6.3 Funções PostgreSQL Críticas

```sql
-- RLS helpers
CREATE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION auth_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
    AND deleted_at IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION auth_user_area_ids() RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(area_id), '{}')
  FROM public.user_areas WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Session turn management (atomic)
CREATE FUNCTION claim_session_turn(p_session_id UUID, p_user_id UUID) RETURNS TABLE(...) AS $$
  -- SELECT FOR UPDATE (row lock)
  -- Verify: session active, student_id matches, same tenant
  -- Decrement interactions_remaining
  -- Auto-complete if remaining = 0
  -- Return updated session data
$$ LANGUAGE plpgsql;

CREATE FUNCTION release_session_turn(p_session_id UUID, p_user_id UUID) RETURNS VOID AS $$
  -- Compensate: increment interactions_remaining back
$$ LANGUAGE plpgsql;

-- Progress tracking
CREATE FUNCTION update_enrollment_progress(p_student_id UUID, p_course_id UUID) RETURNS VOID AS $$
  -- Calculate % of completed sessions per chapter
  -- Update enrollments.progress JSONB
  -- Mark enrollment complete if 100%
$$ LANGUAGE plpgsql;

-- LGPD
CREATE FUNCTION lgpd_soft_delete_user(p_user_id UUID) RETURNS VOID AS $$
  -- In single transaction:
  -- Set sessions.student_id = NULL
  -- Set users.deleted_at = NOW()
  -- Set users.email = 'deleted_' || id
  -- Set users.full_name = 'Usuário Removido'
  -- Set users.profile = '{}'
$$ LANGUAGE plpgsql;
```

### 6.4 Triggers

```sql
-- Auto-populate tenant_id from parent
CREATE TRIGGER trg_set_chapter_tenant_id
  BEFORE INSERT ON chapters
  FOR EACH ROW EXECUTE FUNCTION set_chapter_tenant_id();

CREATE TRIGGER trg_set_question_tenant_id
  BEFORE INSERT ON questions
  FOR EACH ROW EXECUTE FUNCTION set_question_tenant_id();

CREATE TRIGGER trg_set_message_tenant_id
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION set_message_tenant_id();

-- Similar for analyses, qa_reports
```

### 6.5 Padrão de RLS

```sql
-- Padrão para toda tabela:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant_id match + role check
CREATE POLICY "{table}_select" ON {table} FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('student','instructor','manager','admin'));

-- INSERT/UPDATE: tenant_id match + elevated role
CREATE POLICY "{table}_write" ON {table} FOR INSERT/UPDATE
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('instructor','manager','admin'));

-- DELETE: admin only
CREATE POLICY "{table}_delete" ON {table} FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');

-- Super admin bypass
CREATE POLICY "{table}_super_admin" ON {table} FOR ALL
  USING (is_super_admin());
```

---

## 7. Pipeline de IA

### 7.1 Pipeline de Diálogo Pedagógico

```
┌──────────────────────────────────────────────────────────────┐
│ API Route: POST /api/sessions/[sessionId]/messages           │
│                                                               │
│ 1. Validate auth + rate limit (10 req/min per user)          │
│ 2. claim_session_turn() — atomic PostgreSQL RPC              │
│ 3. Load context: chapter, question, history, profile          │
│ 4. sanitizeStudentMessage() — anti-injection                  │
│ 5. Save student message to DB                                 │
│                                                               │
│ ┌─── PARALLEL ───────────────────────────────────────────┐   │
│ │ runAnalyst(message)                                     │   │
│ │ → AI detection, metrics, depth_score, relevance         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─── SEQUENTIAL (with retry) ────────────────────────────┐   │
│ │                                                         │   │
│ │ Mestre (Socrates Agent)                                 │   │
│ │ → Input: chapter_content, question, history, profile    │   │
│ │ → Adaptation hints: Big Five + DISC → 5 pedagogical     │   │
│ │ → Output: response (2 paragraphs, 150 words max)        │   │
│ │           + 1 open question                             │   │
│ │     ↓                                                   │   │
│ │ Polidor (Editor Agent)                                  │   │
│ │ → Refine language, PT-BR grammar, remove labels          │   │
│ │     ↓                                                   │   │
│ │ Guardião (Tester Agent)                                 │   │
│ │ → 6 criteria: no answer, ends question, no labels,       │   │
│ │   references input, connects chapter, pedagogically ok   │   │
│ │ → Verdict: APPROVED (score ≥ 7) or REJECTED              │   │
│ │                                                         │   │
│ │ if REJECTED && retryCount < 2:                           │   │
│ │   → Inject tester.recommendation into Mestre prompt      │   │
│ │   → Loop back to Mestre                                  │   │
│ │                                                         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                               │
│ 6. Save assistant message + analyses + qa_reports             │
│ 7. Stream response via DataStream (word-by-word)              │
│                                                               │
│ ┌─── ASYNC (fire-and-forget) ────────────────────────────┐   │
│ │ executeShadowPipeline()                                 │   │
│ │ → Detector: always → sessions.analytics JSONB            │   │
│ │ → Perfilador: every 5 turns → learner_profiles upsert   │   │
│ │                                                         │   │
│ │ triggerProfiling() — only on session completion          │   │
│ │ → AI generates full learning profile summary             │   │
│ └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Model Router — Tabela Completa

```
┌──────────────┬───────────────┬───────────────┬───────────────┐
│    Agent     │  Essencial    │   Standard    │   Premium     │
├──────────────┼───────────────┼───────────────┼───────────────┤
│ Mestre       │ gpt-4.1-mini  │ gpt-4.1       │ gpt-4.1       │
│ Polidor      │ deepseek-chat │ deepseek-chat │ gpt-4.1-mini  │
│ Guardião     │ gpt-4.1       │ gpt-4.1       │ gpt-4.1       │
│ Detector     │ deepseek-chat │ deepseek-chat │ gpt-4.1-mini  │
│ Perfilador   │ deepseek-chat │ deepseek-chat │ gpt-4.1-mini  │
│ Analyst      │ gpt-4.1-mini  │ gpt-4.1-mini  │ gpt-4.1       │
├──────────────┴───────────────┴───────────────┴───────────────┤
│ Override: standard + mestre + quiz → gpt-4.1-mini            │
├──────────────────────────────────────────────────────────────┤
│ Custo estimado/sessão: $0.11   │   $0.29     │   $0.34       │
└──────────────────────────────────────────────────────────────┘

Fallback chains:
  gpt-4.1      → deepseek-chat  → gemini-2.5-pro
  gpt-4.1-mini → deepseek-chat  → gemini-2.5-flash
  deepseek-chat → gpt-4.1-nano  → gemini-2.0-flash
```

### 7.3 Shadow Pipeline

```
After each dialogue turn (fire-and-forget):

┌── Detector (always) ──────────────────────────────────────┐
│ Input: conversation_history, student_message               │
│ Output:                                                    │
│   - ai_detection: {probability, confidence, verdict}       │
│   - cognitive_patterns: {depth_progression, breakthroughs} │
│   - linguistic_analysis: {vocabulary_richness, etc.}       │
│   - emotional_arc: {frustration, engagement, curiosity}    │
│ → Merge into sessions.analytics JSONB                      │
└────────────────────────────────────────────────────────────┘

┌── Perfilador (every 5 turns) ─────────────────────────────┐
│ Input: conversation_history (all turns so far)             │
│ Output:                                                    │
│   - kolb_grasping_axis: -1.0 to 1.0                       │
│   - kolb_transforming_axis: -1.0 to 1.0                   │
│   - kolb_dominant_style: diverging/assimilating/etc.       │
│   - engagement_style: reflective/impulsive/balanced        │
│   - reasoning_style: analytical/creative/systematic/etc.   │
│   - strengths, growth_areas, adaptation_hints (arrays)     │
│   - avg_depth_achieved, avg_qa_score, confidence           │
│                                                            │
│ Merge strategy:                                            │
│   - Numerics: exponential moving average                   │
│   - Arrays: set-union, capped at 5 items                   │
│   - Confidence: capped by session count                    │
│     1 session → max 0.15                                   │
│     3+ → max 0.30                                          │
│     5+ → max 0.50                                          │
│     10+ → max 0.70                                         │
│     10++ → max 0.90                                        │
│                                                            │
│ → Upsert to learner_profiles table                         │
└────────────────────────────────────────────────────────────┘
```

### 7.4 Course Designer Pipeline

```
Wizard Input (6 steps)
    ↓
Analyzer Agent → content analysis, concept extraction
    ↓
Architect Agent → module structure, sequence, frameworks
    ↓
Calculator Agent → CLT, durations, spaced repetition
    ↓
Generator Agent → full Blueprint JSON
    ↓
Validator Agent → Quality Scorecard
    ↓ (if score < threshold: feedback loop)
Blueprint → instructor review/edit → "Apply"
    ↓
Auto-create: course + chapters + questions
```

---

## 8. Mapa de Telas e Rotas

### 8.1 Rotas Públicas

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/login` | LoginPage | Email/senha, Google OAuth, SSO |
| `/reset-password` | ResetPasswordPage | Recuperação de senha |
| `/accept-invite` | AcceptInvitePage | Aceitar convite (token) |

### 8.2 Rotas da Plataforma (Autenticadas)

| Rota | Roles | Descrição |
|------|-------|-----------|
| `/dashboard` | Todos | Dashboard adaptativo por role |
| `/onboarding` | Student (first login) | Wizard de onboarding |
| `/courses` | Student, Instructor, Manager, Admin | Lista de cursos |
| `/courses/new` | Instructor, Manager, Admin | Criar novo curso |
| `/courses/new/design` | Instructor, Manager, Admin | Course Designer Wizard (IA) |
| `/courses/[id]` | Todos | Detalhe do curso |
| `/courses/[id]/blueprint` | Instructor, Manager, Admin | Visualizar blueprint |
| `/courses/[id]/questions` | Instructor, Manager, Admin | Gestão de questões |
| `/courses/[id]/enrich/[jobId]` | Instructor, Manager, Admin | Review de enriquecimento |
| `/courses/[id]/chapters/new` | Instructor, Manager, Admin | Novo capítulo |
| `/courses/[id]/chapters/new/edit` | Instructor, Manager, Admin | Editor de capítulo |
| `/courses/[id]/chapters/new/ingest` | Instructor, Manager, Admin | Ingestão de conteúdo |
| `/courses/[id]/chapters/[chId]` | Todos | Visualização de capítulo |
| `/courses/[id]/chapters/[chId]/edit` | Instructor, Manager, Admin | Editar capítulo |
| `/courses/[id]/chapters/[chId]/questions` | Instructor, Manager, Admin | Questões do capítulo |
| `/courses/[id]/chapters/[chId]/session` | Student | **Chat com IA pedagógica** |
| `/courses/[id]/quiz/new` | Instructor, Manager, Admin | Criar quiz |
| `/courses/[id]/quiz/[quizId]` | Student | Jogar quiz |
| `/courses/[id]/quiz/[quizId]/analytics` | Instructor, Manager, Admin | Analytics do quiz |
| `/trails` | Todos | Lista de trilhas |
| `/trails/new` | Manager, Admin | Criar trilha |
| `/trails/dashboard` | Manager, Admin | Dashboard de trilhas |
| `/trails/[id]` | Todos | Detalhe da trilha |
| `/analytics` | Manager, Admin | Analytics avançado |
| `/analytics/sessions/[id]` | Manager, Admin | Detalhe de sessão |
| `/analytics/students/[id]` | Manager, Admin | Perfil do aluno |
| `/assessments/big-five` | Student | Assessment Big Five |
| `/assessments/disc` | Student | Assessment DISC |
| `/profile/learning` | Student | Dashboard de perfil |
| `/team/profiles` | Manager, Admin | Perfis da equipe |
| `/instructor` | Instructor | Dashboard do instrutor |
| `/biblioteca` | Todos | Biblioteca digital |
| `/biblioteca/[id]` | Todos | Detalhe do livro |
| `/biblioteca/[id]/resumo` | Todos | Resumo do livro |
| `/biblioteca/[id]/ler` | Todos | Leitor |
| `/materiais` | Todos | Materiais suplementares |
| `/perfil` | Todos | Perfil do usuário |

### 8.3 Rotas de Admin

| Rota | Roles | Descrição |
|------|-------|-----------|
| `/admin/settings` | Admin | Configurações do tenant |
| `/admin/users` | Admin | Gestão de usuários |
| `/admin/areas` | Admin | Gestão de áreas |
| `/admin/job-roles` | Admin | Gestão de cargos |
| `/admin/plans` | Admin, Super Admin | Features do plano |
| `/admin/biblioteca` | Admin | Gestão de livros |
| `/admin/biblioteca/[id]/conteudo` | Admin | Editor de livro |
| `/admin/api-keys` | Admin | API keys |
| `/admin/webhooks` | Admin | Webhooks |

### 8.4 Rotas de Super Admin

| Rota | Roles | Descrição |
|------|-------|-----------|
| `/super-admin/dashboard` | Super Admin | Dashboard global |
| `/super-admin/tenants` | Super Admin | Lista de tenants |
| `/super-admin/tenants/new` | Super Admin | Criar tenant |
| `/super-admin/tenants/[id]` | Super Admin | Detalhe/edição do tenant |
| `/super-admin/audit` | Super Admin | Audit log |

### 8.5 API Routes (70+)

Ver seção 9 para API REST pública. Rotas internas seguem o padrão:

```
/api/sessions/[sessionId]/messages   — Core AI dialogue
/api/chapters/[chapterId]/generate-questions
/api/courses/[courseId]/generate-questions
/api/courses/[courseId]/enrich
/api/course-designer/generate
/api/course-designer/blueprints/[id]/apply
/api/analytics/*
/api/admin/*
/api/super-admin/*
/api/privacy/export | /api/privacy/delete
/api/profile/generate
/api/cron/webhook-retry
/api/ingestion/*
/api/enrichment-jobs/*
/api/generation-jobs/*
/api/blueprint/*
```

---

## 9. API REST Pública

### 9.1 Autenticação

```
Authorization: Bearer exa_live_XXXXXXXXXXXX
```

- Keys gerenciadas em `/admin/api-keys`
- Hash HMAC armazenado (nunca plain text)
- Escopos granulares por key
- Rate limit configurável por key (RPM/RPD default: 60/10000)
- CORS origins configuráveis por key

### 9.2 Endpoints

| Método | Rota | Escopo | Descrição |
|--------|------|--------|-----------|
| GET | `/api/v1/docs` | Nenhum | OpenAPI spec (JSON) |
| GET | `/api/v1/courses` | courses:read | Listar cursos |
| GET | `/api/v1/courses/[id]` | courses:read | Detalhe do curso |
| GET | `/api/v1/courses/[id]/chapters` | courses:read | Capítulos do curso |
| GET | `/api/v1/courses/[id]/enrollments` | enrollments:read | Matrículas do curso |
| GET | `/api/v1/enrollments` | enrollments:read | Todas as matrículas |
| GET | `/api/v1/blueprints` | blueprints:read | Listar blueprints |
| GET | `/api/v1/blueprints/[id]` | blueprints:read | Detalhe do blueprint |
| GET | `/api/v1/blueprints/[id]/modules` | blueprints:read | Módulos do blueprint |
| GET | `/api/v1/analytics/courses/[id]` | analytics:read | Analytics do curso |

### 9.3 Webhooks

| Evento | Trigger |
|--------|---------|
| `course.created` | Curso criado |
| `course.updated` | Curso atualizado |
| `blueprint.generated` | Blueprint gerado |
| `enrollment.created` | Matrícula criada |

Payload assinado com HMAC-SHA256. Retry automático via cron `/api/cron/webhook-retry`.

---

## 10. Design System

### 10.1 Fundamentos

- **Framework:** Tailwind CSS v4 com `@theme` directive
- **Pattern:** CVA (class-variance-authority) + `cn()` (clsx + tailwind-merge) + `forwardRef`
- **Package:** `@eximia/ui`
- **Tema:** Dark monochromático com accent colors

### 10.2 Design Tokens

```css
/* Backgrounds */
--color-bg-app: #0f0f0f;
--color-bg-sidebar: #111111;
--color-bg-surface: #1a1a1a;
--color-bg-card: #1e1e1e;
--color-bg-elevated: #242424;
--color-bg-hover: #2a2a2a;

/* Text */
--color-text-primary: #ffffff;
--color-text-secondary: #a0a0a0;
--color-text-muted: #666666;

/* Accents */
--color-accent-blue-mid: #2a6ab0;
--color-accent-gold-mid: #c4a040;
--color-accent-teal-mid: #2a7a8a;

/* Semantic */
--color-semantic-success: #4b9560;
--color-semantic-error: #fe4338;
--color-semantic-warning: #f6a609;
--color-semantic-info: #2a6ab0;

/* Borders */
--color-border-subtle: rgba(255,255,255,0.06);
--color-border-medium: rgba(255,255,255,0.10);
--color-border-button: rgba(255,255,255,0.25);

/* Radius */
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-pill: 100px;

/* Layout */
--sidebar-width: 200px;
--topbar-height: 56px;

/* Font */
--font-sans: 'Inter', sans-serif;

/* Z-index */
--z-base: 0;
--z-sticky: 10;
--z-sidebar: 20;
--z-dropdown: 30;
--z-modal: 40;
--z-toast: 50;
```

### 10.3 Componentes (29+)

**Atoms (15):** Button, Input, Badge, Label, Textarea, Toggle, ProgressBar, Avatar, Separator, Card (compound: Header/Title/Description/Content/Footer), Checkbox, RadioGroup/RadioItem, Select, Skeleton, Tooltip

**Molecules (7):** FormField, Tabs, Breadcrumb, Pagination, AvatarGroup, DropdownMenu, Accordion

**Organisms (12+):** Modal, Sidebar, TopBar, Sheet, Toast, Table, Command, DataTable, EmptyState, LoginForm, StatCard, PasswordForm, ChatMessage/ChatInput/ChatMessageList

### 10.4 Regras Mandatórias

1. **Zero hex/rgba hardcoded** — usar tokens Tailwind (`bg-bg-card`, `text-text-primary`)
2. **Import de @eximia/ui** — nunca criar HTML/CSS ad-hoc para componentes existentes
3. **CVA + cn() + forwardRef** — padrão para novos componentes
4. **CSS variables** — `var(--color-bg-card)` quando fora de Tailwind classes
5. **Tenant overrides** — `--tenant-primary` e `--tenant-secondary` injetados em runtime

---

## 11. Segurança e Compliance

### 11.1 Multi-tenancy

- **Isolamento:** RLS (Row Level Security) em todas as 33 tabelas
- **Garantia:** `auth_tenant_id()` → nunca acessa dados de outro tenant
- **Cross-tenant:** Apenas `is_super_admin()` bypass
- **Triggers:** tenant_id auto-populated de parent (chapters←courses, messages←sessions)
- **Stored procedures:** `claim_session_turn()` verifica tenant match

### 11.2 Rate Limiting (13 limiters)

| Limiter | Limite | Scope | Backend |
|---------|--------|-------|---------|
| auth | 5/min | IP | Upstash Redis |
| global | 100/min | IP | Upstash Redis |
| chat | 10/min | User | Upstash Redis |
| question-gen | 5/5min | User | Upstash Redis |
| course-create | 20/hour | User | Upstash Redis |
| privacy | 3/min | User | Upstash Redis |
| course-designer | 3/10min | Tenant | Upstash Redis |
| api-v1 (default) | 60 RPM, 10K RPD | API Key | Upstash Redis |

### 11.3 Anti-Injection

- `sanitizeStudentMessage()` — strips prompt injection attempts antes de enviar para IA
- CSS sanitization para whitelabel custom CSS
- Zod validation em todas as inputs (14 modules de validators)
- HMAC signing para webhook payloads
- API keys hasheados (nunca stored plain)

### 11.4 LGPD

- Export: `GET /api/privacy/export` — JSON com todos os dados do usuário
- Delete: `POST /api/privacy/delete` — `lgpd_soft_delete_user()` em transação
- Retenção: 30 dias após soft delete
- Sessions: `student_id` nullable para anonimização
- Audit: todas as operações de super admin logadas

---

## 12. Planos e Feature Gating

### 12.1 Feature Matrix

| Feature Key | Essencial | Standard | Premium |
|-------------|-----------|----------|---------|
| `courses` | 5 | 50 | Unlimited |
| `course_designer` | Blocked | Enabled | Enabled |
| `quizzes` | 10 | Unlimited | Unlimited |
| `trails` | Blocked | 10 | Unlimited |
| `assessments` | Blocked | Enabled | Enabled |
| `webhooks` | Blocked | 5 | Unlimited |
| `api_access` | Blocked | Enabled | Enabled |

### 12.2 Enforcement Pattern

```typescript
// Server-side (API routes / Server Actions)
const access = await checkFeature(tenantId, 'trails')
// → { allowed: boolean, quota?: number, current?: number, plan, feature }

// Server Action guard
await requireFeatureAction(tenantId, 'course_designer')
// → throws FeatureNotAvailableError if blocked

// React component (Server Component)
<FeatureGate feature="trails">
  {children}  // shown if allowed
</FeatureGate>
// → shows UpgradeCTA if blocked

// Client-side hook
const { allowed, loading } = useFeatureAccess('assessments')
```

### 12.3 Caching

- 5-minute in-memory cache per tenant per feature
- `Map<string, { result, timestamp }>` — cleared after TTL

---

## 13. Integrações

### 13.1 Atuais

| Integração | Propósito | Status |
|------------|-----------|--------|
| **Supabase** | DB, Auth, Storage | Produção |
| **OpenAI** | AI (gpt-4.1, gpt-4.1-mini) | Produção |
| **DeepSeek** | AI (deepseek-chat V3) | Produção |
| **Google AI** | AI fallback (gemini-2.5-pro/flash) | Produção |
| **Upstash Redis** | Rate limiting | Produção |
| **Sentry** | Error tracking | Produção |
| **PostHog** | Product analytics + feature flags | Produção |
| **Vercel** | Hosting + CI/CD | Produção |
| **Tavily** | Web search (course enrichment) | Produção |
| **Google OAuth** | SSO | Produção |
| **SAML** | SSO (Azure AD, Okta) | Produção |

### 13.2 Futuras (Roadmap)

| Integração | Propósito | Prioridade |
|------------|-----------|------------|
| LTI 1.3 | Integração com Moodle/Canvas | P2 |
| SAP SuccessFactors | HR integration | P3 |
| Workday | HR integration | P3 |
| Slack/Teams | Notificações | P2 |
| Zapier/n8n | Automações | P2 |
| Stripe | Billing self-service | P2 |

---

## 14. Roadmap de Epics

### Fase 1 — Core Platform (MVP)

| Epic | Nome | SP | Descrição |
|------|------|----|-----------|
| 1-3 | Auth & Multi-tenancy | ~20 | Supabase Auth, RLS, roles, tenant resolution |
| 4-6 | Course CRUD | ~25 | Cursos, capítulos, questões, rich editor |
| 7-9 | Pedagogical Engine | ~40 | Mestre + Polidor + Guardião pipeline, sessions, streaming |
| 10 | Student Profiling | ~15 | Shadow pipeline, Detector, Perfilador |
| 11 | Audit & Admin | ~15 | Audit log, super admin portal, platform admin |
| 12 | Dashboards | ~20 | Student, manager, admin dashboards |

### Fase 2 — Intelligence (WS1)

| Epic | Nome | SP | Descrição |
|------|------|----|-----------|
| 13 | Content Ingestion | ~20 | PDF/DOCX/PPTX/audio upload + AI structuring |
| 14 | Question Generation | ~15 | AI batch question generation (Creator Agent) |
| 15 | Course Enrichment | ~15 | Web search + external source enrichment |
| 16 | Multi-Provider AI | ~25 | Model Router, 3 providers, fallback chains |
| 17 | Interaction Types | ~20 | quiz, scenario, assignment types + shadow pipeline |
| 18 | Smart Closing | ~10 | Intelligent session closing logic |
| 19 | Advanced Analytics | ~15 | Depth distribution, cognitive patterns, Kolb scatter |

### Fase 3 — Course Design (WS2)

| Epic | Nome | SP | Descrição |
|------|------|----|-----------|
| 20 | Course Designer Core | ~30 | 6-step wizard, Analyzer + Architect agents |
| 21 | Frameworks | ~20 | ELC+, Kolb, PBL framework implementations |
| 22 | Neuroscience Layer | ~15 | CLT, AGES, Spaced Repetition transversal |
| 23 | Blueprint CRUD | ~15 | Blueprint viewer, editor, export |
| 24 | Apply Blueprint | ~15 | Auto-create course + chapters + questions |

### Fase 4 — Enterprise (WS3)

| Epic | Nome | SP | Descrição |
|------|------|----|-----------|
| 25 | Instructor RBAC | 21 | Instructor role, granular permissions, assigned areas |
| 26 | Quiz Engine | 34 | Practice/exam/diagnostic, timer, scoring, analytics |
| 27 | Learning Trails | 29 | Trails, job roles, auto-enrollment, recommendations |
| 28 | Feature Gating | 18 | Plan enforcement, quotas, UpgradeCTA |
| 29 | Adaptive Learning | 26 | Big Five, DISC, profile dashboard, adaptation hints |

### Fase 5 — Scale (Futuro)

| Epic | Nome | Prioridade | Descrição |
|------|------|------------|-----------|
| 30 | Certificates | P2 | Competency-based certificates |
| 31 | Spaced Repetition | P2 | Scheduling + notifications |
| 32 | More Assessments | P2 | Enneagram, MI, Career Anchors UIs |
| 33 | AI Quiz Scoring | P2 | IA corrige questões abertas |
| 34 | Trail Branching | P2 | Non-linear learning paths |
| 35 | Mobile/PWA | P2 | Offline-first PWA |
| 36 | Integrations | P3 | LTI, SAP, Workday, Slack |
| 37 | Marketplace | P3 | Content marketplace |
| 38 | Multilingual | P3 | i18n beyond PT-BR |

---

## 15. Glossário

| Termo | Definição |
|-------|-----------|
| **Mestre** | Agente de IA principal que conduz o diálogo pedagógico |
| **Polidor** | Agente que refina linguisticamente a resposta do Mestre |
| **Guardião** | Agente de QA que valida qualidade pedagógica (6 critérios) |
| **Detector** | Agente shadow que analisa padrões cognitivos e detecta IA |
| **Perfilador** | Agente shadow que constrói perfil Kolb do aluno |
| **Analyst** | Agente que analisa métricas de qualidade da sessão |
| **Diálogo Pedagógico** | Interação IA-aluno onde a IA faz perguntas ao invés de dar respostas |
| **Shadow Pipeline** | Pipeline assíncrono que roda em background sem bloquear resposta |
| **Claim de turno** | Operação atômica no PostgreSQL que decrementa interações restantes |
| **Smart Closing** | Lógica que sugere encerrar sessão quando profundidade suficiente atingida |
| **Blueprint** | Plano pedagógico completo gerado pelo Course Designer |
| **Trilha** | Sequência ordenada de cursos vinculada a um cargo |
| **Feature Gate** | Sistema de liberação/bloqueio de features por plano |
| **Tenant** | Empresa/cliente com instância isolada na plataforma |
| **RLS** | Row Level Security — isolamento de dados no PostgreSQL |
| **Whitelabel** | Personalização visual completa da plataforma por tenant |
| **IPIP-NEO** | Inventário de personalidade Big Five (domínio público) |
| **DISC** | Assessment comportamental (Dominância, Influência, Estabilidade, Conformidade) |
| **Kolb** | Modelo de estilos de aprendizagem (Divergente, Assimilador, Convergente, Acomodador) |
| **Bloom** | Taxonomia de objetivos educacionais (6 níveis: lembrar → criar) |
| **ELC+** | Framework pedagógico proprietário (6 estágios) |
| **CLT** | Cognitive Load Theory — teoria de carga cognitiva |

---

*— Orion, orquestrando o sistema 🎯*
