# Cards Mestre-Detalhe — Spec de Redesenho de "Ações de Engajamento"

> Documento de especificação para o Hugo aprovar antes de qualquer código. Nenhuma linha de código de app foi escrita para produzir este documento.
>
> Âncoras: todo achado cita `arquivo:linha` no worktree `engagement-worktree` (`/Users/hugocapitelli/Dev/eximia/engagement-worktree`). Continua o reposicionamento registrado no documento irmão anterior, `docs/architecture/02-ponte-contrato.md` (diagnóstico vs ação, taxonomia de cohorts já formalizada em `§3` daquele documento).

---

## 0. Sumário executivo

1. **Ideia aprovada pelo Hugo (2026-07-14):** os cards de sumário deixam de ser estáticos e viram **seletores mestre-detalhe**. Clicar num card molda a página inteira em torno daquele recorte (quem são os alunos + o que fazer com eles). As 4 abas fixas atuais (Ações Sugeridas / Central de Envios / Campanhas / Templates) passam a ser **contextuais por card selecionado**.
2. **Mapeamento real (§2):** boa parte da "vista contextual" de cada card JÁ EXISTE hoje, espalhada entre Ações Sugeridas e Campanhas — este documento localiza exatamente qual componente/trecho é candidato natural a virar a vista de qual card, com `file:line`. Um gap real foi encontrado: a coorte `no_reflection` não pertence a nenhum dos 3 cards de forma limpa (§2.6).
3. **Investigação obrigatória respondida com evidência (§3):** "No ritmo" (`student-triage.ts`) e "destaque"/`top_performer` (`engine.ts`) **NÃO são o mesmo recorte**. Divergem tanto no CRITÉRIO (residual/negativo vs threshold/positivo) quanto na CARDINALIDADE (população majoritária sem teto vs top-3 fixo). Pior: **já existem hoje DOIS mecanismos de reconhecimento vivos e distintos no código** (Campanhas' segmento `no_ritmo`, opcional, população cheia; Ações Sugeridas' coorte `top_performer`, top-3 curado) que nunca foram unificados. A recomendação é **reaproveitar com hierarquia** (não fundir/renomear), com o trade-off explicitado.
4. Nada disto é implementação. Todas as tabelas abaixo são leitura do estado atual + proposta de mapeamento. **Atualização (2026-07-14, mesmo dia):** as 5 questões que estavam em aberto foram decididas pelo Hugo — ver §4 "Decisões do Hugo" e §7 "Pronto para stories". Nenhuma decisão de produto permanece pendente.

---

## 1. Desenho conceitual já decidido (não reaberto aqui)

Confirmado pelo Hugo em 2026-07-14, registrado verbatim para rastreabilidade:

1. Os cards de sumário viram **seletores mestre-detalhe**: clicar num card molda a página inteira em torno daquele recorte (quem são os alunos + o que fazer com eles), em vez de cards estáticos + abas fixas separadas.
2. As abas atuais deixam de ser fixas e passam a ser **contextuais por card selecionado** — o conjunto de abas visível muda conforme o recorte ativo.
3. O card "Mensagens enviadas" deixa de ser card de segmento e vira **botão/link no header**, ao lado do título "Ações de Engajamento", continuando a levar a Ver Histórico.
4. O card "No ritmo" é **candidato** a fluxo de reconhecimento (parabenizar) — candidato, não fechado; §3 investiga se ele já tem essa semântica ou se colide com `top_performer`.

---

## 2. Mapeamento real: componentes existentes candidatos a "vista contextual" por card

> Estado atual, ANTES do redesenho: 4 abas fixas e globais (`TabsList`, `engagement-shell.tsx:345-351`, valores `suggested | send-center | campaigns | templates`, mais `history` sem trigger próprio). Nenhuma delas hoje filtra por card selecionado — é o que este mapeamento propõe religar.

### 2.1 Card "Atenção"

| Vista candidata | Evidência (file:line) | Natureza |
|---|---|---|
| Cards de coorte `behind_teaching_plan` e `never_accessed` em Ações Sugeridas | `TYPE_META`, `suggested-actions-tab.tsx:51-67` (chaves `never_accessed` e `behind_teaching_plan`) | Ação individual/curada, revisar→enviar |
| Segmento `atencao` em Campanhas | `campaigns-tab.tsx:53-60` (primeiro item de `SEGMENTS`) | Ação em lote, revisão obrigatória por linha |
| Botão "Acionar" no modelo de ação individual | `student-triage.ts:107-108,114-122` (`computeStudentAction`, `triagem === "atencao"` → `{kind:"acionar"}`) | Fonte da verdade do verbo "Acionar" usado em `actionForType`, `suggested-actions-tab.tsx:137-143` |

