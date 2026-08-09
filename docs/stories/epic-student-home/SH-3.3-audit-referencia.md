# SH-3.3 — Auditoria contra a Referência (mockup "ARGOS Academy", 5 screenshots)

> **Data:** 2026-07-21 · **Modo:** read-only (nenhum arquivo de app tocado)
> **Branch:** `deploy/cory` · **Auditor:** terminal CODER (auditoria solicitada pelo Hugo via Capataz)
>
> **Escopo:** (a) dashboard `/meu-plano` (`plan-dashboard-screen.tsx`), (b) tela recalcular
> (`plan-recalc-screen.tsx`), (c) 3º toggle "Comparativo com o Plano" do card "Meu ritmo"
> (`plan-comparison-panel.tsx` + fiação em `student-home-card.tsx`).
> **Fora do escopo por instrução:** `study-plan-invite-strip.tsx` (em reconstrução paralela por outro terminal).
>
> **Régua:** marca eximIA (cerrado laranja) vs ARGOS (navy) NÃO conta como divergência.
> Conta: estrutura, hierarquia, conteúdo e comportamento.

## Sumário de contagem

| Categoria | Qtde | Itens |
|:---|:---:|:---|
| ✅ FIEL | 9 | Título/subtítulo; 4 stat cards (estrutura); barra de progresso; painel "Seu plano sugerido" (título/texto/4 métricas em grid); pill "Plano ativo"; tabela da jornada (estrutura+bolinhas+badges); caixa de aviso (texto); botão "Recalcular plano"; toggle da home (label + 3 vistas) |
| ⚠️ PARCIAL | 8 | Hero (sem banner de imagem, "ativo" sem destaque na frase); "Conclusão prevista" (dias restantes, não data); "Meta da semana" (box full-width, não canto direito); headers abreviados da jornada; cores semânticas dos badges "Em andamento"/"Planejado"; subtítulo do painel plano x realizado; botão "Ajustar plano" (toggle inline, não navegação); valor de progresso sem a palavra "concluído" |
| ❌ AUSENTE | 4 | Navegação nos itens de "Sua semana" (chevron ">" + link por item); botão "Continuar jornada →"; linha "Interações" na tabela plano x realizado; botão "Manter como está" no dashboard |
| 🔷 DELIBERADO (documentado) | 3 | "Sua semana" com 2 itens reais em vez de 4 narrativos (Dev Agent Record SH-3.3); "Tempo médio/sessão" real em vez de "20 min" fixo (AC2/Dev Agent Record); marca eximIA vs ARGOS (comment header dos 3 componentes) |
| ➕ EXTRA (implementação tem, referência não) | 8 | Breadcrumb "‹ Meu ritmo"; painel de ajuste inline (dias/sessões/reflexão); sub "turma X%" no card Progresso; sub com dias escolhidos no card Ritmo; descrições nos títulos dos painéis; nota de rodapé da jornada (peso reflexão÷interação); empty states explícitos por painel; toasts de confirmação |

---

## TELA 1 — Dashboard "Meu Plano" (`plan-dashboard-screen.tsx`)

### Bloco 1 — Título de página + subtítulo

**✅ FIEL.** `plan-dashboard-screen.tsx:123-130`. "Meu Plano" + "Acompanhe, confirme e ajuste o ritmo da sua jornada." exatos.

**➕ EXTRA:** breadcrumb "‹ Meu ritmo" acima do título voltando para `/dashboard` (`:107-121`). A referência não mostra breadcrumb. Útil para navegação, decisão do Hugo se mantém.

### Bloco 2 — Hero

**⚠️ PARCIAL.** `plan-dashboard-screen.tsx:132-154`.

