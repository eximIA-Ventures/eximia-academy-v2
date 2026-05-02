# exímIA Academy — Product Requirements Document (PRD)

**Versão:** 1.0
**Data:** 2026-02-07
**Autor:** Morgan (PM Agent)
**Status:** Draft
**Inputs:** `docs/brief.md`, `docs/benchmark-agentes-socraticos.md`, `docs/architecture.md`

---

## 1. Goals and Background Context

### Goals

- Entregar um MVP funcional onde um aluno completa um curso com diálogos socráticos operacionais (Creator → Socrates → Editor → Tester)
- Permitir que um professor crie cursos, publique capítulos e gere perguntas socrática via IA (Creator Agent)
- Oferecer dashboards por role (aluno, professor, gestor) com métricas de engajamento e aplicação
- Suportar multi-tenancy com isolamento de dados (RLS) e branding customizável por tenant
- Operar em dois modos (universidade e corporativo) com fluxos distintos
- Validar o modelo de produto com o cliente-piloto como primeiro case study

### Background Context

A exímIA Academy nasce da produtização de um sistema de IA socrática criado e validado na universidade parceira, composto por 6 agentes especializados (Creator, Socrates, Editor, Tester, Analyst, Organizer) com score médio de validação de 9.3/10. O sistema opera como pipeline: o Creator gera perguntas a partir de conteúdo educacional, o Socrates conduz diálogos com alunos sem dar respostas diretas, o Editor refina as respostas, o Tester valida qualidade, o Analyst coleta métricas de detecção de IA, e o Organizer gerencia persistência.

O mercado de LMS é dominado por plataformas focadas em entrega de conteúdo (Moodle, Canvas, Coursera) que medem conclusão e acerto em provas, mas não garantem aplicação prática. A exímIA Academy se diferencia por integrar IA socrática que desafia, questiona e guia o aluno até a aplicação demonstrável do conhecimento — com tecnologia já validada em produção.

### Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-07 | 1.0 | PRD inicial greenfield | Morgan |

---

## 2. Requirements

### Functional Requirements

- **FR1:** O sistema deve permitir criação de tenants com nome, slug, modo (universidade/corporativo) e branding (logo, cores)
- **FR2:** O sistema deve suportar 4 roles de usuário: student, teacher, admin, manager — com permissões distintas por role
- **FR3:** O sistema deve oferecer autenticação via email/password e OAuth (Google), com SSO SAML para planos enterprise
- **FR4:** Professores devem poder criar cursos com título, descrição e modo (universidade/corporativo/ambos)
- **FR5:** Professores devem poder criar capítulos dentro de cursos com título, conteúdo (rich text/markdown), objetivo de aprendizagem e ordem sequencial
- **FR6:** Professores devem poder gerar até 3 perguntas socráticas por capítulo via Creator Agent, com revisão antes de ativar
- **FR7:** Alunos devem poder se inscrever em cursos disponíveis no seu tenant
- **FR8:** Alunos devem poder visualizar conteúdo de capítulos e iniciar sessões socráticas
- **FR9:** O chat socrático deve exibir a pergunta inicial, aceitar resposta do aluno, e retornar resposta da IA em formato de 2 parágrafos (feedback + pergunta)
- **FR10:** Cada sessão socrática deve ter no máximo N interações (default: 3, configurável por tenant/curso)
- **FR11:** O pipeline de resposta da IA deve executar sequencialmente: Analyst (paralelo) → Socrates → Editor → Tester, com retry se REJECTED (max 2 retries)
- **FR12:** O Analyst Agent deve analisar cada mensagem do aluno e gerar métricas (detecção de IA, profundidade, relevância) armazenadas no banco
- **FR13:** O Tester Agent deve validar cada resposta da IA contra 6 critérios (sem resposta direta, pergunta aberta, feedback construtivo, sem rótulos, fluidez, conexão com tema)
- **FR14:** O sistema deve exibir contador de interações restantes durante a sessão socrática
- **FR15:** Ao completar a sessão (interações = 0), o status deve mudar para "completed" e o aluno deve ver resumo
- **FR16:** Dashboard do aluno deve exibir: cursos inscritos, progresso, sessões completadas, histórico de interações
- **FR17:** Dashboard do professor deve exibir: cursos criados, métricas por turma, flags de detecção de IA (discretamente), perguntas geradas
- **FR18:** Dashboard do gestor deve exibir: métricas agregadas por curso/turma, engajamento, taxa de conclusão, ROI indicators
- **FR19:** Admin deve poder gerenciar usuários do tenant (convidar, alterar role, desativar)
- **FR20:** O sistema deve suportar onboarding personalizado capturando perfil do aluno (estilo de aprendizagem, experiência, objetivos)

