# Ponte Analytics ↔ Ações de Engajamento — Contrato Técnico

> Documento de contrato para o Hugo aprovar e para o autor de stories (Saga) fatiar o épico do lado Analytics. Não é implementação. Nenhuma linha de código de app foi escrita para produzir este documento.
>
> Âncoras: todo achado cita `arquivo:linha` no worktree `engagement-worktree` (`/Users/hugocapitelli/Dev/eximia/engagement-worktree`). Complementa o plano irmão do Andar Analytics (`integration-worktree/docs/redesign/analytics-apple/06-ia-actions-plan.md`), que propõe as decisões 2B e 4B consolidadas aqui como contrato formal do lado que as recebe.

---

## 0. Sumário executivo

1. **Reposicionamento confirmado pelo Hugo (2026-07-14):** a página deixa de se chamar/comportar como "Centro de Engajamento" (painel de diagnóstico) e passa a ser **"Ações de Engajamento"** — ferramenta de ação para o gestor reengajar pessoas, com objetivo concreto: achatar semanas atípicas de atividade até virarem semana normal e sustentada.
2. **Diagnóstico consolidado (levantamento §1 abaixo):** metade da página hoje é diagnóstico emprestado/duplicado do Analytics (os 3 cards de triagem + a porta de entrada de Campanhas), a outra metade já é ação real (Ações Sugeridas, Central de Envios, o loop aberto/fechado de Campanhas). Nenhuma parte do motor de coortes tem noção de "semana", "baseline" ou "pico atípico" — essa é uma lacuna de motor, não de UI, e fica **fora do escopo deste contrato** (ver §3).
3. **Este documento fecha o contrato de SUPERFÍCIE que a Analytics precisa para o card de IA deles apenas APONTAR pra cá** (diagnóstico lá, ação aqui), sem a Analytics reimplementar nenhuma lógica de ação:
   - **(a)** o deep-link `/engagement` aceitando um **param de cohort/tipo**, pré-filtrando a aba Ações Sugeridas (decisão 2B do plano da Analytics).
   - **(b)** o padrão já vivo `/engagement?student={id}&action=` **formalizado como contrato oficial** de nudge por aluno, revisar→aprovar→auditar (decisão 4B do plano da Analytics).
4. Nenhum shape de payload foi inventado — os dois contratos abaixo reusam tipos e padrões que já existem em `types.ts`, `page.tsx` e `engine.ts`. Onde falta validação (ex.: `?student=` sem regex de UUID na borda), o gap é citado, não silenciado.

---

## 1. Diagnóstico consolidado (Centro hoje: o que é diagnóstico vs o que é ação)

> Levantamento aprovado pelo Hugo em 2026-07-14, consolidado aqui para rastreabilidade. Nenhum código foi alterado nesta seção — é leitura do estado atual.

### 1.1 O que hoje LÊ como diagnóstico (candidato a migrar/ser sombra do Analytics)

| Item | Evidência (file:line) | Por que é diagnóstico |
|---|---|---|
| Os 3 cards No ritmo / Sem acesso / Atenção | `engagement-shell.tsx:96-131` (`buildSummaryCards`), comentário explícito `:88-95` | Mirrora literalmente `dashboard/triage-cards.tsx` via `computeEngagementTriage` (`engagement-triage.ts:1-17`) — mesma taxonomia canônica, contagem estática num instante, sem verbo de ação anexado ao card |
| Entrada da aba Campanhas (3 segmentos) | `campaigns-tab.tsx:52-78` (array `SEGMENTS`) | Reusa os MESMOS 3 buckets de triagem como portas de entrada — diagnóstico reciclado como menu |
| As 5 coortes de Ações Sugeridas | `TYPE_META`, `suggested-actions-tab.tsx:47-79`, regras em `engine.ts:358-423` | 5 regras estáticas por aluno (nunca acessou / inativo 14+ dias / sem reflexão / atrasado no plano / destaque) — fotografia de estado, não delta temporal |

### 1.2 O que já É ação de verdade (candidato a ganhar mais destaque)

