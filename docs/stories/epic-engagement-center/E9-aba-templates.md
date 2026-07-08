# E9: Aba Templates

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
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

- [ ] **AC1:** Aba Templates lista todos os templates ativos e inativos do tenant, organizados/agrupados por `intent` (não por `key` nem em lista plana sem agrupamento).
- [ ] **AC2:** Card de template exibe: Nome (humano), Intenção (rótulo humano da categoria, não o valor bruto do enum), Tom, Canais disponíveis (in-app/email, derivados de `channel_inapp`/`channel_email`), Prévia da mensagem (trecho do `body_inapp`), Variáveis usadas (lista de `{{...}}` a partir de `variables` jsonb), Status ativo/inativo, Última edição (`updated_at`), botão Editar.
- [ ] **AC3:** Em NENHUM lugar da UI a `key` técnica é exibida como informação principal — se aparecer em algum tooltip/detalhe técnico avançado, é secundário e claramente não o destaque visual do card.
- [ ] **AC4:** Botão Editar abre um formulário/modal permitindo editar `name`, `body_inapp`, `email_subject`, `email_html`, `intent`, `tone`, `is_active` — `key` exibida como somente-leitura (se exibida) e nunca editável.
- [ ] **AC5:** Salvar edição chama `PATCH /api/engagement/templates/{id}` e reflete a mudança na lista sem reload de página.
- [ ] **AC6:** Estado vazio por intenção (Seção 15): "Nenhum template configurado para esta intenção." — exibido quando uma categoria de intenção não tem nenhum template (situação normal para intenções recém-criadas antes do seed de E1 rodar, ou após uma exclusão futura).
- [ ] **AC7:** O template `behind_teaching_plan` (seed de E1 AC6) aparece corretamente na categoria "Atraso no Plano de Ensino".
- [ ] **AC8:** Autorização: apenas usuários com papel `admin` ou `manager` acessam esta aba/edição — replicar a mesma regra de `nt_write` (RLS de `notification_templates`) na camada de API e, defensivamente, também esconder a aba/botão de edição na UI para outros papéis (caso a aba seja acessível a outros papéis no futuro).

## Tasks

- [ ] 1. Criar a listagem agrupada por intenção consumindo `GET /api/engagement/templates`.
- [ ] 2. Criar o card de template com os 8 campos da Seção 14.
- [ ] 3. Criar o formulário de edição (Modal, reaproveitando `packages/ui/src/components/` conforme padrão do repo).
- [ ] 4. Conectar a edição a `PATCH /api/engagement/templates/{id}`.
- [ ] 5. Implementar estado vazio por intenção.
- [ ] 6. Confirmar visualmente que `behind_teaching_plan` aparece na categoria certa.
- [ ] 7. Validar autorização (admin/manager apenas).

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + Nota de Escopo (risco tenant-wide de edição por manager surfaced). Validada GO (8/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Aba de templates organizada por intenção, nome humano em destaque, `key` técnica banida do rótulo principal (mata o item de kill list). As 6 categorias de intenção batem com o enum de E1 AC4. AC7 (behind_teaching_plan na categoria certa) fecha o loop com E1. Levantei um risco de produto que estava implícito (R1 na Nota de Escopo): um `manager` editando templates afeta o TENANT inteiro, não só o time dele — a RLS `nt_write` permite e o report não restringe, mas o dev deve documentar isso como decisão consciente, não tropeçar nela.
**Nota para devs:** `key` imutável na edição (AC4). Confirmar com produto que edição tenant-wide por manager é intencional (R1).
