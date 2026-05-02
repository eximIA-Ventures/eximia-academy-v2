# Project Brief: exímIA Academy v2.0

**Versão:** 2.0
**Data:** 2026-03-03
**Autor:** Orion (AIOS Master Orchestrator)
**Status:** Referência — Documento de reconstrução do zero

---

## 1. Executive Summary

**exímIA Academy** é uma plataforma LMS (Learning Management System) B2B SaaS para **universidades corporativas e academias de treinamento empresarial** que se diferencia pela integração nativa de um **Motor de Diálogo Pedagógico** — agentes de IA que, através de perguntas provocativas e diálogos guiados, ajudam os alunos a **aplicarem** o conhecimento no contexto real de trabalho.

**Origem:** O motor pedagógico foi criado e validado em universidade parceira, com 6 agentes especializados em pipeline atingindo score médio de 9.3/10 em validação interna. A plataforma produtiza essa tecnologia como SaaS multi-tenant.

**Problema central:** LMS tradicionais medem conclusão de módulos e acerto em provas, mas não garantem que o colaborador saiba aplicar o aprendizado no trabalho real. Taxas de conclusão em e-learning corporativo ficam entre 20-30%.

**Proposta de valor:** Uma plataforma onde aprender é fazer — com IA que desafia, questiona e guia o colaborador até a aplicação prática demonstrável. Diferente de competidores, a exímIA Academy possui motor de diálogo pedagógico validado em produção.

---

## 2. Problema

### 2.1 Estado do Mercado

O mercado de LMS corporativo é dominado por plataformas focadas em **entrega de conteúdo** (Moodle, Canvas, SAP SuccessFactors, Cornerstone). O ciclo típico:

1. Colaborador assiste aulas / lê material
2. Colaborador faz prova de múltipla escolha
3. Plataforma emite certificado baseado em nota
4. Gestor não sabe se o colaborador realmente aprendeu

### 2.2 Dores Identificadas

| Dor | Impacto | Quem Sofre |
|-----|---------|------------|
| Aprendizado passivo | 70%+ do tempo é consumo sem aplicação | Colaborador |
| Avaliação rasa | Provas medem memorização, não competência | RH/T&D |
| Baixo engajamento | 20-30% de conclusão em e-learning | Colaborador + RH |
| ROI invisível | Sem métricas de aplicação real | Gestor/Diretor |
| Desconexão teoria-prática | Conclui curso mas não aplica | Todos |
| Conteúdo genérico | Sem personalização por perfil/cargo | Colaborador |
| Gestão fragmentada | Cursos soltos sem conexão com carreira | RH/T&D |

### 2.3 Por que Soluções Existentes Falham

- **Moodle/Canvas:** Robustos mas sem inteligência — são repositórios de conteúdo
- **Coursera/Udemy:** Escala massiva mas experiência genérica
- **SAP SuccessFactors/Cornerstone:** Integração HR forte, mas learning é secundário
- **Plataformas com "IA":** Geralmente IA para recomendação de conteúdo ou chatbot genérico, não para ensino ativo
- **Nenhum concorrente** implementa diálogo pedagógico via IA como núcleo da experiência

---

## 3. Solução Proposta

### 3.1 Visão do Produto

Uma plataforma de aprendizagem corporativa que combina:

1. **Motor de Diálogo Pedagógico** — IA que conversa com o aluno usando técnicas pedagógicas (não dá respostas, faz perguntas que guiam o raciocínio)
2. **Design Instrucional Assistido por IA** — Wizard que gera blueprints pedagógicos completos a partir de conteúdo bruto
3. **Trilhas de Aprendizagem por Cargo** — Sequências de cursos mapeadas a cargos/funções da empresa
4. **Avaliações Formais + Adaptativas** — Quizzes, exames e diagnósticos integrados ao motor pedagógico
5. **Perfil Comportamental Integrado** — Big Five + DISC alimentam personalização da IA
6. **Multi-tenancy com Whitelabel** — Cada empresa tem sua instância visual

