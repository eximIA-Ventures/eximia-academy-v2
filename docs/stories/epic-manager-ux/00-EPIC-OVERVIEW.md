# EPIC-MANAGER-UX, Modelo de 2 segundos (lente de papel + recorte de time)

> Status: PRONTO PARA EXECUÇÃO (com 1 aval de UX pendente do Senhor, ver §Decisões abertas).
> Branch alvo: `feat/engajamento-gestor-m1` (== deploy `deploy/cory`, commit 45750f7).
> Data: 2026-07-03. Orquestração: J.A.R.V.I.S. Recon, specs e crítica: agentes arquitetos reais.
> Governança: Tier 1 (SDC), redesenho multi-arquivo com impacto em navegação, escopo e segurança.
> **Onda 2 (2026-07-07):** redesenho "Detalhes dos Alunos" (funil de decisão do gestor), specs S6 a S11. Ver `01-WAVE2-OVERVIEW.md` e pranchas de design em `design/`.

## Norte

O usuário bate o olho e sabe em 2 segundos: "estou vendo como X (Aluno / Instrutor / Gestor), e este é o recorte". Hoje ele não sabe, porque o papel é escolhido por precedência escondida, os itens se misturam e há três seletores concorrentes. Este Epic troca a confusão por dois eixos legíveis: lente de PAPEL e recorte de TIME.

## Os 7 incômodos do Senhor, mapeados

| # | Incômodo (03/07) | Story | Diagnóstico ancorado no código |
|:--|:--|:--|:--|
| 1 | Não vejo o "time do meu time" | S2 | A porta EXISTE e está cabeada; só aparece no modo Hierarquia e o default é Diretos (afordância escondida). No Cory, Rinaldo tem 1 sub-gestor real (Caio). |
| 2 | Itens de aluno no Meu Time | DEFERIDO | A pedido do Senhor, o aprendizado fica por ora. A lente explícita (S1) prepara o terreno sem removê-lo agora. |
| 3 | Analytics sob "Aprendizado" | S3 | Acidente de ordenação da sidebar. Move para "Gestão do Time". |
| 4 | Analytics não navega a hierarquia | S3 | Backend de escopo por hierarquia já existe; falta o controle na tela e propagar o recorte nos fetches. |
| 5 | Trocar painel de recorte por dropdown no topo | S2 + S3 | S2 cria o controle reutilizável; S3 o coloca no topo do Analytics. |
| 6 | Confuso p/ instructor/admin/gestor (Rinaldo) | S1 | Três seletores ortogonais + colapso de chapéu por precedência. Raiz de tudo. |
| 7 | Engajamento só do time, sem "todos" | S4 + S5 | Central mantida visível, audiência travada no time, cega a conteúdo; + fix do gate legado singular. |

## As 5 stories

| Story | Título | Tipo | Arquivos-chave | Verdict crítico |
|:--|:--|:--|:--|:--|
| **S5** | Gate/escopo do engajamento por union de chapéus | fix (segurança) | `area-context.ts` (resolveCallerStudentScope roles:string[]), as 5 rotas de disparo, gate de `analytics/manager/nudge` | READY (RLS corrigido, 5ª rota incluída) |
| **S1** | Lente de papel explícita (fim do colapso por precedência) | feat | `packages/shared/.../registry.ts`, `context-switcher`, `header`, `layout` | READY (com 1 UX aberto) |
| **S2** | Recorte de time unificado + drill visível | feat | `manager-team-dashboard-page`, `team-view-switch`, `org-tree` (ownsTeam + candidate pool), novo `TeamScopeControl` | READY |
| **S3** | Analytics em "Gestão do Time" + moldado pelo recorte | refactor | `analytics/page.tsx` (SSR union), `analytics-dashboard`, rotas aggregate/manager, `registry.ts` (nav-move) | READY (nav-move e SSR corrigidos) |
| **S4** | Engajamento: escopo de leitura no time + UI travada + cego a conteúdo | refactor | `admin/notifications/page.tsx` + client, `engagement/history/route.ts` | READY (read-gates órfãos atribuídos a S4, D9) |