| Elemento da referência | Estado | Detalhe |
|:---|:---|:---|
| Banner ESCURO com imagem noturna/espaço | ⚠️ diverge | Impl usa `bg-bg-elevated` com borda cerrado, SEM imagem de fundo e sem o contraste escuro do mockup (`:135`). É o desvio visual mais perceptível da tela. |
| "Oi, Rinaldo." (nome do aluno) | ✅ | "Oi, {firstName}." (`:143-145`), nome real via SSR (`page.tsx:64`). |
| Texto com "ativo" em destaque verde | ⚠️ diverge | Frase idêntica ("Seu plano está ativo. Acompanhe o combinado e ajuste quando necessário.", `:146-148`), mas "ativo" NÃO tem destaque na frase. Compensação: pill verde "Plano ativo" acima do título (`:139-142`), que a referência não tem nesse ponto. Semanticamente coberto, estruturalmente diferente. |
| Botão sólido laranja "Revisar plano →" à direita | ✅ (menor) | `Button` default (sólido cerrado) "Revisar plano" à direita (`:150-152`). Sem a seta "→". |

### Bloco 3 — Faixa de 4 stat cards

**✅ FIEL** na estrutura. `plan-dashboard-screen.tsx:156-192` + `StatCard` (`:471-518`). Cards claros, ícone tingido à esquerda (rounded-lg, referência sugere circular, cosmético), label pequeno em cima + valor. Os 4 cards batem 1:1 em ordem e assunto:

1. **Trilha** → `courseTitle` real ou "Sem trilha vinculada" (`:158-162`). ✅
2. **Módulo atual** → "Módulo N" + sub com título do capítulo (`:163-172`). Referência mostra "Módulo 2 — Definir o Problema" inline; impl divide em valor + sub. Equivalente. ✅
3. **Progresso geral** → "42%" + BARRA de progresso (`:173-183`, barra em `:508-515`). ✅ ⚠️ menor: valor sem a palavra "concluído". ➕ EXTRA: sub "turma X%" (comparativo com média da turma, não existe na referência).
4. **Ritmo escolhido** → "2 sessões / semana" (`:184-191`). ✅ ➕ EXTRA: sub com labels dos dias escolhidos.

### Bloco 4a — Painel "Seu plano sugerido" (coluna esquerda)

**✅ FIEL na maior parte, com 1 parcial e 2 deliberados.** `plan-dashboard-screen.tsx:196-363`.

| Elemento da referência | Estado | Detalhe |
|:---|:---|:---|
| Título + texto "Nossa IA estruturou um plano personalizado para você evoluir com autonomia." | ✅ | `:197-200`, texto exato. |
| Métrica "Duração estimada · 4 semanas" | ✅ | `projection.weeksToClose` + "semanas" (`:202-207`). |
| Métrica "Conclusão prevista · 30 de agosto" (DATA) | ⚠️ diverge | Impl mostra `diagnostic.daysLeft` + "dias restantes" (`:208-213`). Referência mostra data absoluta de conclusão; impl mostra contagem regressiva. Informação relacionada mas formato diferente. |
| Métrica "Ritmo sugerido · 2 sessões por semana" | ✅ | `:214-219`. |
| Métrica "Tempo médio por sessão · 20 min" | 🔷 deliberado | Dado REAL medido (`avgMinutesPerSession`, média `completed_at − created_at`), degrada para "—" sem dado (`:220-229`). Documentado no AC2 e Dev Agent Record da story SH-3.3 (mais forte que o valor fixo do mockup). Não é bug. |
| Pill verde "✓ Plano ativo" à esquerda | ✅ (menor) | `:232-235`. Usa bolinha em vez de check, cosmético. |
| Botão outline laranja "Ajustar plano →" à direita | ⚠️ deliberado | Impl é botão-texto com chevron que abre painel de ajuste INLINE (`:236-249`), não navegação para outra tela. É o pivô SH-3.3 documentado (AC1 reescrito + comment `:13-16`): o ajuste (dias/sessões/reflexão) vive dentro do painel. Comportamento diferente do mockup, mas decisão registrada. |

**➕ EXTRA:** todo o painel de ajuste inline (`:257-362`, grid de 7 dias, stepper de sessões, switch de reflexão com badge "seu gap real", botões "Voltar ao plano sugerido"/"Concluir ajuste"). Na referência isso não aparece no dashboard (era tela separada). Extra deliberado do pivô.