### 3.2 Diferenciação Competitiva

| Aspecto | LMS Tradicionais | exímIA Academy |
|---------|-------------------|----------------|
| Modelo de ensino | Passivo (assistir + prova) | Ativo (diálogo + aplicação) |
| IA | Recomendação de conteúdo | Diálogo pedagógico personalizado |
| Avaliação | Quiz estático | Diálogo + quiz + cenário + assignment |
| Personalização | Por histórico de acesso | Por perfil cognitivo + comportamental |
| Qualidade | Sem controle | Pipeline com validação em 6 critérios |
| Criação de conteúdo | Manual | IA gera blueprint + enriquece |
| Gestão | Cursos soltos | Trilhas por cargo com progresso |

### 3.3 Público-Alvo

| Persona | Perfil | Necessidade Principal |
|---------|--------|----------------------|
| **Gestor T&D** | Responsável pelo programa de treinamento | Métricas de aplicação real, não apenas conclusão |
| **Instrutor** | Especialista de conteúdo (interno ou externo) | Ferramentas para criar cursos de qualidade rapidamente |
| **Colaborador** | Aluno da universidade corporativa | Aprendizado relevante para o trabalho, não genérico |
| **Diretor/CHRO** | Sponsor executivo | ROI do investimento em T&D |
| **Super Admin** | Operador da plataforma (Eximia) | Gestão de todos os tenants |

---

## 4. Modelo de Negócio

### 4.1 Pricing por Sessão de IA

| Plano | Preço/Sessão | IA | Limite Cursos | Features |
|-------|--------------|-----|---------------|----------|
| **Essencial** | R$ 0,60 (~$0.11) | GPT-4.1-mini | 5 | Cursos + Quizzes (10) |
| **Standard** | R$ 1,50 (~$0.29) | GPT-4.1 + DeepSeek | 50 | + Designer + Trilhas (10) + Webhooks (5) + API |
| **Premium** | R$ 1,80 (~$0.34) | GPT-4.1 full stack | Ilimitado | Tudo ilimitado |

### 4.2 Feature Matrix por Plano

| Feature | Essencial | Standard | Premium |
|---------|-----------|----------|---------|
| Cursos | 5 max | 50 max | Ilimitado |
| Course Designer (IA) | Bloqueado | Liberado | Liberado |
| Quizzes | 10 max | Ilimitado | Ilimitado |
| Trilhas | Bloqueado | 10 max | Ilimitado |
| Assessments (Big Five/DISC) | Bloqueado | Liberado | Liberado |
| Webhooks | Bloqueado | 5 max | Ilimitado |
| API REST | Bloqueado | Liberado | Liberado |

### 4.3 Modelo de Roteamento de IA por Plano

| Agente | Essencial | Standard | Premium |
|--------|-----------|----------|---------|
| Mestre (diálogo) | gpt-4.1-mini | gpt-4.1 | gpt-4.1 |
| Polidor (refinamento) | DeepSeek V3 | DeepSeek V3 | gpt-4.1-mini |
| Guardiao (QA) | gpt-4.1 (sempre) | gpt-4.1 (sempre) | gpt-4.1 (sempre) |
| Detector (shadow) | DeepSeek V3 | DeepSeek V3 | gpt-4.1-mini |
| Perfilador (shadow) | DeepSeek V3 | DeepSeek V3 | gpt-4.1-mini |
| Analyst (shadow) | gpt-4.1-mini | gpt-4.1-mini | gpt-4.1 |

**Cadeia de fallback:** OpenAI → DeepSeek V3 → Google Gemini

---

## 5. Stack Tecnológica