### 2.2 Card "Sem acesso"

| Vista candidata | Evidência (file:line) | Natureza |
|---|---|---|
| Card de coorte `inactive` em Ações Sugeridas | `TYPE_META`, `suggested-actions-tab.tsx:56-60` | Ação individual/curada |
| Segmento `sem_acesso` em Campanhas | `campaigns-tab.tsx:61-67` | Ação em lote |
| Botão "Lembrar" no modelo de ação individual | `student-triage.ts:105-106,114-122` (`triagem === "sem_acesso"` → `{kind:"lembrar"}`) | Fonte da verdade do verbo "Lembrar" |

### 2.3 Card "No ritmo"

| Vista candidata | Evidência (file:line) | Natureza |
|---|---|---|
| Segmento `no_ritmo` em Campanhas (JÁ marcado opcional/reconhecimento) | `campaigns-tab.tsx:69-77` (`optional: true`, descrição "Alunos em dia — reconhecer o engajamento reforça a motivação"), botão "Reconhecer" em `campaigns-tab.tsx:388` | Ação em lote, população cheia (potencialmente grande) |
| Card de coorte `top_performer` em Ações Sugeridas | `TYPE_META`, `suggested-actions-tab.tsx:74-78` | Ação individual/curada, população **hard-capped em 3** (ver §3) |
| Ausência de ação no modelo individual | `student-triage.ts:119` (`triagem === "no_ritmo"` → `{kind:"none"}`, badge estática) | Confirma que hoje NENHUMA ação de aluno único nasce do bucket "No ritmo" fora do fluxo de Campanha |

Ver §3 para o veredito completo sobre estas duas vistas coexistirem sem fusão.

### 2.4 Card "Mensagens enviadas" (deixa de ser card, decisão 2)

| Peça | Evidência (file:line) |
|---|---|
| Card atual (a remover como card) | `engagement-shell.tsx:132-143` (`key: "mensagens-enviadas"`) |
| Link "Ver histórico" já existente (reaproveitável tal como está) | `engagement-shell.tsx:140-141` (`link: { label: "Ver histórico", tab: "history" }`) |
| Destino (aba sem trigger próprio, já demotida) | `HistoryTab`, `engagement-shell.tsx:389-403` |

Nada muda no destino, só o gatilho: de card no grid (`engagement-shell.tsx:299-339`) para botão no cabeçalho (`engagement-shell.tsx:225-258`, região do `<h1>`).

### 2.5 Central de Envios e Templates — CORREÇÃO (decisão 3 do Hugo, §4)

> **Correção:** a revisão anterior deste documento hipotetizava que Central de Envios e Templates permaneceriam sempre-disponíveis/agnósticas de card ("peças transversais"). O Hugo decidiu o oposto (§4, decisão 3): cada card mestre ganha sua PRÓPRIA versão filtrada dos dois. Esta seção substitui a hipótese anterior.

| Peça | Estado atual (file:line) | O que a decisão 3 exige |
|---|---|---|
| Central de Envios, modo manual (picker) | `send-center-tab.tsx:1-30`; busca via `GET /api/engagement/students` sem `ids` (modo lista/busca, `api/engagement/students/route.ts:161-211`) — **confirmado: hoje só filtra por nome (`q`) e paginação (`limit`), NÃO existe filtro por tipo/cohort nesse endpoint** | Gap de backend real, não só de UI: a rota precisaria aceitar um novo parâmetro para o picker respeitar o recorte do card ativo (ex.: `type=` ou a lista de `targetStudentIds` do card selecionado) |
| Central de Envios, modo automático (`?student&action=`) | `engagement-shell.tsx:189-215` | Sem mudança — já é inerentemente "de um aluno específico", não precisa de filtro por card |
| Templates | `templates-tab.tsx` via `TemplatesTabProps`/`intentOrder` (`types.ts:279-287`); ordem hoje fixa em `INTENT_ORDER` (`engagement-shell.tsx:57-64`: `primeiro_acesso, retomada, atraso_plano, reflexao_pendente, reconhecimento, manual`) | Cada card mostraria só os `intent`s correspondentes à sua semântica (ex.: card "Sem acesso" → só `retomada`). A correspondência `TemplateIntent` ↔ `NudgeType` **não é uma tabela explícita no código** — é inferida pela nomenclatura paralela entre `INTENT_ORDER` e as chaves de `NUDGE_TYPE_TEMPLATE_KEY` (`engine.ts:67-75`); confirmar que os templates seedados têm o `intent` certo é dado de banco, fora do alcance de uma leitura de código |

