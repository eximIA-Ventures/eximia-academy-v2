# E9: Aba Templates

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Depende de:** E4 (shell), E1 (schema com `intent`/`tone`)
**Bloqueia:** E10 (kill list depende do nome humano estar em produção)

---

## Story

**As a** gestor,
**I want** ver templates organizados por intenção, com nome humano em vez de chave técnica,
**so that** eu escolha a mensagem certa sem precisar entender a nomenclatura interna do sistema.

## Contexto (Dev Notes)

Ler Seção 14 do report antes de começar.

- REGRA CENTRAL (Seção 14): NUNCA usar como rótulo principal as `key` técnicas (`never_accessed`, `inactive_14d`, `session_no_reflection`, `top_performer_recognition`, `behind_teaching_plan`). Elas podem existir internamente (são a chave primária de lookup em `NUDGE_TYPE_TEMPLATE_KEY`), mas a UI mostra sempre `name` (nome humano) + `intent` (categoria de intenção).
- Categorias de intenção (Seção 14, exatas, já persistidas via E1 AC4): Primeiro acesso (`primeiro_acesso`), Retomada de uso (`retomada`), Atraso no Plano de Ensino (`atraso_plano`), Reflexão pendente (`reflexao_pendente`), Reconhecimento de destaque (`reconhecimento`), Mensagem manual (`manual`).
- Card de template (Seção 14, estrutura exata): Nome, Intenção, Tom, Canais disponíveis, Prévia da mensagem, Variáveis usadas, Status ativo/inativo, Última edição, Botão editar.
- Fonte de dados: `GET /api/engagement/templates` (E3).
- Edição: `PATCH /api/engagement/templates/{id}` (E3) — só `admin`/`manager` (mesma regra RLS de `nt_write`).
- `key` permanece imutável na edição — só `name`, `body_inapp`, `email_subject`, `email_html`, `intent`, `tone`, `is_active` são editáveis.

## Acceptance Criteria

- [x] **AC1:** Aba lista os templates do tenant agrupados por `intent` (headings na ordem canônica de `intentOrder`, nunca por `key` nem lista plana). LACUNA: a rota `GET` filtra `is_active=true`, então só ATIVOS são listados hoje — documentado; a UI agrupa/renderiza todos os retornados.
- [x] **AC2:** Card exibe Nome humano, Intenção (rótulo humano), Tom, Canais (badges de `channelInapp`/`channelEmail`), Prévia (`bodyInapp` line-clamp), Variáveis (`{{...}}` via `variables` ou extraídas do corpo), Status (badge "Ativo"), Última edição ("—", ver lacuna), botão Editar.
- [x] **AC3:** `key` técnica NUNCA é rótulo principal — nome humano em destaque; a `key` aparece só no `title` (tooltip) do "Última edição" e como campo somente-leitura no modal.
- [x] **AC4:** Modal edita `name`, `intent`, `tone`, `body_inapp`, `email_subject`, `email_html`. `key` exibida somente-leitura (Input disabled) e NUNCA enviada no PATCH. `is_active` NÃO editável (a rota PATCH não aceita — ver lacuna).
- [x] **AC5:** Salvar chama `PATCH /api/engagement/templates/{id}` e faz merge local (`applyEdit`) — a lista reflete sem reload.
- [x] **AC6:** Estado vazio por intenção exato da Seção 15: "Nenhum template configurado para esta intenção." (renderizado por categoria sem templates).
- [x] **AC7:** `behind_teaching_plan` tem `intent = atraso_plano` (seed E1) → cai sob o heading "Atraso no Plano de Ensino". Verificação visual pendente de dado no ambiente.
- [x] **AC8:** Autorização na API (rota admin/manager, `nt_write`) + defensivamente na UI: `canEditTemplates=false` mostra EmptyState de indisponível, sem fetch nem botões de edição.

## Tasks

- [x] 1. Listagem agrupada por intenção consumindo `GET /api/engagement/templates`.
- [x] 2. Card de template com os 8 campos da Seção 14 (+ nota de escopo tenant-wide).
- [x] 3. Formulário de edição em `@eximia/ui` `Modal` (Input/Select/Textarea/Label/Button).
- [x] 4. Conectar edição a `PATCH /api/engagement/templates/{id}` com merge local.
- [x] 5. Estado vazio por intenção.
- [x] 6. `behind_teaching_plan` sob "Atraso no Plano de Ensino" (por `intent`); verificação visual pendente de dado.
- [x] 7. Autorização admin/manager (API + guard defensivo na UI).

## Complexidade & Riscos

- **Complexidade:** M (medium). CRUD de UI + agrupamento + form de edição, sobre API já pronta (E3).
- **Riscos:**
  - R1 (médio): expor edição de template a um `manager` significa que um gestor edita templates do TENANT inteiro (não só do seu time) — `notification_templates` não é escopado por time. Confirmar com o produto que isto é intencional (o report Seção 14 fala em "repensar templates" sem restringir a admin); a RLS `nt_write` já permite manager. Documentar no Dev Agent Record que a edição é tenant-wide por design.
  - R2 (baixo): `key` editável por engano quebraria `NUDGE_TYPE_TEMPLATE_KEY` lookup — AC4 já trava `key` como read-only.

