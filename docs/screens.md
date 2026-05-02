# exímIA Academy — Mapa de Telas (MVP)

**Versao:** 1.0
**Data:** 2026-02-07
**Autor:** Aria (Architect Agent)
**Status:** Aprovado para design
**Inputs:** `docs/prd.md`, `docs/architecture.md` v1.1

---

## Decisoes Arquiteturais

- **Sem auto-registro:** Plataforma B2B — acesso apenas via convite do Admin do tenant
- **Login only:** Tela de registro eliminada; novos usuarios entram via invite email do Supabase Auth
- **Role-based routing:** Dashboard unico (`/dashboard`) com 4 variantes por role
- **Dual-mode:** Labels e metricas adaptam via `tenant.mode` (university | corporate)
- **Branding dinamico:** Logo + cores do tenant aplicados via CSS variables

---

## Navegacao Geral

```
Admin convida por email
        |
        v
+------------------+
|  Email: "Voce    |
|  foi convidado"  |
|  [Criar Senha]   |
+--------+---------+
         |
         v
+---------------------+
|  /auth/accept-invite |  Set password (Supabase Auth invite callback)
+--------+------------+
         |
         v
+------------------+
|  /login          |  Login (email/password ou SSO)
+--------+---------+
         |
         v
+------------------+
|  /onboarding     |  Wizard (se student + first login)
+--------+---------+
         |
         v
+------------------+
|  /dashboard      |  Role-based (4 variantes)
+--------+---------+
         |
    +----+------+------------------+
    |           |                  |
    v           v                  v
 /courses   /analytics          /admin
 (browse)   (manager)        (settings + users)
    |
    v
 /courses/[courseId]              Course Overview
    |
    v
 /courses/[cId]/chapters/[chId]  Chapter View
    |
    v
 /courses/[cId]/chapters/[chId]/session  Socratic Chat
    |
    v
 Session Summary (inline)
```

---

## Telas

### Total: 12 telas

| # | Tela | Rota | Roles | Epic | Stories |
|---|------|------|-------|------|---------|
| 1 | Login | `/login` | Todos | 1 | 1.3 |
| 2 | Accept Invite | `/auth/accept-invite` | Todos | 1 | 1.3 |
| 3 | Onboarding Wizard | `/onboarding` | Student | 5 | 5.3 |
| 4 | Dashboard (4 variantes) | `/dashboard` | Todos | 1, 4 | 1.4, 4.1-4.3 |
| 5 | Course Browse / Manage | `/courses` | Student, Teacher | 2 | 2.1, 2.5 |
| 6 | Course Overview / Editor | `/courses/[courseId]` | Student, Teacher | 2, 3 | 2.1, 2.5, 3.1 |
| 7 | Chapter View | `/courses/[cId]/chapters/[chId]` | Student, Teacher | 3 | 3.1 |
| 8 | Chapter Editor | `/courses/[cId]/chapters/[chId]/edit` | Teacher | 2 | 2.2 |
| 9 | Question Review | `/courses/[cId]/chapters/[chId]/questions` | Teacher | 2 | 2.3, 2.4 |
| 10 | Socratic Chat | `/courses/[cId]/chapters/[chId]/session` | Student | 3 | 3.3, 3.4 |
| 11 | Admin: Tenant Settings | `/admin/settings` | Admin | 5 | 5.1 |
| 12 | Admin: User Management | `/admin/users` | Admin | 5 | 5.2 |

> **Nota:** Session Summary (Story 3.5) e renderizado inline na tela do Socratic Chat apos conclusao, nao e uma rota separada.

---

### 1. LOGIN (`/login`)

**Roles:** Todos | **Epic:** 1 | **Story:** 1.3

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Centro | Logo do tenant | Dinamico via subdomain (fallback: logo eximIA) |
| Centro | Form login | Email + password |
| Centro | "Esqueci minha senha" | Link → reset via Supabase Auth |
| Centro | OAuth/SSO | "Continuar com Google" / SSO SAML (enterprise) |
| Bottom | Info text | "Acesso mediante convite da sua instituicao" |

**Estados:** Default, Loading (submit), Error (credenciais invalidas), Success (redirect → dashboard/onboarding)

---

### 2. ACCEPT INVITE (`/auth/accept-invite`)

**Roles:** Todos | **Epic:** 1 | **Story:** 1.3

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Centro | Logo do tenant | Dinamico |
| Centro | Welcome message | "Voce foi convidado para {tenant_name}" |
| Centro | Form | Nome completo + Senha + Confirmar senha |
| Centro | Submit | "Criar minha conta" |

**Fluxo tecnico:** Supabase `inviteUserByEmail()` gera magic link → usuario clica → `/auth/accept-invite?token=...` → set password → auto-login → redirect