### 2.6 Gap encontrado: `no_reflection` não mapeia limpo a nenhum dos 3 cards

A coorte `no_reflection` (`TYPE_META`, `suggested-actions-tab.tsx:68-73`; regra em `engine.ts:383-393`, "completou ≥2 sessões mas 0 reflexões") é ortogonal à taxonomia de 3 buckets (`StudentTriagem`, `student-triage.ts:8`). Um aluno pode estar em `no_ritmo` (em dia, sem atraso, acessou há menos de 14 dias) E simultaneamente ser `no_reflection` (não escreveu nenhuma reflexão) — os dois critérios não se excluem. Hoje `no_reflection` só aparece em Ações Sugeridas (`suggested-actions-tab.tsx:68-73`) e NÃO tem segmento correspondente em Campanhas (`CAMPAIGN_SEGMENTS`, `campaign/route.ts:42-46`, só tem `atencao|sem_acesso|no_ritmo`).

**Resolvido pelo Hugo (§4, decisão 2):** `no_reflection` entra dentro do card "Atenção", com um "porquê" individual por aluno nos detalhes. Ver §4 para a investigação sobre campo reaproveitável e o veredito.

---

## 3. Investigação: "No ritmo" vs "Destaque"/`top_performer` são o mesmo recorte?

> Pergunta obrigatória do briefing, respondida com evidência de código, não suposição.

### 3.1 Critério exato de "No ritmo" (`StudentTriagem`, `student-triage.ts:65-75`)

```
computeStudentTriagem(row, ritmo, now):
  se isStudentConcluido(row)                     → "no_ritmo"      (regra 0, sempre)
  senão se ritmo === "atrasado" | "nao_iniciado"  → "atencao"
  senão se diasDesdeUltimaSessao > 14             → "sem_acesso"
  senão                                            → "no_ritmo"     (RESIDUAL)
```

Fonte: `student-triage.ts:65-75`, com o comentário explícito da hierarquia em `:52-64`: `no_ritmo = resto (VERDE)`. **É uma definição negativa/residual**: não exige nenhum mínimo de sessões, nenhum mínimo de reflexões, não tem ranking, não tem teto de população. Todo aluno que não caiu em risco (atraso/nunca-iniciado/sumido) cai aqui, incluindo alunos com **zero reflexões** e apenas 1 sessão concluída, contanto que não estejam atrasados nem sumidos há mais de 14 dias.

### 3.2 Critério exato de "destaque"/`top_performer` (`engine.ts:395-413`)

```
topPerformers = signals
  .filter(s => s.completedSessions >= 3 && s.reflectionsCount >= 2)   // engine.ts:398-401
  .sort(by engagement desc)                                          // engine.ts:402-405
  .slice(0, 3)                                                       // engine.ts:406, TOP_PERFORMER_LIMIT
```

Constantes: `TOP_PERFORMER_MIN_SESSIONS = 3`, `TOP_PERFORMER_MIN_REFLECTIONS = 2`, `TOP_PERFORMER_LIMIT = 3` (`engine.ts:54-56`). Fonte: `engine.ts:395-413`. **É uma definição positiva/threshold + ranking**: exige explicitamente ≥3 sessões concluídas E ≥2 reflexões escritas, depois ordena por engajamento (`completedSessions + reflectionsCount`) e corta nos **3 primeiros, sempre**, independente de quantos alunos cumpram o critério.

### 3.3 Comparação lado a lado

