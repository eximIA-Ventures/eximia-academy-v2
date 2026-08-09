# Motor de Engajamento — Relatório de Implementação

> **Status:** FOUNDATION completo · TypeScript compila sem erros · migration gerada (não aplicada)
> **Data:** 2026-06-04
> **Escopo:** In-app first + email-mirror, nudges assistidos, rastreamento de eficácia

---

## 1. Modelo de Engajamento

### Filosofia: In-App First

O Motor de Engajamento adota a estratégia **in-app first**: toda notificação nasce no canal `inapp` (caixa de entrada do aluno dentro da plataforma) e, opcionalmente, é espelhada por e-mail. O fluxo assistido — onde a IA sugere nudges e um admin aprova antes do envio — é o caminho padrão, evitando spam automatizado não supervisionado.

### Nudges Assistidos

O motor detecta automaticamente quatro perfis de risco com base nos dados existentes de sessões e reflexões:

| Tipo (`NudgeType`) | Critério de detecção |
|:---|:---|
| `never_accessed` | Aluno inscrito, zero sessões |
| `inactive` | Tem sessões, mas último acesso há >14 dias |
| `no_reflection` | ≥2 sessões concluídas e reflexões = 0 |
| `top_performer` | ≥3 sessões concluídas e ≥2 reflexões |

Esses critérios reusam exatamente a lógica do `next-best-action` existente em `analytics/page.tsx` + `components/analytics/next-best-action.tsx`. A engine não reinventa a roda — lê das mesmas tabelas (`sessions`, `slide_reflections`) com os mesmos thresholds.

### Rastreamento de Eficácia

Cada notificação do tipo `nudge` possui o campo `returned_at`. Um CRON (`/api/cron/notification-efficacy`) percorre notificações enviadas sem `returned_at` e, quando detecta uma sessão do aluno com `created_at > sent_at`, carimba `returned_at = now()`. Isso produz uma taxa de retorno por tipo de template, visível na aba "Eficácia" do Centro de Engajamento.

---

## 2. Entidades e Migration

### Arquivo de Migration

`supabase/migrations/20260604120000_engagement_engine.sql`