### Non-Functional Requirements

- **NFR1:** Tempo de resposta da IA no chat < 5s (end-to-end do pipeline com streaming)
- **NFR2:** Carregamento de páginas (LCP) < 2s
- **NFR3:** Disponibilidade >= 99.5% uptime
- **NFR4:** Isolamento multi-tenant garantido por RLS no PostgreSQL — impossível acessar dados de outro tenant
- **NFR5:** Conformidade com LGPD — dados de alunos exportáveis e deletáveis por tenant
- **NFR6:** Suporte a PT-BR como idioma principal da interface e dos agentes
- **NFR7:** Bundle size frontend < 150KB gzipped (RSC-first)
- **NFR8:** API response time para CRUD < 200ms
- **NFR9:** Banco de dados com latência de save < 500ms
- **NFR10:** Taxa de aprovação do Tester Agent entre 70-85% (indicador de saúde do pipeline)
- **NFR11:** Custo de LLM por sessão socrática (3 turnos) deve ser monitorado e otimizável
- **NFR12:** A plataforma deve funcionar em Chrome, Firefox, Safari e Edge (últimas 2 versões)

---

## 3. User Interface Design Goals

### Overall UX Vision

Interface limpa, focada em conteúdo e diálogo. O chat socrático é a experiência central — deve ser fluido, sem fricção, com foco total na reflexão do aluno. A plataforma deve transmitir confiança institucional (B2B/educação) sem ser engessada. O branding do tenant (logo, cores) deve ser visível em toda a experiência.

### Key Interaction Paradigms

- **Chat-first learning:** A interação principal é um chat conversacional com a IA socrática, não consumo passivo de vídeo/texto
- **Progressive disclosure:** Conteúdo do capítulo → pergunta socrática → diálogo → reflexão. Cada etapa revela a próxima
- **Dashboard-driven management:** Professores e gestores operam via dashboards com métricas visuais, não listas de configuração
- **Contextual feedback:** Contador de interações, flags discretas para professor, métricas inline

### Core Screens and Views

| # | Tela | Role | Descrição |
|---|------|------|-----------|
| 1 | Login / Register | Todos | Auth com branding do tenant |
| 2 | Onboarding Wizard | Student | Captura perfil, estilo, objetivos (3-5 steps) |
| 3 | Student Dashboard | Student | Cursos inscritos, progresso, sessões recentes |
| 4 | Course Overview | Student | Capítulos do curso, progresso por capítulo |
| 5 | Chapter View | Student | Conteúdo do capítulo + botão "Iniciar sessão socrática" |
| 6 | Socratic Chat | Student | Chat com IA, contador de interações, pergunta + resposta |
| 7 | Session Summary | Student | Resumo da sessão completada, reflexões |
| 8 | Teacher Dashboard | Teacher | Cursos criados, métricas de turma, flags |
| 9 | Course Editor | Teacher | Criar/editar curso, capítulos, gerar perguntas |
| 10 | Question Review | Teacher | Revisar perguntas geradas pelo Creator antes de ativar |
| 11 | Manager Dashboard | Manager | Métricas executivas, ROI, engajamento agregado |
| 12 | Admin Panel | Admin | Gestão de usuários, configurações do tenant |

### Accessibility

WCAG AA — acessibilidade é requisito para instituições educacionais e grandes corporações.

### Branding

Cada tenant customiza: logo, cor primária, cor secundária. A plataforma aplica automaticamente via CSS variables/tema dinâmico. Design base neutro (shadcn/ui) que se adapta ao branding do tenant.

### Target Devices and Platforms

Web Responsive (desktop + tablet + mobile). MVP web-first, sem app nativo. PWA como possibilidade futura.

---

## 4. Technical Assumptions

### Repository Structure: Monorepo

Monorepo com Turborepo + pnpm workspaces. Packages: `apps/web` (Next.js), `packages/shared`, `packages/agents`, `packages/database`, `packages/ui`.

### Service Architecture

Fullstack monolith (Next.js) com Agent Orchestrator como package interno. Sem microserviços no MVP — complexidade desnecessária nesta fase. O Agent Orchestrator roda dentro das API routes do Next.js.