| Dimensão | No ritmo (`student-triage.ts:65-75`) | Destaque/`top_performer` (`engine.ts:395-413`) |
|---|---|---|
| Tipo de critério | Negativo/residual (ausência de risco) | Positivo/threshold (presença de engajamento demonstrado) |
| Exige sessões mínimas? | Não | Sim, ≥3 concluídas |
| Exige reflexões mínimas? | Não (zero reflexões é aceitável) | Sim, ≥2 |
| Ranqueado? | Não | Sim, por `completedSessions + reflectionsCount` |
| Teto de população | Nenhum | **3, sempre** (`TOP_PERFORMER_LIMIT`) |
| Cardinalidade típica | Majoritária (a maior fatia saudável do recorte) | Minoritária fixa (no máximo 3 nomes) |
| Fonte de dados | `TriageInput` (sessões/pace/matrícula) via `computeStudentTriagem` | `StudentSignal` (sessões/reflexões/atraso) via `classifyNudgeCohorts` |
| Ação hoje associada | Nenhuma no modelo individual (`{kind:"none"}`, `student-triage.ts:119`); só existe via Campanhas `no_ritmo` (`campaigns-tab.tsx:69-77`) | Card dedicado em Ações Sugeridas (`suggested-actions-tab.tsx:74-78`), ação individual "Parabenizar" |

### 3.4 Veredito

**São populações DIFERENTES, por critério e por cardinalidade — não é o mesmo recorte pronto para promover/renomear.** Um aluno pode estar em `no_ritmo` sem nunca qualificar como `top_performer` (basta ter poucas sessões ou zero reflexões, o que não o tira do "verde"). O inverso é quase sempre verdadeiro por construção (quem cumpre 3 sessões + 2 reflexões dificilmente está atrasado), mas **não é garantido por código**: nada impede um aluno com `ritmo === "atrasado"` (portanto `triagem === "atencao"`, NÃO `no_ritmo`) de também cumprir o threshold de sessões/reflexões de `top_performer` — os dois cálculos rodam em pipelines independentes (`student-triage.ts` via `TriageInput`/pace de matrícula; `engine.ts` via `StudentSignal`/`behindSchedule`) e nunca se cruzam no código atual. `top_performer` não é filtrado por `triagem`, então tecnicamente pode incluir um aluno tecnicamente "atrasado" que ainda assim é hiperengajado.

### 3.5 Achado extra: já existem DOIS mecanismos de reconhecimento vivos, não um

Isto não estava na pergunta original, mas é decorrência direta da investigação e muda a proposta:

- **Campanhas, segmento `no_ritmo`** (`campaigns-tab.tsx:69-77`, botão "Reconhecer" em `:388`): já É um fluxo de reconhecimento hoje, opcional, sobre a população CHEIA de "No ritmo" (potencialmente dezenas de alunos), com o mesmo mecanismo de revisão em lote de qualquer campanha (cap 200, `MAX_RECIPIENTS`, `campaigns-tab.tsx:37`).
- **Ações Sugeridas, coorte `top_performer`** (`suggested-actions-tab.tsx:74-78`): também É reconhecimento hoje, mas curado e mínimo, sempre no máximo 3 nomes, no fluxo individual de revisão de Ações Sugeridas.

Os dois já convivem no código sem nunca terem sido unificados ou sequer citados um em relação ao outro em comentário nenhum dos dois arquivos.

### 3.6 Proposta: reaproveitar com hierarquia (recomendado) vs criar recorte novo

| Caminho | Descrição | Trade-off |
|---|---|---|
| **A, reaproveitar com hierarquia (recomendado)** | O card mestre "No ritmo" abre a vista já existente do segmento Campanhas `no_ritmo` (reconhecimento em lote, população cheia) como vista PRIMÁRIA; o card `top_performer` de Ações Sugeridas vira uma sub-vista/filtro DENTRO do mesmo card mestre ("Destaques", os 3 mais engajados dentro do recorte "No ritmo"), não um card separado nem uma fusão | Preserva as duas granularidades que já existem e já têm testes/fluxo funcionando (nenhuma lógica de coorte muda); exige decidir a hierarquia visual (2 sub-abas dentro do card? um toggle?) — é trabalho de UX, não de motor |
| **B, fundir/renomear** | Tratar `no_ritmo` e `top_performer` como o mesmo recorte, aposentando um dos dois cálculos | **Rejeitado pela evidência de §3.3/§3.4**: fundir perderia ou a granularidade curada (top-3, o que faz o reconhecimento parecer prêmio, não rotina) ou a cobertura ampla (reconhecer só 3 de uma turma de 40 alunos em dia soa incompleto); os dois mecanismos servem propósitos genuinamente diferentes (parabéns de rotina em massa vs destaque seletivo) |
| **C, criar recorte novo do zero** | Uma terceira definição de "quem merece reconhecimento", nem `no_ritmo` nem `top_performer` | Não há evidência de que os dois critérios atuais estejam errados, criar um terceiro sem motivo é trabalho e superfície de bug extras sem ganho demonstrado — não recomendado |