### 5.1 Decisões Arquiteturais

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Estrutura | Monorepo (Turborepo + pnpm) | Compartilhamento de tipos/validators entre frontend e agentes |
| Frontend | Next.js 15 (App Router, RSC) | Server Actions, streaming, ISR — performance e DX |
| Database | PostgreSQL 16 via Supabase | RLS nativo para multi-tenancy, Auth integrado |
| ORM | Drizzle ORM | Type-safe, migrations SQL puras, performance |
| Auth | Supabase Auth | Email/senha, Google OAuth, SAML SSO nativos |
| AI SDK | Vercel AI SDK (`ai` package) | `generateObject` com Zod schemas, DataStream, multi-provider |
| Providers IA | OpenAI + DeepSeek + Google Gemini | Custo-benefício por agente, redundância |
| UI | Design system interno (@eximia/ui) | CVA + cn() + forwardRef, 29+ componentes |
| Styling | Tailwind CSS v4 | @theme tokens, zero hardcoded values |
| Rate Limiting | Upstash Redis | Serverless, 13 limiters distintos |
| Observabilidade | Sentry + PostHog | Erros + analytics de produto |
| Hosting | Vercel (app) + Supabase (DB/Auth/Storage) | Serverless, CDN global |
| Testes | Vitest (unit) + Playwright (E2E) + MSW (mocks) | Cobertura completa do pipeline IA |

### 5.2 Monorepo Structure

```
exímIA Academy/
├── apps/
│   └── web/                    # Next.js 15 App Router
│       ├── src/
│       │   ├── app/            # Routes (50+ pages, 70+ API routes)
│       │   ├── components/     # React components
│       │   ├── hooks/          # Custom hooks
│       │   ├── lib/            # Utilities, services, helpers
│       │   ├── providers/      # Context providers
│       │   └── styles/         # Tailwind theme.css
│       └── e2e/                # Playwright tests
├── packages/
│   ├── agents/                 # Motor de Diálogo Pedagógico (6 agentes)
│   │   ├── src/
│   │   │   ├── orchestrator.ts # Pipeline principal
│   │   │   ├── model-router.ts # Roteamento IA por plano
│   │   │   ├── shadow-pipeline.ts # Pipeline shadow (Detector + Perfilador)
│   │   │   ├── closing.ts      # Lógica de fechamento inteligente
│   │   │   ├── prompts/        # System prompts dos 6 agentes
│   │   │   └── schemas/        # Zod schemas de input/output
│   │   └── __tests__/          # Testes unitários dos agentes
│   ├── course-designer/        # Pipeline de Design Instrucional (5 agentes)
│   │   ├── src/
│   │   │   ├── analyzer.ts     # Análise de conteúdo
│   │   │   ├── architect.ts    # Arquitetura pedagógica
│   │   │   ├── calculator.ts   # Cálculos de carga cognitiva
│   │   │   ├── generator.ts    # Geração de blueprint
│   │   │   └── validator.ts    # Validação de qualidade
│   │   └── prompts/
│   ├── database/               # Schema Drizzle + Migrações Supabase
│   │   ├── src/schema/         # 33 tabelas Drizzle
│   │   └── supabase/migrations/ # 43 migration files SQL
│   ├── shared/                 # Tipos, validators Zod, constantes
│   │   ├── src/types/          # Domain models
│   │   ├── src/validators/     # 14 validator modules
│   │   ├── src/constants/      # Limits, labels
│   │   └── src/utils/          # Sanitization, adaptation hints
│   └── ui/                     # @eximia/ui — Design System
│       ├── src/components/     # 29+ componentes (Atoms/Molecules/Organisms)
│       └── src/styles/         # Design tokens CSS
└── docs/                       # Documentação
    ├── prd.md                  # Product Requirements
    ├── brief.md                # Project Brief
    ├── architecture.md         # Architecture Overview
    ├── stories/                # User Stories
    └── epics/                  # Epic definitions
```

---

## 6. Funcionalidades Core

### 6.1 Motor de Diálogo Pedagógico (Núcleo)

O coração da plataforma. Um pipeline de 3 agentes síncronos + 3 shadow (assíncronos):