| Item | Evidência (file:line) | Por que é ação real |
|---|---|---|
| Mecânica de disparo de Ações Sugeridas | `suggested-actions-tab.tsx:295-317` (Ver alunos / Revisar mensagem / Enviar / Dispensar) | Governa revisão antes de envio + dismiss com cooldown de 7 dias (`suggested-actions-tab.tsx:197-230`) |
| Central de Envios | `send-center-tab.tsx:1-30` (cabeçalho do arquivo) | Cobre automático (`?student&action=`) e manual, incluindo envio em massa leve (item 5, seleção múltipla via `dispatchTeamNudge`/POST `/action`) |
| Loop aberto→fechado de Campanhas | `campaigns-tab.tsx:274-303` e `:541-609`; `CampaignResultRow` em `types/notifications.ts:306-320` | Único lugar da página que MEDE efeito no tempo ("M de N voltaram a estudar" numa janela de retorno) — a peça estrutural mais próxima de "a ação achatou o pico" |

### 1.3 Recorte da Equipe (Diretos/Hierarquia)

Infraestrutura neutra de escopo (`engagement-shell.tsx:260-295`), não entra no julgamento diagnóstico-vs-ação — necessária para qualquer ferramenta de ação que precise saber "em quem estou agindo".

---

## 2. A lacuna estrutural (registrada, fora de escopo deste contrato)

Nenhum ponto do motor de coortes (`engine.ts`) tem noção de semana, baseline ou variação. Toda geração de sugestão/campanha é limiar estático por aluno.

O sinal bruto que sustentaria "semana de 110 sessões vs baseline 3-25" **existe** do lado Analytics como visualização pura: `api/analytics/manager/route.ts:179` ("Engagement chart: sessions per week, last 12 weeks"), renderizado por `WeeklySessionsChart` (`components/analytics/session-journey-chart.tsx`, usado em `analytics-dashboard.tsx:594`). Não há detecção de baseline nem flag de "semana atípica" em nenhum lugar do código, e o motor de coortes do Engajamento não consome esse dado.

**Isto não é resolvido por este contrato.** Construir a dimensão "semana atípica vs baseline" é motor novo dos dois lados (Analytics precisa calcular o baseline/anomalia; Engajamento precisa de uma 6ª coorte que o consuma). Fica registrado aqui para o épico da Saga não tratar os dois contratos abaixo (2B/4B) como se já resolvessem o objetivo de achatamento de pico — eles resolvem a PONTE de navegação e o contrato de nudge por aluno, não o motor de detecção.

---

## 3. Contrato (a) — Param de cohort/tipo no deep-link `/engagement`

> Decisão 2B do plano Analytics (`06-ia-actions-plan.md §6, Opção 2`): "Linhas por cohort com deep-link (`/engagement` pré-filtrado por tipo)".

### 3.1 Taxonomia já existente (reusada, não inventada)

`NudgeType` tem 7 valores (`types/notifications.ts:27-34`): `never_accessed | inactive | no_reflection | top_performer | announcement | custom | behind_teaching_plan`.

Dos 7, apenas **5 correspondem a coortes diagnósticas de fato geradas e renderizadas** em Ações Sugeridas — as chaves de `TYPE_META` (`suggested-actions-tab.tsx:47-79`): `never_accessed`, `inactive`, `behind_teaching_plan`, `no_reflection`, `top_performer`. `announcement` e `custom` são tipos de uso em Campanha/Templates (ver `nudge-labels.ts:15-23`, que lista os 7 para reuso amplo em Campanhas/Histórico), não cohorts diagnósticas — um deep-link da Analytics para esses dois valores não teria card correspondente em Ações Sugeridas e deve ser rejeitado pela mesma whitelist.

### 3.2 Shape do parâmetro

- **Nome do param:** `?type=` — mantém consistência com o campo já existente em todo o domínio (`EngagementSuggestion.type` em `types.ts:102`, `NudgeSuggestionRow.type` em `types/notifications.ts:210`), em vez de inventar um novo termo como "cohort".
- **URL final:** `/engagement?type=<NudgeType>` (compõe com `?focus=` já existente para drill-down de equipe, sem conflito — ambos podem coexistir na mesma URL).
- **Validação (whitelist, nunca confiar na querystring):** mesma disciplina já usada para `?action=` em `page.tsx:290-293` (comparação literal contra um conjunto fixo) e para `?focus=` via `UUID_RE` em `page.tsx:38,117-118`. A whitelist para `?type=` é o mesmo conjunto de 5 chaves de `TYPE_META` (§3.1) — reaproveitável do padrão já usado em `campaign/route.ts:48-56` (`NUDGE_TYPES: ReadonlySet<NudgeType>`), embora ali sejam 7 valores (para o contexto de Campanha); aqui o conjunto correto é o subconjunto de 5.

### 3.3 Onde o valor entra e sai (threading real, sem invenção)