---

## 4. Decisões do Hugo (2026-07-14)

> As 5 questões que ficavam em aberto na revisão anterior deste documento foram decididas pelo Hugo no mesmo dia. Cada uma abaixo registra a decisão + a investigação de evidência que ela exigiu.

### Decisão 1 — "Destaques" e "Reconhecer em lote" como DOIS BLOCOS (não sub-aba/toggle)

Fecha a hierarquia visual do Caminho A (§3.6) que ficava em aberto: dentro do card mestre "No ritmo", **os dois mecanismos de reconhecimento coexistem como dois blocos simultâneos na mesma tela**, não como navegação entre estados. Bloco 1, "Destaques" — o card de coorte `top_performer` (top-3, `TYPE_META`, `suggested-actions-tab.tsx:74-78`), ação individual/curada. Bloco 2, "Reconhecer em lote" — o segmento `no_ritmo` de Campanhas (`campaigns-tab.tsx:69-77`), ação em lote sobre a população cheia. Nenhuma lógica de coorte muda (§3.4/§3.5 continuam válidas) — é decisão puramente de composição visual.

### Decisão 2 — `no_reflection` dentro de "Atenção" + "porquê" individual por aluno

`no_reflection` entra no card "Atenção" (junto de `behind_teaching_plan` e `never_accessed`). Como `no_reflection` é ortogonal à `triagem` canônica (§2.6, um aluno pode ser `triagem==="no_ritmo"` E `no_reflection` ao mesmo tempo), cada aluno dentro de "Atenção" ganha um "porquê" individual nos detalhes — o exemplo do Hugo: um aluno cuja `triagem` real é `no_ritmo` mas está em "Atenção" só por `no_reflection` mostra algo como "No ritmo, mas sem interações recentes" (frase ilustrativa do Hugo, não copy final, ver §7).

**Investigação pedida — existe campo de "motivo"/"reason" reaproveitável?**

| Granularidade | Campo existente | Evidência (file:line) | Serve para o "porquê" individual composto? |
|---|---|---|---|
| Por COORTE (grupo inteiro) | `EngagementSuggestion.rationale` / `nudge_suggestions.rationale` | `types.ts:100-108`; `types/notifications.ts:213`; texto vem de `TYPE_META[...].blurb`, `suggested-actions-tab.tsx:47-79` | Não — é 1 frase para o grupo todo, não por aluno |
| Por LINHA de campanha (parece per-aluno, mas ainda é 1:1 com o tipo do grupo) | `PreviewLine.reason: string` | `campaigns-tab.tsx:83-91` (campo em `:87`), preenchido em `campaign/route.ts:266` como `reason: derivedNudgeType` — o "reason" É o `nudgeType`, renderizado via `nudgeTypeReason()`/`NUDGE_TYPE_REASON` (`nudge-labels.ts:30-38,45-47`) | Não — o comentário do próprio arquivo admite a simplificação ("the report treats the GROUP reason as sufficient per-recipient motivo", `nudge-labels.ts:25-29`); não combina sinais ortogonais |
| Por ALUNO único (o nível certo) | Nenhum campo `reason`/`motivo` | `EngagementStudentDetail` (`types.ts:173-197`) e `CohortStudent` (`suggested-actions-tab.tsx:87-98`) têm os INGREDIENTES crus (`ritmo`, `status`, `behindSchedule`, `completedSessions`, `reflectionsCount`, `daysSinceLastActivity`) mas nenhum campo combina isso numa frase | **Não existe hoje — é campo/função nova** |