Migration idempotente (timestamp `20260604120000` > `20260530130000`), wrapped em `BEGIN/COMMIT`, usa `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de recriar políticas, e `ON CONFLICT DO NOTHING` nos seeds. **Não foi aplicada — gerada apenas para revisão.**

> **IMPORTANTE:** A tabela `email_notifications` (legado) NÃO é removida. A migration inclui comentário explícito sobre isso.

### Quatro Novas Tabelas

#### `notification_templates`

Repositório de templates reutilizáveis por tenant.

| Coluna | Tipo | Detalhe |
|:---|:---|:---|
| `id` | uuid PK | — |
| `tenant_id` | uuid | tenant owner |
| `key` | text | slug único por tenant — UNIQUE(tenant_id, key) |
| `name` | text | nome legível |
| `category` | text | CHECK: `nudge` \| `announcement` \| `system`; default `nudge` |
| `channel_inapp` | bool | default `true` |
| `channel_email` | bool | default `false` |
| `title` | text NOT NULL | — |
| `body_inapp` | text | corpo in-app (suporta variáveis `{{...}}`) |
| `email_subject` | text | assunto do e-mail |
| `email_html` | text | corpo HTML do e-mail |
| `variables` | jsonb | array de chaves `{{...}}` usadas |
| `is_active` | bool | default `true` |
| `created_by` | uuid → users | — |
| `created_at`, `updated_at` | timestamptz | — |

#### `notifications`

Canal `inapp` é a **caixa de entrada do aluno**. Canal `email` registra espelho enviado via Resend.

| Coluna | Tipo | Detalhe |
|:---|:---|:---|
| `id` | uuid PK | — |
| `tenant_id` | uuid | — |
| `recipient_id` | uuid → users(id) | — |
| `template_id` | uuid? → notification_templates | nullable para mensagens ad hoc |
| `channel` | text | CHECK: `inapp` \| `email`; default `inapp` |
| `origin` | text | CHECK: `nudge` \| `manual` \| `system`; default `manual` |
| `title` | text NOT NULL | — |
| `body` | text | — |
| `cta_url` | text | link de ação opcional |
| `context` | jsonb | ex: `{course_id, suggestion_id}` |
| `status` | text | CHECK: `queued` \| `sent` \| `read` \| `acted`; default `queued` |
| `created_at`, `sent_at`, `read_at`, `acted_at` | timestamptz | ciclo de vida |
| `returned_at` | timestamptz | **EFICÁCIA** — setado pelo CRON quando aluno fez sessão após `sent_at` |

#### `nudge_suggestions`

Sugestões geradas pela engine, aguardando aprovação de admin/manager.

| Coluna | Tipo | Detalhe |
|:---|:---|:---|
| `id` | uuid PK | — |
| `tenant_id` | uuid | — |
| `type` | text | CHECK: `never_accessed` \| `inactive` \| `no_reflection` \| `top_performer` \| `announcement` \| `custom` |
| `target_student_ids` | jsonb | array de `users.id` |
| `template_key` | text? | referencia `notification_templates.key` |
| `rationale` | text | justificativa legível |
| `status` | text | CHECK: `pending` \| `approved` \| `dismissed`; default `pending` |
| `suggested_at` | timestamptz | — |
| `approved_by` | uuid? | — |
| `approved_at` | timestamptz? | — |

#### `notification_audiences`

Grupos de audiência salvos para reuso em campanhas.

| Coluna | Tipo | Detalhe |
|:---|:---|:---|
| `id` | uuid PK | — |
| `tenant_id` | uuid | — |
| `name` | text NOT NULL | nome da audiência |
| `criteria` | jsonb | chaves: `risk`, `unit_id` (areas.id), `manager_group_id`, `course_id` |
| `created_by` | uuid? | — |
| `created_at`, `updated_at` | timestamptz | — |

### Seeds (5 templates pré-carregados)

Inseridos via `ON CONFLICT DO NOTHING` para todos os tenants existentes no momento da migration:

| `key` | Tipo | Variáveis |
|:---|:---|:---|
| `never_accessed` | nudge | `{{primeiro_nome}}` |
| `inactive_14d` | nudge | `{{primeiro_nome}}` |
| `session_no_reflection` | nudge | `{{primeiro_nome}}`, `{{curso}}` |
| `top_performer_recognition` | nudge | `{{primeiro_nome}}` |
| `announcement_generic` | announcement | `{{primeiro_nome}}` |

### Indexes (11)

Cobrem os padrões de acesso mais frequentes: inbox do aluno por status, efficacy scan por `origin`/`returned_at`/`sent_at`, suggestions por status, templates por tenant/key.

### RLS (17 políticas)

Contrato de segurança por tabela:

- **`notifications`:** Aluno lê/atualiza **somente** `recipient_id = auth.uid() AND channel='inapp'` (avança `read_at`/`acted_at`). Admin/manager gerenciam linhas do tenant. Gestor lê linhas do seu time (via `manager_group_members`). `service_role` tem acesso total (CRON de eficácia + Resend). Super_admin bypass via `is_super_admin()`.
- **`nudge_suggestions` e `notification_audiences`:** Exclusivos para admin/manager — jamais expostos ao aluno.
- **`notification_templates`:** Admin/manager escrevem; staff lê.
- Nunca confiar em `tenant_id`/`recipient_id` vindo do cliente — `WITH CHECK` revalida via RLS.

---

## 3. Backend

### Engine de Sugestões

`src/lib/notifications/engine.ts`

Gera `NudgeSuggestion` automaticamente por tipo de risco, invocando `resolveRiskStudentIds()` do módulo de audiências. Escreve na tabela `nudge_suggestions` com `status='pending'` via `service_role`. Não envia notificações diretamente — aguarda aprovação humana.

### Inbox do Aluno

`src/lib/notifications/inbox.ts`

Funções server-side para operações de caixa de entrada:
- `getInbox(userId, tenantId, opts?)` — lista notificações `channel='inapp'`, ordenadas por `created_at desc`, com contagem de não lidas.
- `unreadCount(userId, tenantId)` — contagem rápida para o badge.
- `markReadAction(notificationId)` — avança `status='read'`, seta `read_at`.
- `markActedAction(notificationId)` — avança `status='acted'`, seta `acted_at`.
- `markAllReadAction(userId)` — marca em massa.

Todas as funções validam que o `recipient_id` pertence ao usuário autenticado (RLS reforça no banco).

### Audiências

`src/lib/notifications/audiences.ts`

`resolveAudience(criteria, tenantId)` retorna `string[]` de `users.id` (deduplicados, papel=`student`). Cada chave de critério **estreita** o conjunto (AND lógico). Critérios suportados:

- `risk` → delega para `resolveRiskStudentIds()` com a lógica idêntica ao `next-best-action`.
- `unit_id` → `user_areas.area_id`.
- `manager_group_id` → `manager_group_members.student_id`.
- `course_id` → `enrollments.student_id`.

Critérios vazios resultam em conjunto vazio (nunca "todo mundo" implicitamente).

CRUD leve: `listAudiences(tenantId)`, `createAudience({...})`, `deleteAudience(audienceId, tenantId)` — `tenant_id`/`created_by` sempre carimbados server-side.

### Eficácia

`src/lib/notifications/efficacy.ts`

- `markReturnedForSentNudges(dbOverride?)` — varre notificações `origin='nudge' AND returned_at IS NULL AND sent_at IS NOT NULL`, agrupa por `recipient_id`, carimba `returned_at=now()` quando há sessão do aluno posterior ao `sent_at`. Idempotente. Máximo de 5.000 candidatos por execução.
- `nudgeEfficacyByType(tenantId)` — taxa de retorno por `template_key` (sent, returned, returnRatePct).

### CRON de Eficácia

`src/app/api/cron/notification-efficacy/route.ts`

Handler `POST`, autenticado via `CRON_SECRET` (Bearer header), exatamente como `/api/cron/webhook-retry`. Sem input do cliente — chama `markReturnedForSentNudges()` e retorna `{scanned, marked}`.

---

## 4. Frontend

### Centro de Engajamento (Admin)

`src/app/(platform)/admin/notifications/` — substitui completamente a página antiga de notificações.

Interface em **4 abas**:

| Aba | Função |
|:---|:---|
| **Sugestões** | Lista `nudge_suggestions` pendentes; botões "Aprovar" / "Dispensar"; ao aprovar, enfileira envio de notificações para os alunos-alvo |
| **Enviar** | Composição manual: escolher template, audiência salva ou lista de alunos, preview com variáveis resolvidas, botão "Enviar" |
| **Templates** | CRUD de `notification_templates`; editor de título/corpo/variáveis; toggle de canais (in-app / e-mail) |
| **Eficácia** | Métricas por tipo de nudge: enviados, retornaram, taxa de retorno (%) |

### Inbox do Aluno

#### `NotificationBell` (`src/components/layout/notification-bell.tsx`)

Componente client que substitui o sino estático no header:
- Badge vermelho (cerrado-600) com contador, capped em `99+`, hidratado via SSR com `initialUnreadCount`.
- Polling a cada 90 s via `/api/notifications/inbox` para atualizar o badge.
- Ao abrir: busca as 10 notificações mais recentes (`?full=1`). Skeleton de carregamento exibido.
- Clique em item chama `markReadAction` ou `markActedAction` de forma otimista.
- Botão "Marcar todas" chama `markAllReadAction`.
- Link "Ver todas" navega para `/notificacoes`.

#### Página de Inbox (`src/app/(platform)/notificacoes/`)

`page.tsx` (Server Component) pré-carrega até 50 linhas via `getInbox()` e repassa para `_components/inbox-client.tsx`:
- Três filtros: Todas / Não lidas / Lidas.
- Ícone por `origin`: `nudge` = Zap (cerrado), `system` = Bell, `announcement` = Megaphone.
- Timestamp relativo; link "Abrir" para CTA; botão "Marcar lida" por item.
- Linhas `acted` com `line-through`.
- Estado otimista local; spinner de pending via `opacity`.
- `loading.tsx` com skeleton fiel ao layout.
- `dynamic = 'force-dynamic'` (dados por usuário, mutam com frequência).

#### Header e Layout

`header.tsx` substituiu o sino estático por `<NotificationBell initialUnreadCount={initialUnreadCount} />`.
`layout.tsx` adiciona `unreadCount()` como pre-fetch não bloqueante (`.catch(() => 0)`), passado ao Header.

### Next-Best-Action (religado)

A lógica de `next-best-action` em `analytics/page.tsx` e `components/analytics/next-best-action.tsx` **não foi modificada**. O motor de engajamento a reutiliza diretamente via `resolveRiskStudentIds()` no módulo de audiências — os thresholds são os mesmos, lidos das mesmas tabelas. Ao aprovar uma sugestão no Centro de Engajamento, a engine converte os resultados do `next-best-action` em `notifications` reais na caixa de entrada do aluno.

---

## 5. O que Substituiu o Modelo Antigo

### `email_notifications` (LEGADO)

A tabela `email_notifications` era o mecanismo original de notificações da plataforma: armazenava e-mails disparados de forma assíncrona, sem canal in-app, sem fluxo de aprovação e sem rastreamento de eficácia.

**A tabela NÃO é removida pela migration.** Ela permanece intacta para preservar histórico e evitar quebras em qualquer código legado que ainda a referencie. A migration inclui comentário explícito:

```sql
-- email_notifications is LEGACY and NOT dropped by this migration.
-- New sends go through notifications(channel='email') only.
```

O novo modelo unifica todos os canais em `notifications`: `channel='inapp'` para a caixa de entrada, `channel='email'` para o espelho Resend. Remetentes futuros devem usar a nova tabela.

---

## 6. Followups Críticos

### 6.1 Aplicar a Migration (OBRIGATÓRIO antes de qualquer teste)

```bash
# Revisar o arquivo gerado
cat supabase/migrations/20260604120000_engagement_engine.sql