### Testing Requirements

Full Testing Pyramid:
- **Unit:** Vitest + Testing Library (components, hooks, utils, agent schemas)
- **Integration:** Vitest + Supabase local (API routes, agent pipeline)
- **E2E:** Playwright (fluxos críticos: login → curso → chat socrático → conclusão)

### Additional Technical Assumptions

- **Stack definida:** Next.js 15 (App Router) + Supabase + Vercel + Drizzle ORM + Tailwind/shadcn + Vercel AI SDK (ver `docs/architecture.md` para detalhes completos)
- **AI Provider:** Anthropic Claude (claude-sonnet-4-5) — agentes socraticos são LLM-agnostic mas otimizados para Claude
- **Multi-tenant:** RLS no PostgreSQL (Supabase) com tenant resolution via subdomain
- **Auth:** Supabase Auth (email/password, OAuth, SAML SSO no plano enterprise)
- **Os 6 prompts dos agentes socraticos** serão migrados para `packages/agents/src/prompts/` sem modificação inicial
- **Os schemas I/O dos agentes** serão tipados em TypeScript usando Zod para validação runtime
- **Streaming:** Respostas da IA via Server-Sent Events (SSE) usando Vercel AI SDK `useChat`
- **CI/CD:** GitHub Actions → Vercel (preview per PR, staging, production)

---

## 5. Epic List

| Epic | Título | Goal |
|------|--------|------|
| **1** | **Foundation & Auth** | Estabelecer infraestrutura do projeto (monorepo, Supabase, CI/CD), autenticação funcional e shell multi-tenant com layout base |
| **2** | **Course & Content Management** | Professor pode criar cursos, capítulos e gerar perguntas socrática via Creator Agent |
| **3** | **Socratic Learning Engine** | Aluno pode completar uma sessão socrática completa (3 turnos) com pipeline de 4 agentes funcionando |
| **4** | **Dashboards & Analytics** | Aluno, professor e gestor visualizam métricas relevantes ao seu role |
| **5** | **Multi-tenant & Enterprise** | Plataforma opera com múltiplos tenants isolados, branding customizável e onboarding personalizado |

---

## 6. Epic Details

---

### Epic 1: Foundation & Auth

**Goal:** Estabelecer a base técnica do projeto com monorepo funcional, banco de dados com schema inicial, autenticação operacional e layout base com resolução de tenant. Ao final deste epic, um usuário pode fazer login, ver um dashboard vazio com branding do tenant, e o sistema está pronto para receber funcionalidades.

---

#### Story 1.1: Setup do Monorepo e Configuração Inicial

**As a** developer,
**I want** um monorepo configurado com todos os packages e ferramentas,
**so that** eu possa começar a desenvolver com DX otimizado.

**Acceptance Criteria:**
1. Monorepo Turborepo com pnpm workspaces criado com a estrutura: `apps/web`, `packages/shared`, `packages/agents`, `packages/database`, `packages/ui`
2. Next.js 15 (App Router) configurado em `apps/web` com TypeScript
3. Tailwind CSS 4 + shadcn/ui inicializado
4. Biome configurado para lint + format
5. `pnpm dev` inicia o servidor de desenvolvimento sem erros
6. `pnpm lint` e `pnpm typecheck` passam sem erros
7. `.env.example` criado com todas as variáveis necessárias documentadas
8. `README.md` com instruções de setup local

---

#### Story 1.2: Setup do Supabase e Schema Inicial

**As a** developer,
**I want** Supabase configurado com schema base e RLS policies,
**so that** tenho banco de dados pronto para multi-tenant.

**Acceptance Criteria:**
1. Projeto Supabase inicializado com `supabase init`
2. Tabelas criadas via migration: `tenants`, `users`, `courses`, `chapters`, `questions`, `enrollments`, `sessions`, `messages`, `analyses`, `qa_reports`
3. Indexes criados para todas as foreign keys e queries frequentes
4. RLS habilitado em todas as tabelas com policy `tenant_isolation`
5. Drizzle ORM configurado em `packages/database` com schema tipado
6. Tipos gerados automaticamente via `supabase gen types`
7. Seed data com 1 tenant de teste ("Demo") e 1 user admin
8. `supabase db push` aplica migrations sem erros

---

#### Story 1.3: Autenticação com Supabase Auth

**As a** user,
**I want** fazer login com email/password,
**so that** eu possa acessar a plataforma de forma segura.