**Veredito:** não há campo reaproveitável no nível de granularidade certo, mas o trabalho não é do zero. O SHAPE (`reason: string` por aluno) já tem precedente direto (`PreviewLine.reason`). O PADRÃO de função pura que deriva uma frase/enum a partir de sinais crus já tem precedente direto (`deriveNudgeTypeFromRitmo`, `derive-nudge-type.ts:31-35`; `computeStudentAction`, `student-triage.ts:114-122`). Falta uma função NOVA, mesmo padrão, que combine `triagem` + a condição de `no_reflection` (`completedSessions>=2 && reflectionsCount===0`, hoje só calculada em `engine.ts:383-393`) numa frase composta. Nenhum dado novo precisa ser coletado — é decisão de implementação (Coder), não gap de produto.

### Decisão 3 — Central de Envios e Templates ganham versão filtrada por card

Ver §2.5 (corrigida nesta revisão). Resumo: contradiz a hipótese anterior deste documento — cada card mestre passa a ter sua própria vista filtrada de Central de Envios e de Templates. Gap de backend real encontrado: `GET /api/engagement/students` no modo picker (`api/engagement/students/route.ts:161-211`) hoje só filtra por nome (`q`) e paginação (`limit`), sem filtro de tipo/cohort — precisa de parâmetro novo para respeitar o recorte do card ativo.

### Decisão 4 — `?type=` auto-seleciona o card, sem caminho paralelo

Confirmado: `?type=` (contrato `02-ponte-contrato.md §3`) segue o MESMO padrão já comprovado de `?student&action=` (seed inicial de `activeTab` a partir da querystring, `engagement-shell.tsx:189-192`, efeito que reage a mudança client-side, `:209-215`) — auto-seleciona o card correspondente, nunca um caminho paralelo.

**Isto refina, não quebra, o contrato de `02-ponte-contrato.md §3`**: o shape do param (`?type=<NudgeType>`) e a whitelist de 5 valores continuam exatamente como especificados ali. Muda apenas COMO este lado consome o valor — de "filtra a lista plana de Ações Sugeridas" para "seleciona o card mestre + abre a sub-vista certa dentro dele", porque as decisões 1 e 2 quebram a relação 1-para-1 entre `type` e card.

**Tabela de mapeamento completa (os 5 valores de `TYPE_META`):**

| `type` (`NudgeType`) | Card mestre selecionado | Sub-vista dentro do card | Fonte da coorte (file:line) | Fonte da população canônica (file:line) |
|---|---|---|---|---|
| `never_accessed` | Atenção | — (bloco único de Atenção) | `TYPE_META`, `suggested-actions-tab.tsx:51-55` | `ritmo==="nao_iniciado"` (`student-triage.ts:47`) → `triagem==="atencao"` (`:71`) |
| `behind_teaching_plan` | Atenção | — (bloco único de Atenção) | `TYPE_META`, `suggested-actions-tab.tsx:62-67`; regra `engine.ts:415-427` | `ritmo==="atrasado"` (`student-triage.ts:48`) → `triagem==="atencao"` (`:71`) |
| `no_reflection` | Atenção | — (bloco único de Atenção, com "porquê individual" da decisão 2) | `TYPE_META`, `suggested-actions-tab.tsx:68-73`; regra `engine.ts:383-393` | Ortogonal à `triagem` (§2.6) — não deriva de `student-triage.ts` |
| `inactive` | Sem acesso | — (bloco único de Sem acesso) | `TYPE_META`, `suggested-actions-tab.tsx:56-61`; regra `engine.ts:368-381` | `triagem==="sem_acesso"` (`student-triage.ts:72-73`) |
| `top_performer` | No ritmo | Bloco "Destaques" (decisão 1) | `TYPE_META`, `suggested-actions-tab.tsx:74-78`; regra `engine.ts:395-413` | Não deriva de `triagem` (§3.4) — pipeline independente |

**Assimetria a registrar:** o bloco "Reconhecer em lote" do card "No ritmo" (segmento Campanhas `no_ritmo`) **não é alcançável via `?type=`**. `no_ritmo` é um valor de `StudentTriagem`/`CampaignSegment` (`student-triage.ts:8`; `types/notifications.ts:59`), NÃO um valor de `NudgeType` (`types/notifications.ts:27-34`) — está fora da whitelist de 5 valores definida em `02-ponte-contrato.md §3.1`. Esse bloco só é alcançável selecionando o card "No ritmo" diretamente, nunca por deep-link de tipo.

### Decisão 5 — "Recorte da Equipe" confirmado acima dos cards mestre