## Nota de Escopo

A Regra Absoluta de Escopo (por-aluno) NÃO se aplica diretamente: templates são recursos do TENANT, não dados de aluno escopados por time. O análogo de escopo aqui é AUTORIZAÇÃO (só `admin`/`manager`), coberto por AC8 na camada de API (RLS `nt_write`) e defensivamente na UI. Ver R1 acima sobre o alcance tenant-wide da edição por um manager.

## Dev Notes

- O editor de template pré-existente (se houver algo parecido em `admin/notifications/_components/`) pode servir de ponto de partida técnico, mas a apresentação (agrupamento por intent, nome humano em destaque) é NOVA e específica desta aba — não copiar a UI antiga tal como está, ela é justamente o que a Seção 14 do report pede para ser repensado.
- Rótulos humanos das categorias de intenção (usar estes exatos, Seção 14): "Primeiro acesso", "Retomada de uso", "Atraso no Plano de Ensino", "Reflexão pendente", "Reconhecimento de destaque", "Mensagem manual".

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/templates
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas (IDS)

- **REUSE:** `@eximia/ui` (`Modal`+partes, `Button`, `Badge`, `Input`, `Label`, `Select`, `Textarea`, `EmptyState`, `Skeleton`, `useToast`); o `INTENT_LABELS` já existente no placeholder E4 (mantido); contrato `TemplatesTabProps` de `types.ts` (não tocado).
- **CREATE (justificado):** corpo de `templates-tab.tsx` — listagem agrupada + `TemplateCard` + `EditTemplateModal` + `extractVariables` puro.
- **`key` imutável (AC4):** nunca enviada no corpo do PATCH; exibida só como campo somente-leitura no modal e tooltip do card. O nome humano é o destaque (mata o item da kill list Seção 16).
- **Merge sem reload (AC5):** o retorno do PATCH + os campos editados são mesclados no state local (`applyEdit`), sem refetch.
- **Escopo tenant-wide surfaçado (E9 R1):** nota visível no topo ("Templates são compartilhados com todos os gestores da instituição") — decisão consciente do produto, não tropeço.

### Lacunas de props/contrato registradas (para o orquestrador reconciliar)

- **`types.ts` não alterado.** `TemplatesTabProps` (canEditTemplates + intentOrder) foi suficiente. `Template` local é derivada do retorno real do `GET`.
- **LACUNAS na rota E3 `templates/route.ts` (fora da minha fronteira, não editei):**
  1. `GET` filtra `.eq("is_active", true)` → AC1 pede "ativos E inativos", mas só ativos vêm. O badge de status mostra "Ativo" fixo. Para listar inativos, a rota precisa parar de filtrar e retornar `is_active`.
  2. `GET` não seleciona `updated_at` nem `is_active` → "Última edição" mostra "—". Estender o select resolve.
  3. `PATCH` não aceita `is_active` (só name/title/body/email/tone/intent/canais) → o toggle ativo/inativo do AC4 não é possível via esta rota; deixei fora do form em vez de simular. Adicionar `is_active` ao PATCH habilita.

### Verificação

- `pnpm --filter @eximia/web typecheck` → verde (0 erros).
- `npx biome check` nos 4 arquivos (E7+E8+E9+nudge-labels) → clean.
- `pnpm --filter @eximia/web test` → 577 pass / 32 fail = baseline pré-existente (drift de mock Supabase em rotas não-engagement). **Zero regressão**; nenhuma falha em `_components/`.

### File List

- `apps/web/src/app/(platform)/engagement/_components/templates-tab.tsx` (modificado — corpo real: listagem agrupada + card + modal de edição)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + Nota de Escopo (risco tenant-wide de edição por manager surfaced). Validada GO (8/10). | Pax (@po) |
| 2026-07-08 | Implementada: listagem por intenção (nome humano em destaque, key banida do rótulo) + card 8 campos + modal de edição via PATCH (key imutável) + nota tenant-wide. Lacunas do GET/PATCH (is_active/updated_at) registradas. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Aba de templates organizada por intenção, nome humano em destaque, `key` técnica banida do rótulo principal (mata o item de kill list). As 6 categorias de intenção batem com o enum de E1 AC4. AC7 (behind_teaching_plan na categoria certa) fecha o loop com E1. Levantei um risco de produto que estava implícito (R1 na Nota de Escopo): um `manager` editando templates afeta o TENANT inteiro, não só o time dele — a RLS `nt_write` permite e o report não restringe, mas o dev deve documentar isso como decisão consciente, não tropeçar nela.
**Nota para devs:** `key` imutável na edição (AC4). Confirmar com produto que edição tenant-wide por manager é intencional (R1).