## Sequenciamento e dependências

```
S5 ──▶ S1 ──▶ S2 ──▶ S3
 │
 └──▶ S4  (depende de S5; pode andar em paralelo com S1/S2/S3, mas só landa após S5)
```

- **S5 primeiro**: segurança pura, sem dependência de entrada. Produz o helper `resolveCallerStudentScope(roles:string[])` que S4 consome e o conceito de union que S3 usa no SSR.
- **S1** funda o eixo de lente (`RoleLens`, `isManagerLens`, `activeLens`), consumido por S2/S3/S4.
- **S2** exporta o `TeamScopeControl` (Direto/Hierarquia/entrar-num-sub-time) reusado por S3.
- **S3** consome S1 (lente) + S2 (controle de recorte) + coordena com S5 a remoção do `profile.role` no SSR.
- **S4** consome S5 (helper union) + S1 (lente). Não re-migra nenhum gate de disparo.

Cada story tem `## Plano de testes` com first-move rule: bug/segurança começa por teste vermelho (S5, S4), refactor mantém a suíte verde.

## Fora de escopo (deferido pelo Senhor)

- Remover itens de aprendizado da lente Gestor (ponto 2). "Deixa pra depois."
- Rinaldo ver instrutor + gestor simultaneamente numa tela (basta alternar).
- Composição Unidade × Time (decidido: exclusivos; composição é refino pós-piloto).
- Migrar `auth_user_role()` do banco de singular para union (story de RLS dedicada; sinalizado em S5/D8).

## Decisões abertas (precisam do seu aval antes de landar)

1. **Layout dos 3 controles do header (S1).** Com a lente explícita, o header do gestor pode exibir Unidade + Contexto (população) + Vendo como (papel). Antes de S1 landar, quero seu OK no arranjo visual (ou colapsar Unidade para o gestor de time único, já que hoje ela é inerte para ele). É item de UX, não bloqueia S5/S2.

## Confirmações de campo (pré-flight, baratas)

- **Ponto 1:** o Senhor chegou a clicar em "Hierarquia" antes de concluir que não descia no time do sub-gestor? Se não, o ponto 1 é 100% afordância escondida (S2 já resolve trazendo a porta para o default).
- **Unidade × Time:** algum gestor do Cory tem time espalhado em mais de uma unidade? Se não (provável), "exclusivos" é de graça.

## Segurança e LGPD

Este Epic reforça a linha de 03/07 (gestor não lê conteúdo bruto de aluno): S4 remove `body` do histórico e escopa toda leitura ao time; S5 fecha o flanco do gate legado singular que um multi-chapéu poderia usar para alcançar audiência tenant-wide. Nota honesta (S5/D8): para rotas com service client (RLS bypass), o check de union na app é o ÚNICO gate; o anel DB é singular e não pega o escape. Migrar o banco fica para follow-up sinalizado.

## Trilha de qualidade (governança)

Recon (6 streams) → specs (5 arquitetos) → **crítico adversarial reprovou (NEEDS_REWORK)**, achando 3 CRITICAL reais (5ª rota de disparo esquecida, nav-move que duplicaria cabeçalho, S4/S5 com assinaturas incompatíveis) + SSR legado → revisão (5 reescritas) → **verificação final READY_WITH_MINORS**. Os 5 CRITICAL/HIGH foram resolvidos e re-verificados contra o código. O único MEDIUM residual (read-gates órfãos) foi corrigido nesta entrega (S4/D9).

## Execução

- Nada foi commitado nem enviado. As specs vivem em `docs/stories/epic-manager-ux/`.
- Ordem de implementação: S5 → S1 → S2 → S3, com S4 após S5.
- Cada story roda por SDC (@dev implementa, @qa gate, @devops push), com first-move test onde indicado.
- Aguardo o GO do Senhor (e o aval de UX do item das decisões abertas) para abrir a execução.