```
Mensagem do Aluno
  ├─→ claim_session_turn (RPC atômico no PostgreSQL)
  ├─→ [Paralelo] Analyst (shadow: métricas, detecção IA)
  └─→ [Sequencial] Mestre → Polidor → Guardião
       ↑__________________________|  (retry até 2x se REJEITADO)
  ├─→ [Assíncrono] Detector (shadow: padrões cognitivos)
  └─→ [Assíncrono a cada 5 turnos] Perfilador (shadow: perfil Kolb)
  → Stream DataStream (palavra por palavra) → Frontend
```

**6 Agentes:**

| Agente | Função | Visibilidade |
|--------|--------|-------------|
| **Mestre** | Diálogo pedagógico, feedback, uma pergunta aberta por vez | Síncrono — aluno vê |
| **Polidor** | Refinamento linguístico, remove rótulos, gramática PT-BR | Síncrono — invisível |
| **Guardião** | Gate de qualidade: 6 critérios, score, verdict (APPROVED/REJECTED) | Síncrono — invisível |
| **Detector** | Detecção de cópia/IA, padrões cognitivos, jornada de profundidade | Shadow — invisível |
| **Perfilador** | Perfil Kolb (estilo de aprendizagem), engagement, reasoning style | Shadow — a cada 5 turnos |
| **Analyst** | Métricas de resposta, profundidade, relevância | Shadow — invisível |

**Modelo de profundidade (7 camadas):**
1. Fatos → 2. Emoções → 3. Significado → 4. Padrões → 5. Origem → 6. Identidade → 7. Transcendência

**4 Tipos de interação:**
- `socratic_dialogue` — Diálogo pedagógico (default, 20 interações)
- `quiz` — Quiz conversacional (8 interações)
- `scenario` — Cenário situacional (12 interações)
- `assignment` — Atividade prática (15 interações)

**Fechamento inteligente:** Sugere encerramento quando profundidade ≥ 6, insights ≥ 2, e restam ≤ 5 interações.

### 6.2 Design Instrucional Assistido por IA (Course Designer)

Wizard de 6 etapas que gera um Blueprint Pedagógico completo:

1. **Brief do curso** — Título, descrição, público, objetivos
2. **Upload de conteúdo** — PDF, DOCX, PPTX, TXT, áudio, vídeo
3. **Framework pedagógico** — ELC+ 2026, Kolb 4-Stage, PBL (Hmelo-Silver)
4. **Configurações** — Carga horária, nível, modalidade
5. **Revisão** — Preview do blueprint gerado pela IA
6. **Aplicação** — Criação automática de curso + capítulos + questões

**5 Sub-agentes do Designer:**
1. **Analyzer** — Analisa conteúdo bruto, identifica conceitos-chave
2. **Architect** — Estrutura módulos e sequência pedagógica
3. **Calculator** — Calcula carga cognitiva (CLT), durações, espaçamento
4. **Generator** — Gera blueprint JSON completo
5. **Validator** — Valida qualidade (Scorecard: Alinhamento 30% + Bloom 20% + ELC+ 25% + Duração 15% + Carga Cognitiva 10%)

### 6.3 Gestão de Cursos e Capítulos

- CRUD completo de cursos (draft → published → archived)
- CRUD de capítulos com rich text editor + upload multimídia
- Geração de até 3 questões pedagógicas por capítulo via IA (Creator Agent)
- Revisão/aprovação de questões geradas
- Tipos de questão: múltipla escolha, verdadeiro/falso, aberta
- Ingestão de conteúdo: PDF, DOCX, PPTX, TXT, áudio (Whisper), YouTube
- Enriquecimento via busca web (Tavily): IA encontra fontes externas relevantes

### 6.4 Trilhas de Aprendizagem por Cargo

```
Área (Departamento)
  └── Cargo (com senioridade: junior/mid/senior/lead/manager)
       └── Trilha (sequência ordenada de cursos)
            ├── Curso A (obrigatório, ordem 1)
            ├── Curso B (obrigatório, ordem 2)
            └── Curso C (opcional, ordem 3)
```