# Aplicar no banco de desenvolvimento
supabase db push

# Verificar que as 4 tabelas foram criadas
supabase db diff  # deve mostrar 0 diff após o push
```

### 6.2 Configurar Variáveis de Ambiente

Duas variáveis novas são necessárias para o motor funcionar em produção:

| Variável | Onde | Uso |
|:---|:---|:---|
| `CRON_SECRET` | `.env.local` + EasyPanel | Autenticação do endpoint `/api/cron/notification-efficacy` (Bearer header). Mesma var usada pelo `/api/cron/webhook-retry` — se já estiver configurada, reutilizar. |
| `RESEND_API_KEY` | `.env.local` + EasyPanel | Envio de e-mails via Resend para o canal `email`. Necessário apenas se `channel_email=true` em algum template. |

```bash
# .env.local (exemplo)
CRON_SECRET=seu_secret_aqui
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### 6.3 Registrar o CRON de Eficácia

Configurar um job recorrente (sugestão: diário às 03:00 UTC) que chama:

```
POST /api/cron/notification-efficacy
Authorization: Bearer $CRON_SECRET
```

No EasyPanel, usar o recurso de Cron Jobs do serviço, ou configurar via GitHub Actions schedule, ou serviço externo (cron-job.org, etc.).

### 6.4 Provider WhatsApp (FUTURO)