### Bloco 4b — Painel "Sua semana" (coluna direita)

**⚠️ PARCIAL, com os 2 AUSENTES mais relevantes da auditoria.** `plan-dashboard-screen.tsx:365-404`.

| Elemento da referência | Estado | Detalhe |
|:---|:---|:---|
| Título "Sua semana" | ✅ | `:366`. ➕ EXTRA: descrição "O que te recoloca no ritmo esta semana." |
| "Meta da semana: avançar no Módulo 2" no canto direito do header | ⚠️ diverge | Impl mostra a meta como box destacado full-width ACIMA do checklist (`:369-381`), com módulo+título reais. Conteúdo equivalente, posição/hierarquia diferentes. |
| Checklist de 4 itens ('Concluir "Definir o Problema"', 'Iniciar "Identificar o Problema"', "Responder 1 interação", "Registrar 1 reflexão") | 🔷 deliberado | Impl tem 2 itens agregados reais: "Sessões da semana" e "Reflexões da semana" com "X de Y combinadas" (`:382-397`). Decisão documentada no Dev Agent Record da SH-3.3 (linha ~138): dado real não sustenta granularidade por item individual. Não marcar como bug. |
| Itens com CHEVRON ">" à direita, cada um NAVEGÁVEL | ❌ AUSENTE | `ChecklistItem` (`:564-604`) é `div` estático: sem chevron, sem link, sem onClick. Na referência cada item leva o aluno para a ação. A simplificação para 2 itens foi documentada; a perda da navegabilidade NÃO foi, e itens agregados ("Sessões da semana") ainda poderiam linkar para `continueHref`/reflexão, como o toggle da home já faz na coluna AÇÃO. |
| Botão outline "Continuar jornada →" embaixo à direita | ❌ AUSENTE | Não existe nenhum CTA no painel "Sua semana". Na referência é a saída de ação principal do painel. Não documentado como decisão. |

### Bloco 5a — Painel "Sua jornada planejada" (coluna esquerda inferior)

**✅ FIEL na estrutura.** `plan-dashboard-screen.tsx:409-432` + `ModuleJourneyTable` (`:631-693`).

| Elemento da referência | Estado | Detalhe |
|:---|:---|:---|
| Tabela Módulo \| Prazo sugerido \| Interações \| Reflexões \| Status | ⚠️ menor | Colunas presentes na mesma ordem, headers abreviados: "Prazo", "Inter.", "Reflex." (`:637-651`). |
| 8 módulos com bolinha numerada laranja | ✅ | Bolinha numerada por linha (`:658-673`): cerrado no "doing", verde com check no "done", neutra no "planned". Quantidade vem do dado real da trilha, não fixa em 8 (correto). |
| Datas tipo "12 de julho" | ⚠️ menor | `formatDatePtBR` gera "12 de jul." (mês abreviado, `:59-62`). |
| Badges: Concluído verde, Em andamento verde-claro, Planejado âmbar | ⚠️ diverge | `statusBadge` (`:606-629`): Concluído verde ✅; "Em andamento" em cerrado laranja (referência: verde-claro); "Planejado" em cinza neutro (referência: âmbar). Não é a questão ARGOS/navy, é semântica de cor de status. Possível adaptação de marca intencional, mas não documentada; fica para o Hugo arbitrar. |

**➕ EXTRA:** nota de rodapé de honestidade sobre distribuição do prazo e peso reflexão÷interação=3 ilustrativo (`:417-425`). Coerente com AC2, referência não tem.

### Bloco 5b — Painel "Seu plano x seu realizado" (coluna direita inferior)

**⚠️ PARCIAL.** `plan-dashboard-screen.tsx:434-465` + `WeeklyComparisonTable` (`:695-777`).