**Acceptance Criteria:**
1. Página de login (`/login`) com formulário email + password
2. Página de registro (`/register`) com nome, email, password
3. Supabase Auth configurado para email/password
4. Middleware Next.js verifica sessão em rotas protegidas (`/(platform)/*`)
5. Redirect para `/login` se não autenticado
6. Redirect para `/dashboard` após login bem-sucedido
7. Botão de logout funcional
8. Cookies httpOnly para tokens (Supabase default)
9. Loading states durante auth

---

#### Story 1.4: Layout Base e Tenant Resolution

**As a** user autenticado,
**I want** ver a interface com branding do meu tenant,
**so that** a experiência é personalizada para minha instituição.

**Acceptance Criteria:**
1. Layout principal com sidebar (collapsível) + header + área de conteúdo
2. Sidebar exibe navegação por role: items diferentes para student, teacher, admin, manager
3. Header exibe logo do tenant, nome do usuário e botão de logout
4. Tenant resolution via subdomain (ex: `demo.eximia.academy`)
5. Branding do tenant (logo, cor primária) aplicado via CSS variables
6. Dashboard placeholder com mensagem de boas-vindas e role do usuário
7. Responsivo: sidebar colapsa em mobile para hamburger menu
8. Fallback para tema padrão se tenant não tem branding customizado

---

#### Story 1.5: CI/CD Pipeline

**As a** developer,
**I want** pipeline de CI/CD configurado,
**so that** cada PR é validada e deploys são automáticos.

**Acceptance Criteria:**
1. GitHub Actions workflow `ci.yml` roda em push e PR: lint, typecheck, test
2. Vercel conectado ao repositório para preview deploys automáticos por PR
3. Branch `main` deploya automaticamente para staging
4. Variáveis de ambiente configuradas no Vercel (Supabase keys, Anthropic key)
5. Pipeline completo executa em < 3 minutos
6. Badge de status no README

---

### Epic 2: Course & Content Management

**Goal:** Professores podem criar cursos completos com capítulos e conteúdo, gerar perguntas socráticas via Creator Agent, revisar e publicar. Alunos podem visualizar cursos disponíveis e se inscrever. Ao final, o sistema tem conteúdo educacional pronto para ser consumido.

---

#### Story 2.1: CRUD de Cursos

**As a** teacher,
**I want** criar e gerenciar cursos,
**so that** eu possa organizar meu conteúdo educacional.

**Acceptance Criteria:**
1. Página de listagem de cursos do professor (`/courses`) com status (draft/published/archived)
2. Formulário de criação: título, descrição, modo (universidade/corporativo/ambos)
3. Edição de curso existente (título, descrição, modo)
4. Exclusão de curso em draft (com confirmação)
5. Arquivamento de curso publicado (soft delete)
6. Validação: título obrigatório, mínimo 10 caracteres
7. Server Actions para mutations (create, update, delete)
8. Toast notifications para feedback de ações

---

#### Story 2.2: CRUD de Capítulos

**As a** teacher,
**I want** criar capítulos dentro de um curso,
**so that** eu possa estruturar o conteúdo de aprendizagem.

**Acceptance Criteria:**
1. Página de capítulos dentro de um curso (`/courses/[id]/chapters`)
2. Formulário: título, conteúdo (editor rich text/markdown), objetivo de aprendizagem
3. Reordenação de capítulos via drag-and-drop
4. Edição e exclusão de capítulos
5. Status por capítulo (draft/published) — independente do status do curso
6. Validação: título obrigatório, conteúdo mínimo 100 caracteres
7. Preview do conteúdo renderizado

---

#### Story 2.3: Geração de Perguntas via Creator Agent

**As a** teacher,
**I want** gerar perguntas socráticas automaticamente a partir do conteúdo do capítulo,
**so that** eu não precise criar perguntas manualmente.

**Acceptance Criteria:**
1. Botão "Gerar Perguntas" no capítulo publicado
2. API route `/api/chapters/[id]/generate-questions` que chama o Creator Agent
3. Creator Agent recebe: `chapter_title`, `chapter_content`, `learning_objective`, `max_questions: 3`
4. System prompt do Creator Agent migrado de `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md`
5. Response parseada e salva na tabela `questions` com todos os metadados (skill, intention, expected_depth, citations, followup_prompts)
6. Loading state durante geração (5-15s)
7. Tratamento de erro se LLM falhar (retry 1x, mensagem de erro amigável)
8. Limite: não regerar se já existem perguntas ativas para o capítulo (pedir confirmação para substituir)

