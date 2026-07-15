# Cards Mestre-Detalhe — Spec de Redesenho de "Ações de Engajamento"

> Documento de especificação para o Hugo aprovar antes de qualquer código. Nenhuma linha de código de app foi escrita para produzir este documento.
>
> Âncoras: todo achado cita `arquivo:linha` no worktree `engagement-worktree` (`/Users/hugocapitelli/Dev/eximia/engagement-worktree`). Continua o reposicionamento registrado no documento irmão anterior, `docs/architecture/02-ponte-contrato.md` (diagnóstico vs ação, taxonomia de cohorts já formalizada em `§3` daquele documento).

---

## 0. Sumário executivo

1. **Ideia aprovada pelo Hugo (2026-07-14):** os cards de sumário deixam de ser estáticos e viram **seletores mestre-detalhe**. Clicar num card molda a página inteira em torno daquele recorte (quem são os alunos + o que fazer com eles). As 4 abas fixas atuais (Ações Sugeridas / Central de Envios / Campanhas / Templates) passam a ser **contextuais por card selecionado**.
2. **Mapeamento real (§2):** boa parte da "vista contextual" de cada card JÁ EXISTE hoje, espalhada entre Ações Sugeridas e Campanhas — este documento localiza exatamente qual componente/trecho é candidato natural a virar a vista de qual card, com `file:line`. Um gap real foi encontrado: a coorte `no_reflection` não pertence a nenhum dos 3 cards de forma limpa (§2.6).
3. **Investigação obrigatória respondida com evidência (§3):** "No ritmo" (`student-triage.ts`) e "destaque"/`top_performer` (`engine.ts`) **NÃO são o mesmo recorte**. Divergem tanto no CRITÉRIO (residual/negativo vs threshold/positivo) quanto na CARDINALIDADE (população majoritária sem teto vs top-3 fixo). Pior: **já existem hoje DOIS mecanismos de reconhecimento vivos e distintos no código** (Campanhas' segmento `no_ritmo`, opcional, população cheia; Ações Sugeridas' coorte `top_performer`, top-3 curado) que nunca foram unificados. A recomendação é **reaproveitar com hierarquia** (não fundir/renomear), com o trade-off explicitado.
4. Nada disto é implementação. Todas as tabelas abaixo são leitura do estado atual + proposta de mapeamento, para o Hugo decidir os pontos em aberto (§4) antes de qualquer story.

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

### 2.5 Peças transversais (não pertencem a um card específico)

| Peça | Evidência (file:line) | Observação |
|---|---|---|
| Central de Envios | `send-center-tab.tsx:1-30` | Serve DOIS fluxos (automático pré-preenchido + manual/busca livre), nenhum dos dois é amarrado a um card de triagem — é alcançável a partir de QUALQUER coorte via "Ação individual" (`suggested-actions-tab.tsx:402-411`) ou aberta solta. Candidato natural a permanecer como ação SEMPRE disponível, não como vista exclusiva de um card. |
| Templates | `templates-tab.tsx` (via `TemplatesTabProps`, `types.ts:279-287`) | Configuração global (biblioteca de templates por `intent`), não descreve nenhum recorte de aluno — não tem card correspondente por natureza. Candidato a ficar fora do modelo por-card (ex.: ícone de engrenagem persistente), não como uma das abas contextuais. |

### 2.6 Gap encontrado: `no_reflection` não mapeia limpo a nenhum dos 3 cards

A coorte `no_reflection` (`TYPE_META`, `suggested-actions-tab.tsx:68-73`; regra em `engine.ts:383-393`, "completou ≥2 sessões mas 0 reflexões") é ortogonal à taxonomia de 3 buckets (`StudentTriagem`, `student-triage.ts:8`). Um aluno pode estar em `no_ritmo` (em dia, sem atraso, acessou há menos de 14 dias) E simultaneamente ser `no_reflection` (não escreveu nenhuma reflexão) — os dois critérios não se excluem. Hoje `no_reflection` só aparece em Ações Sugeridas (`suggested-actions-tab.tsx:68-73`) e NÃO tem segmento correspondente em Campanhas (`CAMPAIGN_SEGMENTS`, `campaign/route.ts:42-46`, só tem `atencao|sem_acesso|no_ritmo`).