**Estados:** Default, Token invalido/expirado, Loading, Success (auto-login → onboarding ou dashboard)

---

### 3. ONBOARDING WIZARD (`/onboarding`)

**Roles:** Student (first login, `onboarding_completed = false`) | **Epic:** 5 | **Story:** 5.3

| Step | Conteudo | Input |
|------|----------|-------|
| 1 | Boas-vindas + avatar | Upload foto (opcional) |
| 2 | Estilo de aprendizagem | 4 cards selecionaveis (visual, auditivo, leitura, cinestesico) |
| 3 | Nivel de experiencia | 3 opcoes (iniciante, intermediario, avancado) |
| 4 | Objetivos | Texto livre ou chips selecionaveis |
| 5 | Setor/area (corporate) OU curso/periodo (university) | Select/input condicional ao `tenant.mode` |

**Layout:** Stepper horizontal, progress bar, botoes "Voltar" e "Proximo", link "Pular" discreto

**Ao final:** Salva em `users.profile` JSONB, marca `onboarding_completed = true`, redirect → `/dashboard`

---

### 4. DASHBOARD (`/dashboard`) — 4 Variantes por Role

#### 4A. Student Dashboard (Stories 1.4, 4.1)

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Welcome banner | "Ola, {nome}! Continue aprendendo." |
| Top row | Summary cards (3) | Cursos inscritos, Sessoes completadas, Capitulos concluidos |
| Main | Cursos inscritos | Cards com titulo, progress bar (%), ultimo acesso |
| Main | CTA "Continuar" | Link direto para o ultimo capitulo em andamento |
| Sidebar right | Sessoes recentes | Lista: data, capitulo, status (completed/active) |

**Empty state:** "Voce ainda nao esta inscrito em nenhum curso. [Explorar cursos]"

#### 4B. Teacher Dashboard (Stories 1.4, 4.2)

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top row | Summary cards (3) | Total cursos, Total alunos inscritos, Sessoes esta semana |
| Main | Lista de cursos | Titulo, no. alunos, taxa conclusao, sessoes, status |
| Main | Curso expandido | Click → metricas por aluno: progresso, sessoes, ultima atividade |
| Main | AI detection flags | Icons discretos (tooltip) ao lado do nome do aluno |
| Top right | Filtro periodo | 7d, 30d, tudo |

#### 4C. Manager Dashboard (Stories 1.4, 4.3)

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top row | Summary cards (4) | Alunos ativos, Taxa engajamento, Taxa conclusao, Sessoes/mes |
| Main upper | Grafico engajamento | Line chart — sessoes/semana ao longo do tempo |
| Main lower | Tabela de cursos | Alunos, conclusao, profundidade reflexao, AI detection media |
| Top right | Filtros | Por curso, por periodo |
| Top right | Export CSV | Botao de exportacao |

**Dual-mode:** university → "Notas", "Frequencia" | corporate → "Competencias", "ROI"

#### 4D. Admin Dashboard (Story 1.4)

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top row | Summary cards | Total usuarios, Cursos publicados, Sessoes totais |
| Main | Quick links | "Gerenciar Usuarios", "Configuracoes do Tenant" |
| Main | Atividade recente | Ultimos logins, cursos criados, sessoes |

---

### 5. COURSE BROWSE / MANAGE (`/courses`)

**Roles:** Student (browse), Teacher (manage) | **Epic:** 2 | **Stories:** 2.1, 2.5

#### Variante Student:

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading + busca | "Cursos Disponiveis" + search bar |
| Main | Grid de cursos | Card: thumbnail, titulo, descricao (truncada), modo badge, no. capitulos |
| Card action | Botao | "Inscrever-se" / "Continuar" (se inscrito) / "Concluido" |

#### Variante Teacher:

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading + "Criar Curso" | Botao primario abre form |
| Main | Lista de cursos | Titulo, status badge (draft/published/archived), no. capitulos, no. alunos |
| Row actions | Dropdown | Editar, Publicar, Arquivar, Excluir |

---

### 6. COURSE OVERVIEW / EDITOR (`/courses/[courseId]`)

**Roles:** Student (overview), Teacher (editor) | **Epic:** 2, 3 | **Stories:** 2.1, 2.5, 3.1

#### Variante Student:

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Header | Titulo + descricao | Curso info |
| Header | Progress bar | X% concluido, X/Y capitulos |
| Main | Lista de capitulos | Cards: titulo, objetivo, status (locked/available/completed/in-progress) |
| Card | Badge de status | Lock icon se `require_completion_order` e capitulo anterior nao concluido |
| Card | CTA | "Ler Capitulo" / "Continuar Sessao" / "Revisar" (completed) |