| Elemento da referência | Estado | Detalhe |
|:---|:---|:---|
| Título "Seu plano x seu realizado" | ✅ | `:436`. |
| Subtítulo "Comparativo da sua semana atual" | ⚠️ menor | Impl mostra o intervalo real ("Semana de 20 de jul. a 26 de jul.", `:437-441`). Informação melhor, texto diferente. O texto literal da referência existe na Tela 2 (`plan-recalc-screen.tsx:56-58`). |
| Tabela Item \| Planejado \| Realizado \| Situação | ✅ | Headers exatos (`:724-739`). |
| Linha Sessões 2/1 "1 pendente" | ✅ | `:703-710` + situação "N pendente(s)"/"Cumprido" (`:758-768`), mesmos rótulos da referência. |
| Linha **Interações** 1/1 "Cumprido" | ❌ AUSENTE | `WeeklyComparison` só computa sessões e reflexões; a tabela só tem essas 2 linhas (`:696-719`). A referência tem 3 (Sessões/Interações/Reflexões). Provável mesma raiz da decisão do checklist (interações semanais não computadas), mas ao contrário do checklist NÃO está documentado como deliberado. Mesmo gap na Tela 2 (`plan-recalc-screen.tsx:89-101`). |
| Caixa de aviso COM ÍCONE: "Você está uma sessão abaixo do plano da semana. Posso redistribuir…" | ✅ (menor) | Box condicional a `situation === "pendente"` (`:446-453`), texto "Você está abaixo do combinado nesta semana. Posso redistribuir a jornada sem alterar sua data final." (genérico em vez de "uma sessão", aceitável pois cobre gaps ≠ 1). ⚠️ menor: SEM ícone no box. |
| Botão sólido laranja "↻ Recalcular plano" | ✅ (menor) | `:455-457`, sólido cerrado, sem o ícone ↻. |
| Botão outline "Manter como está" | ❌ AUSENTE (no dashboard) | Não existe ao lado do "Recalcular plano" no dashboard. Existe apenas dentro da Tela 2 como card de escolha (`plan-recalc-screen.tsx:145-163`). Fluxo mudou: na referência o aluno decide direto no dashboard; na impl decide na sub-tela. Não documentado; funcionalmente coberto, estruturalmente divergente. |

---

## TELA 2 — "Recalcular plano" (`plan-recalc-screen.tsx`)

> O briefing desta auditoria detalhou a referência apenas da tela dashboard. A auditoria da
> Tela 2 é ESTRUTURAL (contra o que o próprio conjunto de telas implica) e por consistência interna.

- **Header:** botão voltar + "Recalcular plano" (`:41-53`). ✅ coerente.
- **"Comparativo da sua semana atual"** + chip com intervalo da semana (`:55-66`). ✅ (é aqui que vive o subtítulo literal da referência do bloco 5b).
- **Tabela Item | Planejado | Realizado | Situação** (`:70-104`): mesmas 2 linhas do dashboard, situação com setas "Dentro do plano"/"N abaixo do plano" (`:199-211`). ❌ mesma ausência da linha **Interações** (ver bloco 5b).
- **Caixa "coach"** com ícone, título condicional ("Você está um pouco abaixo do plano. Tudo bem!" / "Você está em dia…") e promessa de redistribuir sem estourar (`:107-122`). ✅ estruturalmente rica, tom da referência.
- **2 cards de escolha:** "Recalcular automaticamente" (Recomendado, cerrado) e "Manter como está" (Sem mudanças) (`:125-164`). ✅ é onde o par de ações da referência foi parar.
- **Comportamento:** ambas as escolhas são estado local (sem POST), documentado no comment `:6-11` e AC4 da story. ✅ deliberado.
- **Nota de rodapé** "Você pode revisar e ajustar seu plano sempre que precisar." (`:172-174`). ➕ extra.

---

## TOGGLE 3 — "Comparativo com o Plano" no card "Meu ritmo" da home (`plan-comparison-panel.tsx`)

> Idem: o briefing não descreveu screenshot específico deste toggle; auditoria contra a
> especificação registrada no próprio componente (R5/R7, Hugo 2026-07-21) + consistência com `/meu-plano`.