| Camada | Arquivo:linha | O que muda |
|---|---|---|
| Leitura + validação | `page.tsx:112-118` (mesmo padrão de `requestedFocus`) | Novo bloco análogo: ler `params.type`, validar contra a whitelist de 5, produzir `requestedType: NudgeType \| null` |
| Prop do shell | `EngagementShellProps`, `engagement-shell.tsx:146-165` | Novo campo `initialType: NudgeType \| null`, ao lado de `initialStudentId`/`initialAction` (mesmo padrão) |
| Prop da aba | `SuggestedActionsTabProps`, `types.ts:140-152` | Novo campo opcional (ex.: `initialType?: NudgeType \| null`) — hoje a interface NÃO tem nenhum campo de tipo/cohort, é uma adição pura, não uma mudança de campo existente |
| Consumo na aba | `suggested-actions-tab.tsx:130-133` (`renderable`) | O filtro adicional é uma extensão natural do `useMemo` que já existe ali (hoje filtra só `targetStudentIds.length > 0`) |

### 3.4 Comportamento esperado (contrato de UX, não implementação)

Ao chegar com `?type=inactive`, a aba Ações Sugeridas (já é a aba default, `engagement-shell.tsx:190-192`, nenhuma mudança de tab necessária, ao contrário do fluxo `?student&action=` do contrato b) deve tornar o cartão da coorte `inactive` o resultado primário da visão — o desenho exato (mostrar só aquele card vs destacá-lo primeiro com um "ver todas") é decisão de implementação, fora do escopo deste contrato.

### 3.5 Gap explícito

Não existe hoje nenhum refetch client-side de `/api/engagement/overview` dentro de `SuggestedActionsTab` — a lista vem inteira do server-render de `page.tsx` (`page.tsx:176-231`). Isso significa que o filtro por `?type=` pode ser 100% client-side (sobre os dados já carregados), sem exigir mudança de contrato na API `GET /api/engagement/overview` (`overview/route.ts`). Se uma implementação futura decidir SIM filtrar no servidor, aí sim o contrato da API precisaria de um `?type=` próprio — mas isso não é necessário para o 2B funcionar.

---

## 4. Contrato (b) — `/engagement?student={id}&action=` formalizado

> Decisão 4B do plano Analytics (`06-ia-actions-plan.md §6, Opção 4`): rotear a ação individual pelo idioma `/engagement?student&action=` em vez de endpoints fire-and-forget como `/api/notifications/nudge`.

### 4.1 O padrão já vivo (não é novo código, é formalização)

Já implementado e com consumidor real fora do Andar Analytics:

| Peça | Evidência (file:line) |
|---|---|
| Tipo do verbo de ação | `EngagementDeepLinkAction = "remind" \| "activate" \| "recognize"`, `types.ts:165` (subconjunto de `EngagementActionKind`, `types.ts:162`, que também tem `"manual"` — `"manual"` é modo picker-only, **nunca chega via URL**, conforme o próprio comentário de `types.ts:160-161`) |
| Leitura + validação no server | `page.tsx:288-293` — `initialStudentId` e `initialAction` (comparação literal contra os 3 valores) |
| Auto-seleção de aba no client | `engagement-shell.tsx:189-192` (seed inicial) e `:209-215` (efeito que reage a mudança de querystring em navegação client-side, não só no mount) |
| Consumidor comprovado | `student-insights-table.tsx:282-284` (roda na home do gestor, não na Analytics) — testado em `__tests__/student-insights-table.test.tsx:256-318` |
| Governança do destino | Comentário `page.tsx:286-287`: "the action route re-scopes on dispatch, so a foreign student can never be messaged" — o servidor sempre re-escopa, nunca confia no id vindo da URL |

### 4.2 O que este contrato formaliza (não implementa)

1. **`/engagement?student={id}&action={remind|activate|recognize}`** passa a ser o ÚNICO caminho oficial de nudge por aluno para QUALQUER novo caller externo ao Centro de Engajamento — incluindo a Analytics. Nenhum novo caller deve integrar direto com `/api/notifications/nudge` (o endpoint fire-and-forget citado no plano Analytics §1.3/§5.3 como sobrevivente fora de governança) nem com `POST /api/engagement/action` diretamente sem passar pela revisão da Central de Envios.
2. **Garantia de governança formalizada:** todo disparo por este caminho passa por revisar→aprovar→enviar (nunca disparo cego) e é auditável (aparece em Histórico). Isso já é comportamento real do sistema, não uma promessa nova — este documento só o eleva a contrato explícito que a Analytics pode depender sem reler o código do Centro.
3. **`action` não carrega `nudgeType`.** O Centro deriva o template server-side a partir do ritmo real do aluno (`derive-nudge-type.ts:31-35`, `deriveNudgeTypeFromRitmo`) — a Analytics não precisa (e não deve) calcular ou enviar um `nudgeType` junto do deep-link.