---

#### Story 2.4: Revisão e Ativação de Perguntas

**As a** teacher,
**I want** revisar as perguntas geradas antes de ativá-las,
**so that** eu tenha controle sobre a qualidade do conteúdo socrático.

**Acceptance Criteria:**
1. Tela de revisão listando as perguntas geradas para o capítulo
2. Para cada pergunta: texto, skill (badge colorido), intenção pedagógica, profundidade esperada
3. Teacher pode aprovar, editar texto, ou rejeitar cada pergunta
4. Perguntas aprovadas ficam com status "active" e disponíveis para sessões
5. Perguntas rejeitadas ficam com status "rejected" e não aparecem para alunos
6. Botão "Gerar novas" para substituir perguntas rejeitadas
7. Ao menos 1 pergunta ativa necessária para publicar capítulo

---

#### Story 2.5: Publicação de Curso e Inscrição de Alunos

**As a** teacher,
**I want** publicar meu curso para que alunos possam se inscrever,
**so that** o conteúdo fique disponível para aprendizagem.

**Acceptance Criteria:**
1. Botão "Publicar" no curso — valida que pelo menos 1 capítulo está publicado com perguntas ativas
2. Curso publicado aparece na listagem de cursos disponíveis para alunos do tenant
3. Aluno vê lista de cursos disponíveis em `/courses`
4. Botão "Inscrever-se" cria enrollment (student_id, course_id, tenant_id)
5. Cursos inscritos aparecem no dashboard do aluno
6. Progresso começa em 0%
7. Aluno não pode se inscrever no mesmo curso 2x

---

### Epic 3: Socratic Learning Engine

**Goal:** Aluno pode completar uma sessão socrática completa com 3 turnos de diálogo. O pipeline de 4 agentes (Analyst → Socrates → Editor → Tester) funciona end-to-end com streaming. Esta é a funcionalidade core que diferencia a plataforma.

---

#### Story 3.1: Visualização de Capítulo e Início de Sessão

**As a** student inscrito num curso,
**I want** ler o conteúdo do capítulo e iniciar uma sessão socrática,
**so that** eu possa aprender e aplicar o conhecimento.

**Acceptance Criteria:**
1. Página `/courses/[courseId]/chapters/[chapterId]` exibe conteúdo renderizado do capítulo
2. Botão "Iniciar Sessão Socrática" visível após leitura do conteúdo
3. Ao clicar, cria `session` no banco (status: active, interactions_remaining: 3)
4. Seleciona aleatoriamente 1 pergunta ativa do capítulo
5. Redirect para `/courses/[courseId]/chapters/[chapterId]/session`
6. Se já existe sessão ativa para esse aluno+capítulo, retomar ao invés de criar nova
7. Se sessão anterior completada, permitir iniciar nova sessão

---

#### Story 3.2: Setup do Agent Orchestrator (packages/agents)

**As a** developer,
**I want** o orchestrator de agentes configurado com prompts e schemas,
**so that** o pipeline socrático possa ser chamado via API.

**Acceptance Criteria:**
1. Package `packages/agents` criado com TypeScript
2. System prompts dos 5 agentes migrados de `Benchmarks/Agentes/Harven_*/03_prompt/prompt_operacional.md` para `packages/agents/src/prompts/`
3. Schemas I/O de cada agente tipados com Zod em `packages/agents/src/schemas/`
4. Pipeline executor que encadeia: Analyst (paralelo) → Socrates → Editor → Tester
5. Retry logic: se Tester retorna REJECTED, re-executa Socrates → Editor → Tester (max 2 retries)
6. Timeout de 30s por agente
7. Integração com Vercel AI SDK (Anthropic provider)
8. Testes unitários para schemas (validação de input/output de cada agente)
9. Export da função principal: `orchestrateSocraticDialogue(input) → output`

---

#### Story 3.3: Interface do Chat Socrático

**As a** student,
**I want** conversar com a IA socrática via chat,
**so that** eu possa refletir e aplicar o que aprendi.