#### Variante Teacher (Course Editor):

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Header | Titulo + Edit form | Editar titulo, descricao, modo |
| Header | Status + Publicar | Badge draft/published + botao "Publicar" (com validacao) |
| Main | Lista de capitulos | Drag-and-drop reorder, status por capitulo |
| Main | Botao "Adicionar Capitulo" | Form modal ou pagina dedicada |
| Each chapter | Actions | Editar, Gerar Perguntas, Ver Perguntas, Publicar, Excluir |

---

### 7. CHAPTER VIEW (`/courses/[courseId]/chapters/[chapterId]`)

**Roles:** Student, Teacher | **Epic:** 3 | **Story:** 3.1

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Breadcrumb | Curso > Capitulo X |
| Top | Titulo + Objetivo | "Objetivo de aprendizagem: ..." |
| Main | Conteudo renderizado | Markdown/Rich text (prose formatting, imagens, codigo) |
| Bottom | CTA principal (student) | "Iniciar Sessao Socratica" (ou "Retomar Sessao" se ativa) |
| Bottom | Navigation | "← Capitulo anterior" / "Capitulo seguinte →" |
| Top right | "Editar" (teacher) | Link para Chapter Editor |

---

### 8. CHAPTER EDITOR (`/courses/[courseId]/chapters/[chapterId]/edit`)

**Roles:** Teacher | **Epic:** 2 | **Story:** 2.2

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Titulo input | Text field |
| Top | Objetivo input | Text field |
| Main | Rich text editor | Markdown/WYSIWYG (TipTap ou similar) |
| Bottom | Actions | "Salvar rascunho", "Publicar", "Preview", "Cancelar" |
| Bottom | Word count | Minimo 100 caracteres indicator |

---

### 9. QUESTION REVIEW (`/courses/[courseId]/chapters/[chapterId]/questions`)

**Roles:** Teacher | **Epic:** 2 | **Stories:** 2.3, 2.4

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading | "Perguntas Socraticas — {capitulo}" |
| Top | Botao "Gerar Perguntas" | Chama Creator Agent (loading 5-15s) |
| Main | Lista de perguntas (1-3) | Para cada: |
| | → Texto da pergunta | Editavel inline |
| | → Badge skill | Colorido: analise, sintese, aplicacao, reflexao |
| | → Intencao pedagogica | Accordion colapsavel |
| | → Profundidade esperada | Accordion colapsavel |
| | → Status | pending (amarelo), active (verde), rejected (vermelho) |
| | → Actions | Aprovar, Editar, Rejeitar |
| Bottom | Summary | "X/3 perguntas ativas — minimo 1 para publicar capitulo" |
| Bottom | "Gerar novas" | Substituir perguntas rejeitadas |

---

### 10. SOCRATIC CHAT (`/courses/[courseId]/chapters/[chapterId]/session`)

**Roles:** Student | **Epic:** 3 | **Stories:** 3.3, 3.4, 3.5 | **TELA CORE**

```
+--------------------------------------------------+
|  <- Voltar ao Capitulo          2 de 3 restantes  |  InteractionCounter
+--------------------------------------------------+
|                                                    |
|  +--------------------------------------------+   |
|  | Tutor                                      |   |  Pergunta inicial
|  | "Considerando o conceito de X que voce     |   |
|  |  acabou de estudar, como voce aplicaria    |   |
|  |  isso em uma situacao onde..."             |   |
|  +--------------------------------------------+   |
|                                                    |
|         +------------------------------------+     |
|         | Voce                               |     |  Resposta do aluno
|         | "Eu acredito que a aplicacao       |     |
|         |  seria..."                          |     |
|         +------------------------------------+     |
|                                                    |
|  +--------------------------------------------+   |
|  | Tutor                                      |   |  Resposta IA (streaming)
|  | "Interessante perspectiva! Porem, o que    |   |
|  |  aconteceria se considerassemos..."        |   |
|  +--------------------------------------------+   |
|                                                    |
| +------------------------------------+ +----+     |
| | Escreva sua reflexao...            | | >  |     |  ChatInput
| +------------------------------------+ +----+     |
+--------------------------------------------------+
```

**Componentes:**

| Componente | Detalhe |
|-----------|---------|
| `InteractionCounter` | "2 de 3 restantes" — progress dots ou counter |
| `ChatMessage` | Bolha com role (tutor/aluno), avatar, timestamp, streaming indicator |
| `ChatInput` | Textarea auto-resize, botao send, disabled durante loading |
| `TypingIndicator` | "Pensando..." com animacao enquanto pipeline processa |
| `SessionCompleteBar` | Aparece quando `interactions_remaining = 0` |