- Trail builder com drag-and-drop
- Auto-enrollment ao ativar trilha (batch até 500 usuários)
- Progresso por trilha e por curso
- Recomendação de trilhas: 70% cargo/área + 30% perfil comportamental
- Dashboard de manager: progresso da equipe por trilha e cargo

### 6.5 Sistema de Quizzes e Avaliações

**3 tipos:** practice (repetível), exam (limitado, nota), diagnostic (gaps, sem nota)

- Instrutor seleciona questões do pool → configura regras → publica
- Aluno: timer countdown → navegação entre questões → submissão → score
- Auto-scoring para múltipla escolha e V/F; open-ended = revisão manual (v1)
- Analytics: taxa de aprovação, questões mais difíceis, distribuição de notas

### 6.6 Assessments Comportamentais

- **Big Five (IPIP-NEO):** 44 itens, Likert 5 pontos, 5 dimensões (0-100)
- **DISC:** 28 itens em 7 grupos de 4, ranking forçado, 12 combinações de tipo
- Cooldown de 30 dias entre repetições
- Resultados alimentam personalização do Mestre (adaptation hints)
- Dashboard unificado: perfil implícito (Kolb) + explícito (Big Five + DISC)
- Visão agregada de equipe para manager (sem expor scores individuais)

### 6.7 Multi-tenancy com Whitelabel

- Resolução por subdomínio (`empresa.eximia.academy`)
- RLS em todas as tabelas via `auth_tenant_id()`
- Branding customizável: logo, cores primária/secundária
- Whitelabel: app name, tagline, login title/subtitle, favicon, footer, CSS custom
- SSO: Google OAuth + SAML (Azure AD, Okta)
- Session timeout configurável por tenant

### 6.8 Dashboards por Role

| Role | Dashboard | Métricas Principais |
|------|-----------|---------------------|
| **Student** | Cursos matriculados, progresso, sessões recentes | Progresso, profundidade, próximo curso |
| **Instructor** | Meus cursos, alunos, analytics, sessões da semana | Engajamento, conclusão, performance |
| **Manager** | Engajamento, KPIs pedagógicos, equipe | Taxa conclusão, profundidade média, gaps |
| **Admin** | Overview + gestão de usuários/settings | Saúde da plataforma, usuários ativos |
| **Super Admin** | Cross-tenant, todos os tenants | Métricas globais, saúde de cada tenant |

### 6.9 API REST Pública (v1)

- Autenticação via API Key (Bearer token `exa_live_...`)
- Escopos: `courses:read`, `enrollments:read`, `blueprints:read`, `analytics:read`, `webhooks:manage`
- Rate limit configurável por key (RPM/RPD)
- CORS configurável por key
- OpenAPI spec em `/api/v1/docs`
- Webhooks: `course.created`, `course.updated`, `blueprint.generated`, `enrollment.created`

### 6.10 Compliance e Privacidade (LGPD)

- Export de dados pessoais via `/api/privacy/export`
- Soft delete com 30 dias de retenção
- Audit log para todas as operações de super admin
- Sanitização de mensagens do aluno (anti-injection)
- Sem acesso cross-tenant (RLS enforced em PostgreSQL)

---

## 7. Roles e Permissões (RBAC)

### 7.1 Hierarquia

```
super_admin (cross-tenant, tenant_id = NULL)
  └── admin (tenant-scoped, gestão total)
       └── manager (gestão de equipe, analytics)
            └── instructor (criação de conteúdo, granular)
                 └── student (consumo de conteúdo)
```

### 7.2 Permissões do Instructor (Granulares)

| Permissão | Default | Descrição |
|-----------|---------|-----------|
| `can_create_courses` | true | Criar/editar cursos e capítulos |
| `can_create_quizzes` | true | Criar quizzes |
| `can_manage_trails` | false | Criar/editar trilhas |
| `can_view_analytics` | true | Ver analytics dos seus alunos |
| `can_manage_enrollments` | false | Gerenciar matrículas |
| `assigned_area_ids[]` | [] | Áreas onde tem acesso |