**Acceptance Criteria:**
1. Tela de chat (`/courses/[courseId]/chapters/[chapterId]/session`) com design de chat
2. Pergunta inicial exibida como primeira mensagem da IA
3. Campo de input para o aluno digitar resposta
4. Contador de interações restantes visível (ex: "2 de 3 restantes")
5. Ao enviar resposta: loading state com "Pensando..." enquanto pipeline executa
6. Resposta da IA aparece como mensagem no chat (2 parágrafos: feedback + pergunta)
7. Scroll automático para última mensagem
8. Input desabilitado durante loading
9. Interface responsiva (funciona em mobile)

---

#### Story 3.4: API do Pipeline Socrático com Streaming

**As a** student,
**I want** receber a resposta da IA progressivamente,
**so that** a experiência não tenha espera longa sem feedback.

**Acceptance Criteria:**
1. API route `POST /api/sessions/[sessionId]/messages` implementada
2. Recebe `{ content: string }` (mensagem do aluno)
3. Salva mensagem do aluno na tabela `messages`
4. Chama `orchestrateSocraticDialogue()` do `packages/agents`
5. Salva resposta da IA na tabela `messages`
6. Salva analysis na tabela `analyses` (output do Analyst)
7. Salva qa_report na tabela `qa_reports` (output do Tester)
8. Decrementa `interactions_remaining` na session
9. Se `interactions_remaining` chega a 0, atualiza status para "completed"
10. Retorna response com: `{ response, analysis_summary, session_status, interactions_remaining }`
11. Validação: rejeita se session não está "active"
12. Validação: rejeita se user não é dono da session

---

#### Story 3.5: Conclusão de Sessão e Resumo

**As a** student que completou 3 interações,
**I want** ver um resumo da minha sessão socrática,
**so that** eu possa refletir sobre meu aprendizado.

**Acceptance Criteria:**
1. Quando `interactions_remaining` = 0, chat exibe mensagem de sessão completa
2. Input de texto desabilitado
3. Botão "Ver Resumo" aparece
4. Tela de resumo exibe: pergunta inicial, todas as mensagens (aluno + IA), métricas básicas (tempo total, nº de palavras)
5. Botão "Próximo Capítulo" se existir capítulo seguinte
6. Botão "Voltar ao Curso" para retornar ao overview
7. Progresso do enrollment atualizado (% de capítulos completados)

---

### Epic 4: Dashboards & Analytics

**Goal:** Cada role (aluno, professor, gestor) tem um dashboard com métricas relevantes. O aluno vê seu progresso, o professor monitora sua turma e flags de IA, o gestor vê métricas executivas de ROI e engajamento.

---

#### Story 4.1: Dashboard do Aluno

**As a** student,
**I want** ver meu progresso e histórico de sessões,
**so that** eu acompanhe minha jornada de aprendizagem.

**Acceptance Criteria:**
1. Dashboard em `/dashboard` (role: student)
2. Cards de resumo: cursos inscritos, sessões completadas, capítulos concluídos
3. Lista de cursos inscritos com barra de progresso (%)
4. Sessões recentes com data, capítulo e status
5. Dados carregados via React Server Components (sem client fetch)
6. Empty state para alunos sem inscrição ("Explore cursos disponíveis")
7. Link rápido para continuar último curso

---

#### Story 4.2: Dashboard do Professor

**As a** teacher,
**I want** monitorar o engajamento dos alunos nos meus cursos,
**so that** eu possa identificar alunos que precisam de atenção.

**Acceptance Criteria:**
1. Dashboard em `/dashboard` (role: teacher)
2. Cards de resumo: total de cursos, total de alunos inscritos, sessões esta semana
3. Lista de cursos com: nº de alunos, taxa de conclusão, nº de sessões
4. Ao clicar num curso: métricas por aluno (progresso, sessões, última atividade)
5. Flags de AI detection exibidas discretamente (ícone com tooltip, não bloqueante)
6. Filtro por período (7d, 30d, tudo)
7. Dados via Server Components com React Query para refresh

---

#### Story 4.3: Dashboard do Gestor

**As a** manager,
**I want** ver métricas executivas de engajamento e aplicação,
**so that** eu possa justificar o investimento em treinamento.

**Acceptance Criteria:**
1. Dashboard em `/dashboard` (role: manager)
2. Cards de resumo: total de alunos ativos, taxa de engajamento, taxa de conclusão, sessões este mês
3. Gráfico de engajamento ao longo do tempo (sessões/semana)
4. Tabela de cursos com: alunos inscritos, taxa de conclusão, profundidade média de reflexão
5. Métricas agregadas: média de AI detection (% likely_human), média de depth_of_thought
6. Filtro por curso e período
7. Exportar dados em CSV (botão)