### 4.3 Gap citado (não corrigido aqui)

`page.tsx:288-289` valida `initialStudentId` apenas como `typeof params.student === "string" && params.student` — **sem regex de formato de UUID**, ao contrário de `requestedFocus` que usa `UUID_RE.test(params.focus)` (`page.tsx:117-118`). Isso não é um buraco de segurança (o re-escopo server-side em `/api/engagement/action` garante que um id estranho ao alcance do gestor nunca é mensageado, conforme §4.1), mas é uma inconsistência de validação na borda que fica registrada aqui para quem for tocar `page.tsx` de novo — não faz parte do escopo deste contrato corrigi-la agora.

---

## 5. Tabela consolidada do contrato de deep-link `/engagement`

| Param | Valores válidos | Onde valida | Efeito | Status |
|---|---|---|---|---|
| `?focus=<uuid>` | UUID de um nó da subárvore do gestor | `page.tsx:117-118` (`UUID_RE`) | Escopa cards + abas ao nó drill-down | Já formal (E4/Rodada 3) |
| `?student=<id>` + `?action=<remind\|activate\|recognize>` | `action` validado por comparação literal (`page.tsx:290-293`); `student` SEM regex de formato (§4.3) | `page.tsx:288-293` | Abre Central de Envios pré-preenchida (`engagement-shell.tsx:189-215`) | **Formalizado por este contrato (§4)** |
| `?type=<NudgeType>` | Whitelist de 5 (§3.1): `never_accessed \| inactive \| behind_teaching_plan \| no_reflection \| top_performer` | A implementar, espelhando `page.tsx:117-118` | Pré-filtra/destaca o card correspondente em Ações Sugeridas | **Novo, especificado por este contrato (§3), não implementado** |

---

## 6. Fora de escopo deste documento

1. Implementação de qualquer um dos dois contratos (§3, §4) — este documento é a especificação para a Saga fatiar em stories.
2. A lacuna de "semana atípica vs baseline" (§2) — decisão e escopo próprios, não tratada aqui.
3. Reposicionamento visual da página (renomear para "Ações de Engajamento", rebaixar os 3 cards de triagem) — decisão de produto/UX já relatada ao Hugo em conversa, não especificada em contrato de API neste documento.
4. Migração do consumidor legado `/api/notifications/nudge` em `student-roster.tsx:431-449` (Andar Analytics, fora deste worktree) — o §4.2 formaliza o contrato de DESTINO; migrar o caller antigo é trabalho do Andar Analytics.

---

## 7. Fontes lidas (rastreabilidade)

- Shell e tipos: `page.tsx`, `_components/engagement-shell.tsx`, `_components/types.ts`, `_components/engagement-fetch.ts`.
- Abas: `_components/suggested-actions-tab.tsx`, `_components/send-center-tab.tsx`, `_components/campaigns-tab.tsx`, `_components/history-tab.tsx`, `_components/nudge-labels.ts`, `_components/derive-nudge-type.ts`.
- API: `api/engagement/overview/route.ts`, `api/engagement/campaign/route.ts`.
- Motor: `lib/notifications/engine.ts`, `lib/notifications/engagement-triage.ts`, `lib/notifications/audiences.ts`.
- Tipos de domínio: `types/notifications.ts`, `types/analytics.ts` (`PedagogicalAction`, fora do escopo deste doc).
- Analytics (só leitura, para confirmar o sinal bruto de §2): `api/analytics/manager/route.ts:179`, `components/analytics/session-journey-chart.tsx`, `components/analytics/analytics-dashboard.tsx:594`.
- Consumidor comprovado do padrão `?student&action=`: `components/analytics/student-insights-table.tsx:282-284` e seus testes.
- Plano irmão (Andar Analytics): `integration-worktree/docs/redesign/analytics-apple/06-ia-actions-plan.md` (Opções 2B e 4B, §6).

---

*Documento de contrato técnico. Nenhuma afirmação sem âncora em `arquivo:linha` deste worktree. Escrito pelo PLANEJADOR (arquiteto técnico) da linha de produção, para aprovação do Hugo e fatiamento em stories pela Saga. Sem código, sem push.*