Instructor **não pode**: acessar `/admin/users`, `/admin/settings`, `/admin/api-keys`, `/admin/webhooks`.

---

## 8. Métricas de Sucesso

### 8.1 Métricas Técnicas

| Métrica | Target |
|---------|--------|
| Tempo de resposta IA (pipeline completo) | < 5s com streaming |
| Page load (LCP) | < 2s |
| Uptime | 99.5% |
| Score médio do Guardião | ≥ 7.0/10 |
| Fallback rate (uso de modelo secundário) | < 5% |

### 8.2 Métricas de Produto

| Métrica | Target |
|---------|--------|
| Taxa de conclusão de cursos | > 60% (vs 20-30% mercado) |
| Profundidade média atingida | ≥ 4 (de 7 camadas) |
| NPS dos alunos | > 50 |
| Tempo até primeiro curso criado | < 30 min (com Course Designer) |
| Retenção mensal (tenant) | > 90% |

---

## 9. Schema do Banco de Dados (Resumo)

### 9.1 Tabelas Core (33 tabelas)

**Entidades principais:**
- `tenants` — Empresas/clientes
- `users` — Todos os usuários (com `role`, `tenant_id`, `profile JSONB`)
- `areas` / `user_areas` — Departamentos e vínculos
- `courses` — Cursos (com `area_id`, `settings JSONB`)
- `chapters` — Capítulos (com `content_blocks`, `interaction_type`, `bloom_target`)
- `questions` — Questões pedagógicas (com `skill`, `intention`, `expected_depth`)
- `enrollments` — Matrículas (com `trail_id`, `trail_course_order`)

**Pipeline de aprendizagem:**
- `sessions` — Sessões de diálogo (com `interactions_remaining`, `analytics JSONB`)
- `messages` — Mensagens da conversa
- `analyses` — Análises de IA por mensagem
- `qa_reports` — Relatórios de qualidade do Guardião

**Trilhas e cargos:**
- `job_roles` — Cargos com senioridade
- `learning_trails` — Trilhas de aprendizagem
- `trail_courses` — Cursos dentro de trilhas (ordenados)

**Quizzes:**
- `quiz_sessions` — Definição de quiz (tipo, regras)
- `quiz_attempts` — Tentativas dos alunos

**Design instrucional:**
- `course_blueprints` — Blueprints pedagógicos
- `blueprint_modules` — Módulos do blueprint
- `blueprint_objectives` / `blueprint_assessments`
- `blueprint_generation_jobs`

**Ingestão e enriquecimento:**
- `content_ingestions` — Jobs de ingestão de conteúdo
- `question_generation_jobs` — Jobs de geração de questões
- `enrichment_jobs` / `enrichment_sources` — Enriquecimento por busca web

**Perfil e assessments:**
- `learner_profiles` — Perfil cognitivo/Kolb (gerado pela IA)
- `assessment_history` — Histórico de assessments (Big Five, DISC, etc.)

**Infraestrutura:**
- `plan_features` — Feature matrix por plano
- `instructor_permissions` — Permissões granulares do instructor
- `api_keys` / `api_key_usage_log` — API keys e uso
- `webhooks` / `webhook_deliveries` — Webhooks e entregas
- `platform_audit_log` — Log de auditoria
- `materials` — Materiais suplementares
- `books` / `book_chapters` — Biblioteca digital

### 9.2 Funções Críticas do PostgreSQL

| Função | Propósito |
|--------|-----------|
| `auth_tenant_id()` | Retorna tenant_id do usuário autenticado (RLS) |
| `auth_user_role()` | Retorna role do usuário (RLS) |
| `is_super_admin()` | Check de super admin (RLS bypass) |
| `auth_user_area_ids()` | Retorna areas do usuário (RLS de instructor) |
| `claim_session_turn()` | Decremento atômico de turno + auto-complete |
| `release_session_turn()` | Compensação para falhas de pipeline |
| `get_random_active_question()` | Questão aleatória por capítulo (RPC) |
| `update_enrollment_progress()` | Cálculo atômico de progresso |
| `lgpd_soft_delete_user()` | Anonimização LGPD em transação |