- **Fiação:** 3º `SegButton` "Comparativo com o Plano" ao lado de "Visão detalhada" e "Gráficos" (`student-home-card.tsx:149-151`), renderiza `PlanComparisonPanel` lazy (só monta com o toggle ativo, `:182-186`). ✅
- **Tabela:** Indicador | Meu plano | Realizado | Como estou | Ação (`:266-343`), 3 linhas (Sessões, Reflexões condicional, Progresso da trilha), cada uma com CTA navegável ("Fazer uma interação"/"Registrar uma reflexão"/"Continuar sessão"). ✅ conforme a versão FULL que o Hugo confirmou contra a recomendação do painel (comment `:12-16`). Nota: aqui os itens SÃO navegáveis, exatamente o que falta no painel "Sua semana" do dashboard (bloco 4b).
- **Escopo cumulativo (R7):** Sessões/Reflexões comparam acumulado desde o início (`sessionsDoneCount`/`reflDoneCount` vs `cumulativeExpected`), correção explícita do Hugo documentada (`:22-32`, `:180-192`). ✅ deliberado.
- **"Meu plano da semana":** checklist semanal com meta do módulo (`:350-391`), mesmo predicado done do dashboard. ✅ consistente.
- **"Próximo ajuste sugerido":** card mata-atlântica com "Recalcular plano" (link para `/meu-plano`) + "Manter como está" (dismiss local) (`:443-500`). ✅. ⚠️ observação menor: aqui "Manter como está" só esconde o card via state local (`setDismissed`); remonta em todo remount do toggle. Comportamento raso, aceitável para o propósito, registrado para ciência.
- **Estados:** skeleton, erro e sem-plano com CTA "Montar meu plano" (`:62-95`). ➕ extra bem-vindo.
- **Sem reimplementação de cálculo:** tudo via `/api/analytics/plan-dashboard`, mesmas funções de `/meu-plano` (`:16-20`, `buildPlanRows` `:193-241` é puro). ✅ deliberado (não-negociável do Pedro Valério).

---

## As 3 divergências mais importantes (avaliação do auditor)

1. **"Sua semana" perdeu a função de hub de ação** (bloco 4b, `plan-dashboard-screen.tsx:382-397` e `:564-604`): itens sem chevron/link e sem o botão "Continuar jornada →". A redução 4→2 itens está documentada e ok; a perda da NAVEGABILIDADE não está, e é a diferença de comportamento que mais muda a experiência (na referência o painel leva o aluno para a próxima ação; na impl só informa). O próprio toggle da home prova que os hrefs existem e resolvem isso.
2. **Linha "Interações" ausente nas tabelas plano x realizado** (dashboard `:695-719` e recalc `:89-101`): a referência compara 3 dimensões (Sessões/Interações/Reflexões), a impl compara 2. Interações são justamente o dado que o resto do produto mais mede; ausência não documentada como deliberada.
3. **Hero sem o banner escuro de imagem + "Manter como está" fora do dashboard** (blocos 2 e 5b): o hero é o desvio visual mais visível da tela (painel claro comum vs banner imersivo da referência), e o par de decisão "Recalcular / Manter" que a referência oferece direto no dashboard hoje exige entrar na Tela 2.

---

## Coisas que a implementação TEM e a referência NÃO tem (para o Hugo decidir se mantém)

1. Breadcrumb "‹ Meu ritmo" (dashboard).
2. Painel de ajuste inline completo no "Seu plano sugerido" (pivô SH-3.3, deliberado).
3. Sub "turma X%" no stat card Progresso e dias escolhidos no card Ritmo.
4. Descrições sob os títulos de todos os painéis.
5. Nota de honestidade do peso reflexão÷interação na jornada.
6. Empty states explícitos por painel (sem trilha, sem semana, sem capítulos) e tela `MeuPlanoEmptyState`.
7. Toasts de confirmação (plano atualizado/recalculado/mantido).
8. No toggle da home: estados skeleton/erro/sem-plano e o card "Próximo ajuste sugerido" dismissível.

*Relatório de auditoria, nenhuma correção aplicada. Priorizações a cargo do Hugo.*