---

### Epic 5: Multi-tenant & Enterprise

**Goal:** A plataforma opera com múltiplos tenants completamente isolados, cada um com branding, configurações e modos (universidade/corporativo) próprios. Admin pode gerenciar usuários e configurações do tenant. Novo aluno passa por onboarding personalizado.

---

#### Story 5.1: Gestão de Tenant (Admin Panel)

**As an** admin,
**I want** configurar meu tenant (branding, settings),
**so that** a plataforma reflita minha instituição.

**Acceptance Criteria:**
1. Página `/admin/settings` com formulário de configurações do tenant
2. Upload de logo (Supabase Storage)
3. Seleção de cor primária e secundária (color picker)
4. Configuração de modo: universidade ou corporativo
5. Configuração de max interactions per session (default: 3)
6. Toggle de features: AI detection, learning journal (futuro), certificates (futuro)
7. Preview em tempo real do branding aplicado
8. Salvamento via Server Action

---

#### Story 5.2: Gestão de Usuários

**As an** admin,
**I want** gerenciar os usuários do meu tenant,
**so that** eu controle quem acessa a plataforma.

**Acceptance Criteria:**
1. Página `/admin/users` com lista paginada de usuários do tenant
2. Convidar novo usuário por email (Supabase Auth invite)
3. Alterar role de usuário (student ↔ teacher ↔ manager)
4. Desativar/reativar usuário (soft delete)
5. Busca por nome ou email
6. Filtro por role
7. Apenas admin pode acessar esta página (middleware check)

---

#### Story 5.3: Onboarding do Aluno

**As a** new student,
**I want** um onboarding que capture meu perfil e objetivos,
**so that** a experiência seja personalizada para mim.

**Acceptance Criteria:**
1. Wizard de onboarding exibido no primeiro login do aluno (se `onboarding_completed = false`)
2. Step 1: Boas-vindas + foto (opcional)
3. Step 2: Estilo de aprendizagem (visual, auditivo, leitura, cinestésico)
4. Step 3: Nível de experiência (iniciante, intermediário, avançado)
5. Step 4: Objetivos de aprendizagem (texto livre ou seleção)
6. Step 5: Setor/área (modo corporativo) ou curso/período (modo universidade)
7. Dados salvos em `users.profile` (JSONB)
8. `onboarding_completed` marcado como true
9. Skip option (pode pular e completar depois)
10. Redirect para dashboard após completar

---

#### Story 5.4: Dual-Mode (Universidade vs Corporativo)

**As a** tenant admin,
**I want** que a plataforma opere no modo adequado à minha instituição,
**so that** a experiência e as métricas façam sentido para meu contexto.

**Acceptance Criteria:**
1. Modo definido em `tenant.mode` (university | corporate)
2. Modo universidade: sidebar exibe "Disciplinas" ao invés de "Trilhas", dashboard mostra "Notas" e "Frequência"
3. Modo corporativo: sidebar exibe "Trilhas", dashboard mostra "Competências" e "ROI"
4. Labels e terminologia adaptam dinamicamente via config por modo
5. Dashboard do gestor adapta métricas ao modo selecionado
6. Testes verificam renderização correta em ambos os modos

---

## 7. Checklist Results

*A ser preenchido após revisão com o usuário.*

---

## 8. Next Steps

### UX Expert Prompt

> @ux-design-expert: Revise o PRD (`docs/prd.md`) com foco nas 12 telas definidas na seção "Core Screens and Views". Crie wireframes ou specs de UI para as telas críticas: Socratic Chat (tela 6), Teacher Course Editor (tela 9) e Student Dashboard (tela 3). Use shadcn/ui como design system base e garanta WCAG AA. O branding é dinâmico por tenant.

### Architect Prompt

> @architect: A arquitetura já foi definida em `docs/architecture.md`. Revise o PRD para validar que todos os FRs e NFRs são atendidos pela arquitetura proposta. Identifique gaps entre requisitos e arquitetura. Inicie o setup do repositório conforme Story 1.1.

### SM Prompt

> @sm: O PRD contém 5 epics com 16 stories detalhadas. Inicie o sprint planning priorizando Epic 1 (Foundation & Auth) como Sprint 1. Crie as stories no formato de trabalho com estimativas e dependencies.

---

*PRD gerado por Morgan (PM Agent) — exímIA Academy v1.0*

— Morgan, planejando o futuro 📊