---

## 10. Rate Limiting

| Endpoint | Limite | Escopo |
|----------|--------|--------|
| Auth routes | 5 req/min | Por IP |
| Global API | 100 req/min | Por IP |
| Chat messages | 10 req/min | Por user |
| Question generation | 5 req/5min | Por user |
| Course creation | 20 req/hora | Por user |
| Privacy endpoints | 3 req/min | Por user |
| API v1 (default) | 60 RPM, 10K RPD | Por API key |

---

## 11. Roadmap de Implementação

### Fase 1 — Fundação (Epics 1-10)
- Auth multi-tenant + RBAC
- CRUD de cursos, capítulos, questões
- Pipeline pedagógico (Mestre + Polidor + Guardião)
- Pipeline shadow (Detector + Perfilador + Analyst)
- Dashboards por role
- Onboarding de student
- Admin panel (tenant + users)

### Fase 2 — Inteligência (Epics 11-19) — "WS1"
- Audit log
- Áreas organizacionais
- Ingestão de conteúdo (PDF/DOCX/PPTX/áudio/vídeo)
- Geração de questões por IA
- Enriquecimento de conteúdo (busca web)
- Multi-provider IA com Model Router
- Tipos de interação (quiz, scenario, assignment)
- Shadow pipeline com Kolb profiling
- Smart closing

### Fase 3 — Design Instrucional (Epics 20-24) — "WS2"
- Course Designer Wizard (6 etapas)
- 3 frameworks pedagógicos (ELC+, Kolb, PBL)
- Camada de neurociência (CLT, AGES, Spaced Repetition)
- Quality Scorecard
- Blueprint CRUD + Apply

### Fase 4 — Plataforma Enterprise (Epics 25-29) — "WS3"
- Instructor role + RBAC granular
- Quiz & Assessment Engine
- Trilhas de aprendizagem por cargo
- Feature enforcement por plano
- Assessments comportamentais (Big Five + DISC)
- Adaptation hints na IA
- Recomendação de trilhas por perfil

### Fase 5 — Escala (Futuro)
- API REST pública + Webhooks (parcialmente implementado)
- Biblioteca digital (parcialmente implementado)
- Certificados baseados em competência
- Spaced repetition com notificações
- Integrações LTI/Moodle/Canvas/SAP/Workday
- App mobile / PWA offline-first
- Marketplace de conteúdo
- Multilingual (além de PT-BR)

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Custo de IA por sessão inviabiliza pricing | Média | Alto | Model Router otimiza custo por plano; fallback chain |
| Qualidade do diálogo abaixo do esperado | Baixa | Alto | Guardião valida 6 critérios; retry até 2x |
| Latência do pipeline > 5s | Média | Médio | DataStream (streaming); prompts otimizados |
| Downtime do provider de IA | Média | Alto | 3 providers com fallback automático |
| Vazamento de dados cross-tenant | Baixa | Crítico | RLS enforced em PostgreSQL; testes E2E |
| Adoção baixa pelos colaboradores | Média | Alto | Personalização por perfil; engajamento ativo |

---

## 13. Requisitos Não-Funcionais

| Requisito | Especificação |
|-----------|---------------|
| Performance | LCP < 2s, pipeline IA < 5s com streaming |
| Disponibilidade | 99.5% uptime |
| Segurança | RLS multi-tenant, OWASP Top 10, sanitização |
| Privacidade | LGPD compliance (export + delete + retention) |
| Acessibilidade | WCAG AA |
| Idioma | PT-BR como principal (hardcoded no MVP) |
| Browser | Chrome, Firefox, Safari, Edge (últimas 2 versões) |
| Escalabilidade | Serverless (Vercel + Supabase), rate limiting |

---

*— Orion, orquestrando o sistema 🎯*