**Estados:**

| Estado | UI |
|--------|-----|
| Initial | Pergunta do tutor exibida, input habilitado |
| Sending | Input disabled, "Pensando..." com dots animados |
| Streaming | Resposta IA aparece word-by-word (DataStream protocol) |
| Turn complete | Input re-habilitado, counter atualizado |
| Session complete | Input removido, banner "Sessao concluida", botao "Ver Resumo" |
| Error | Toast "Erro ao processar. Tentar novamente?" + retry |

**Session Summary (inline):**

Quando sessao completa, a tela transiciona para modo read-only:

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Banner | "Sessao Concluida" + check icon |
| Main | Conversa completa | Todas as mensagens (read-only, scroll) |
| Bottom | Metricas | Tempo total, no. palavras escritas, capitulo, data |
| Bottom | CTAs | "Proximo Capitulo →" (se existir) / "Voltar ao Curso" |

---

### 11. ADMIN: TENANT SETTINGS (`/admin/settings`)

**Roles:** Admin | **Epic:** 5 | **Story:** 5.1

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading | "Configuracoes do Tenant" |
| Section 1 | Branding | Logo upload, color pickers (primaria, secundaria), preview |
| Section 2 | Modo | Radio: universidade / corporativo |
| Section 3 | IA Settings | Max interactions slider (1-5, default 3), modelo IA |
| Section 4 | Feature flags | Toggles: AI detection, learning journal, certificates |
| Bottom | "Salvar" | Server Action |

---

### 12. ADMIN: USER MANAGEMENT (`/admin/users`)

**Roles:** Admin | **Epic:** 5 | **Story:** 5.2

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading + "Convidar" | Botao abre modal de convite (email + role) |
| Top | Search + filters | Busca por nome/email, filtro por role |
| Main | Tabela de usuarios | Nome, email, role (badge), status (ativo/inativo), ultimo login |
| Row actions | Dropdown | Alterar role, Desativar/Reativar |
| Bottom | Paginacao | Cursor-based |

---

## Layout Principal (Shell)

```
+------------------------------------------------------------+
|  [Logo Tenant]     eximIA Academy     [User] [Logout]      |  Header
+--------+---------------------------------------------------+
|        |                                                    |
| Dashboard |              CONTENT AREA                       |
| Cursos    |                                                 |
| Analytics |    (varia por rota)                             |
| Admin     |                                                 |
|        |                                                    |
| [sidebar  |                                                 |
|  200px]   |                                                 |
+--------+---------------------------------------------------+
```

**Sidebar items por role:**

| Item | Student | Teacher | Manager | Admin |
|------|---------|---------|---------|-------|
| Dashboard | x | x | x | x |
| Cursos (browse) | x | | | |
| Meus Cursos (manage) | | x | | |
| Analytics | | | x | |
| Configuracoes | | | | x |
| Usuarios | | | | x |

---

## Routing Consolidado

```
(auth)/
  login/page.tsx              → Tela 1: Login
  accept-invite/page.tsx      → Tela 2: Accept Invite

onboarding/page.tsx           → Tela 3: Onboarding Wizard

(platform)/
  dashboard/page.tsx          → Tela 4: Dashboard (role-based: 4A/4B/4C/4D)

  courses/
    page.tsx                  → Tela 5: Course Browse (student) / Manage (teacher)
    [courseId]/
      page.tsx                → Tela 6: Course Overview (student) / Editor (teacher)
      chapters/
        [chapterId]/
          page.tsx            → Tela 7: Chapter View
          edit/page.tsx       → Tela 8: Chapter Editor (teacher)
          questions/page.tsx  → Tela 9: Question Review (teacher)
          session/page.tsx    → Tela 10: Socratic Chat + Session Summary

  analytics/page.tsx          → Alias para Manager Dashboard (4C)

  admin/
    settings/page.tsx         → Tela 11: Tenant Settings
    users/page.tsx            → Tela 12: User Management
```

---

## Prioridade por Epic

| Epic | Telas | Sprint |
|------|-------|--------|
| 1: Foundation | Login, Accept Invite, Dashboard (shell), Layout | Sprint 1 |
| 2: Content | Course browse/overview, Chapter view/editor, Question review | Sprint 2 |
| 3: Socratic Engine | Socratic Chat (core), Session Summary | Sprint 3 |
| 4: Dashboards | Dashboard Student/Teacher/Manager (dados reais) | Sprint 4 |
| 5: Enterprise | Onboarding, Admin Settings, Admin Users, Dual-mode | Sprint 5 |

---

*Mapa de telas gerado por Aria (Architect Agent) — eximIA Academy v1.0*