O modelo está preparado para um terceiro canal: basta adicionar `channel='whatsapp'` ao CHECK constraint de `notifications.channel` em uma migration futura e implementar o provider de envio. A tabela `notification_templates` já tem espaço para campos adicionais de canal via jsonb ou colunas novas. Providers sugeridos: Twilio, Z-API, Evolution API (self-hosted).

### 6.5 Corrigir Issues do Biome (Baixa Prioridade)

9 issues identificadas na verificação — nenhuma crítica. Executar para corrigir automaticamente:

```bash
# Formatar todos os arquivos do escopo
pnpm biome format --write \
  apps/web/src/app/api/cron/notification-efficacy/route.ts \
  apps/web/src/app/api/notifications/ \
  apps/web/src/app/\(platform\)/admin/notifications/ \
  apps/web/src/app/\(platform\)/notificacoes/ \
  apps/web/src/lib/notifications/ \
  apps/web/src/components/layout/notification-bell.tsx \
  apps/web/src/components/layout/engagement-center-client.tsx
```

Issue de acessibilidade pendente: SVG sem `<title>` em `notifications-client.tsx` linha 394. Corrigir manualmente adicionando `<title>Notificação</title>` dentro do SVG.

---

## 7. Checklist de Validação Manual

Após aplicar a migration e configurar as env vars, validar os seguintes fluxos:

### 7.1 Banco de Dados

- [ ] As 4 tabelas existem: `notification_templates`, `notifications`, `nudge_suggestions`, `notification_audiences`
- [ ] Os 5 templates seed foram inseridos para o(s) tenant(s) de desenvolvimento
- [ ] Os 11 indexes estão presentes (`\di` no psql ou Supabase Studio → Table Editor)
- [ ] As 17 políticas RLS estão ativas (`SELECT * FROM pg_policies WHERE tablename IN ('notifications', ...)`)

### 7.2 Inbox do Aluno

- [ ] Badge do sino aparece no header com o número correto de não lidas (inicialmente 0)
- [ ] Dropdown abre e exibe skeleton enquanto carrega, depois lista vazia ("Nada aqui ainda")
- [ ] Após inserir uma notificação `inapp` manualmente no banco, badge incrementa em até 90 s
- [ ] Clicar na notificação marca como lida; badge decrementa
- [ ] "Marcar todas" zera o badge
- [ ] Navegar para `/notificacoes` exibe a página de inbox com filtros funcionais

### 7.3 Centro de Engajamento (Admin)

- [ ] Aba "Sugestões": lista notificações `pending` (inserir manualmente para testar)
- [ ] Botão "Aprovar" cria linhas em `notifications` para os `target_student_ids`
- [ ] Botão "Dispensar" atualiza `status='dismissed'`
- [ ] Aba "Templates": CRUD funcionando — criar, editar, desativar template
- [ ] Aba "Enviar": composição manual enfileira notificação na caixa de entrada do aluno correto
- [ ] Aba "Eficácia": exibe tabela (pode estar vazia se `returned_at` ainda não foi setado)

### 7.4 CRON de Eficácia

- [ ] `POST /api/cron/notification-efficacy` sem header retorna 401
- [ ] `POST /api/cron/notification-efficacy` com `Authorization: Bearer $CRON_SECRET` retorna `{scanned, marked}`
- [ ] Após o aluno fazer uma sessão, rodar o CRON e verificar `returned_at` na linha da notificação correspondente

### 7.5 TypeScript

- [ ] `pnpm tsc --noEmit` no root: 0 erros (confirmado antes do relatório)
- [ ] `pnpm biome check apps/web/src/lib/notifications apps/web/src/types/notifications.ts`: 0 erros de lint (apenas formatter warnings)

---

## 8. Arquivos Criados/Modificados

| Arquivo | Status | Descrição |
|:---|:---|:---|
| `supabase/migrations/20260604120000_engagement_engine.sql` | Criado | Migration completa, não aplicada |
| `apps/web/src/types/notifications.ts` | Criado | Types/interfaces TypeScript para todas as entidades |
| `apps/web/src/lib/notifications/engine.ts` | Criado | Gerador de sugestões de nudge |
| `apps/web/src/lib/notifications/inbox.ts` | Criado | Funções server-side de inbox |
| `apps/web/src/lib/notifications/audiences.ts` | Criado | Resolução de audiências por critério |
| `apps/web/src/lib/notifications/efficacy.ts` | Criado | Marcação de retorno + métricas |
| `apps/web/src/app/api/cron/notification-efficacy/route.ts` | Criado | Endpoint CRON de eficácia |
| `apps/web/src/app/(platform)/admin/notifications/` | Substituído | Centro de Engajamento (4 abas) |
| `apps/web/src/components/layout/notification-bell.tsx` | Criado | Sino interativo com badge e dropdown |
| `apps/web/src/app/(platform)/notificacoes/page.tsx` | Criado | Página de inbox do aluno |
| `apps/web/src/app/(platform)/notificacoes/_components/inbox-client.tsx` | Criado | Client component com filtros e mutations |
| `apps/web/src/app/(platform)/notificacoes/loading.tsx` | Criado | Skeleton de carregamento |
| `apps/web/src/app/(platform)/layout.tsx` | Modificado | Pre-fetch de `unreadCount()` |
| `apps/web/src/components/layout/header.tsx` | Modificado | Substituição do sino estático |

---

*Relatório gerado em 2026-06-04 · Motor de Engajamento v1.0 · eximIA Academy v2*