Confirmado pelo Hugo, deixa de ser suposição. O controle Diretos/Hierarquia (`TeamScopeControl`, `engagement-shell.tsx:260-295`) continua acima da grade de cards mestre — escopo primeiro, coorte depois. Nenhuma mudança de código necessária nesta peça: é a MESMA composição de hoje.

---

## 5. Fora de escopo deste documento

1. Qualquer implementação dos seletores mestre-detalhe — este é o documento de especificação para a Saga fatiar em stories.
2. A lacuna de "semana atípica vs baseline" (já registrada em `02-ponte-contrato.md §2`) — continua fora de escopo, não é resolvida por este redesenho de UI.
3. As decisões de implementação listadas em §7 (microcopy exata, shape do novo parâmetro de filtro, verificação de dado seedado) — são do Coder, não deste documento.

---

## 6. Fontes lidas (rastreabilidade)

- Shell e cards: `engagement-shell.tsx` (`buildSummaryCards:96-144`, `TabsList:345-351`, `INTENT_ORDER:57-64`, seed/efeito de deep-link `:189-215`).
- Abas: `suggested-actions-tab.tsx` (`TYPE_META:47-79`, `actionForType:137-143`, "Ação individual" `:402-411`, `CohortStudent:87-98`), `campaigns-tab.tsx` (`SEGMENTS:52-78`, `PreviewLine:83-91`, tela de segmentos `:318-396`), `send-center-tab.tsx:1-30`, `types.ts` (`EngagementSuggestion:100-108`, `EngagementStudentDetail:173-197`, `TemplatesTabProps:279-287`).
- Motor de coortes: `lib/notifications/engine.ts` (`classifyNudgeCohorts:353-429`, constantes `:52-56`, `NUDGE_TYPE_TEMPLATE_KEY:67-75`).
- Triagem canônica: `lib/student-triage.ts` (íntegro, `computeStudentRitmo:43-50`, `computeStudentTriagem:65-75`, `computeStudentAction:114-122`).
- Derivação de nudgeType por ritmo: `_components/derive-nudge-type.ts:31-35`.
- Labels/reason de cohort: `_components/nudge-labels.ts:15-47`.
- API de Campanha: `api/engagement/campaign/route.ts` (`CAMPAIGN_SEGMENTS:42-46`, `reason: derivedNudgeType` em `:266`).
- API de picker de alunos: `api/engagement/students/route.ts:161-211` (confirmação do gap de filtro por tipo, decisão 3).
- Tipos de domínio: `types/notifications.ts` (`NudgeType:27-34`, `CampaignSegment:59`, `TemplateIntent:70-76`, `NudgeSuggestionRow.rationale:213`).
- Documento irmão: `docs/architecture/02-ponte-contrato.md` (contrato de deep-link `?type=`/`?student&action=`, refinado por §4 decisão 4).

---

## 7. Pronto para stories

As 5 questões de produto levantadas na revisão anterior (§4) foram decididas pelo Hugo nesta revisão. O que resta a partir daqui é **implementação**, não produto:

1. Desenho visual exato dos "dois blocos" do card "No ritmo" (decisão 1) — layout, não semântica; a semântica (o que cada bloco mostra e de onde vem) já está fechada em §2.3/§3.6.
2. Microcopy exata da frase de "porquê individual" (decisão 2) — o Hugo deu um exemplo ilustrativo ("No ritmo, mas sem interações recentes"), não uma string final travada; a FUNÇÃO que a gera segue o padrão já existente (`deriveNudgeTypeFromRitmo`, `computeStudentAction`), combinando dados já disponíveis, nenhum dado novo a coletar.
3. Shape exato do novo parâmetro de filtro em `GET /api/engagement/students` para o picker de Central de Envios filtrado por card (decisão 3) — nome do param, se aceita `type=` ou uma lista de ids, é decisão de API do Coder.
4. Verificação de que os templates seedados em `notification_templates` têm o `intent` correto por cohort (decisão 3, Templates filtrado) — é checagem de dado de banco, não decisão de produto.

**Nenhuma decisão de produto permanece em aberto.** O documento está pronto para a Saga fatiar em stories.

---

*Documento de especificação técnica. Nenhuma afirmação sem âncora em `arquivo:linha` deste worktree. Escrito pelo PLANEJADOR (arquiteto técnico) da linha de produção, para aprovação do Hugo antes de fatiamento em stories. Sem código, sem push.*