**Isto não é resolvido aqui.** Fica registrado como pergunta em aberto para o Hugo em §4 — o redesenho mestre-detalhe precisa de uma casa para essa coorte (dentro de "Atenção"? um 4º card próprio? uma sub-vista dentro de "No ritmo", já que tecnicamente não é risco de evasão?).

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

## 4. Em aberto para o Hugo decidir antes de codar

1. **Hierarquia visual do card "No ritmo"** (§3.6, Caminho A): como "Destaques" (top-3) convive com "Reconhecer em lote" (população cheia) dentro do mesmo card mestre — sub-aba, toggle, ou dois blocos na mesma tela?
2. **Onde mora `no_reflection`** (§2.6): dentro de "Atenção", um 4º card próprio, ou sub-vista de "No ritmo"? Hoje não tem segmento de Campanha correspondente (`CAMPAIGN_SEGMENTS`, `campaign/route.ts:42-46`), só existe em Ações Sugeridas.
3. **Central de Envios e Templates no modelo por-card**: ficam como ações SEMPRE disponíveis (não amarradas a nenhum card) ou cada card ganha sua própria "Central de Envios filtrada"? A decisão 1 do Hugo diz "o conjunto de abas visível muda conforme o recorte" — isso pode significar que Central de Envios simplesmente sempre aparece (ela já é agnóstica de coorte, `send-center-tab.tsx:1-30`) enquanto Templates desaparece do conjunto de abas por card (vira acesso separado, fora do fluxo de recorte).
4. **Interação entre o card selecionado e o deep-link `?student&action=`/`?type=`** (contrato já formalizado em `02-ponte-contrato.md §3-4`): quando a Analytics deep-linka com `?type=inactive`, isso deve AUTO-SELECIONAR o card "Sem acesso" (equivalente hoje ao seed de `activeTab` em `engagement-shell.tsx:189-192`) ou os dois mecanismos (card mestre e `?type=`) coexistem como caminhos paralelos para o mesmo destino? Não decidido, mas os dois documentos precisam convergir antes de virar story.
5. **Cardinalidade de "Recorte da Equipe"**: o controle Diretos/Hierarquia (`engagement-shell.tsx:260-295`) continua acima dos cards mestre (escopo primeiro, coorte depois) ou passa a viver dentro de cada card selecionado? Não mencionado pelo Hugo, presumo que continua acima (é ortogonal a qual coorte se está vendo), mas fica registrado como suposição a confirmar, não decisão.

---

## 5. Fora de escopo deste documento

1. Qualquer implementação dos seletores mestre-detalhe — este é o documento de especificação para a Saga fatiar em stories.
2. A lacuna de "semana atípica vs baseline" (já registrada em `02-ponte-contrato.md §2`) — continua fora de escopo, não é resolvida por este redesenho de UI.
3. Resolver os 5 pontos em aberto de §4 — ficam para decisão do Hugo, não foram decididos por suposição neste documento.

---

## 6. Fontes lidas (rastreabilidade)

- Shell e cards: `engagement-shell.tsx` (`buildSummaryCards:96-144`, `TabsList:345-351`, seed/efeito de deep-link `:189-215`).
- Abas: `suggested-actions-tab.tsx` (`TYPE_META:47-79`, `actionForType:137-143`, "Ação individual" `:402-411`), `campaigns-tab.tsx` (`SEGMENTS:52-78`, tela de segmentos `:318-396`), `send-center-tab.tsx:1-30`, `types.ts` (`TemplatesTabProps:279-287`).
- Motor de coortes: `lib/notifications/engine.ts` (`classifyNudgeCohorts:353-429`, constantes `:52-56`).
- Triagem canônica: `lib/student-triage.ts` (íntegro, `computeStudentRitmo:43-50`, `computeStudentTriagem:65-75`, `computeStudentAction:114-122`).
- API de Campanha: `api/engagement/campaign/route.ts` (`CAMPAIGN_SEGMENTS:42-46`).
- Documento irmão: `docs/architecture/02-ponte-contrato.md` (contrato de deep-link `?type=`/`?student&action=`, referenciado em §4 item 4).

---

*Documento de especificação técnica. Nenhuma afirmação sem âncora em `arquivo:linha` deste worktree. Escrito pelo PLANEJADOR (arquiteto técnico) da linha de produção, para aprovação do Hugo antes de fatiamento em stories. Sem código, sem push.*
