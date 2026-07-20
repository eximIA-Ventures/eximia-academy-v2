# SH-3.2: "Meu plano de estudo" — simplificação radical da UI (Krug, "Don't Make Me Think")

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** [SH-3.1](./SH-3.1.story.md) (a tela navegável, o motor de projeção `study-plan-projection.ts` e a fonte de dados real via `computeStudentComparison` — tudo reusado sem alteração).
**Bloqueia:** nenhuma story aberta. A persistência real do "compromisso semanal" segue fora de escopo (mesma fronteira do SH-3.1).
**Paralelizável:** toca APENAS `meu-plano/_components/meu-plano-client.tsx` e seu teste. Não toca `page.tsx`, `study-plan-projection.ts`, `student-home-card.tsx`, nem qualquer schema/migration.

---

## Story

**As a** aluno que abre a tela `/meu-plano` pela primeira vez,
**I want** entender o que a página faz e como agir em menos de 3 segundos, sem ler texto de apoio nem processar 5 seções de uma vez,
**so that** eu decida (confirmar meu plano) com o mínimo de esforço cognitivo — a tela me ajuda, não me faz pensar.

## Contexto (Dev Notes)

### Origem — feedback do Hugo (fundador) após testar a tela do SH-3.1 rodando

O Hugo testou a tela entregue no SH-3.1 e deu, por áudio, este feedback (transcrito com fidelidade):

> *"não gostei muito ainda... tá muito complexo... a gente tem que pensar que a página tem que ser tipo 'pô, o cara tem que entrar e entender o que aquela página faz, como fazer'... basicamente, não me faça pensar"*

Ele está citando diretamente **"Don't Make Me Think" (Steve Krug)**: toda página deve ser autoevidente, sem instrução, com o MÍNIMO de decisões apresentadas de uma vez. A tela do SH-3.1, embora funcional e com dado real, tinha **5 seções densas simultâneas** (recap do diagnóstico → escolha de dias → intensidade/foco → projeção com barras + timeline → confirmação), exigindo que o aluno processasse texto + números + controles antes de conseguir agir. É exatamente o oposto do que Krug (e o Hugo) pedem.

### Por que uma story nova (SH-3.2) e não só um Change Log no SH-3.1

O SH-3.1 já está `InReview` e representa um deliverable coeso e completo (a tela navegável com dado real e fronteira de não-persistência). Esta mudança é um **pivô de design distinto**, disparado por feedback novo após teste ao vivo, com critério de aceite próprio (simplicidade radical sob a lente Krug). Uma story separada mantém a trilha do SDC honesta (uma story = uma unidade coerente de trabalho) e preserva o registro do SH-3.1 intacto, em vez de sujar retroativamente uma story já em revisão. O Change Log do SH-3.1 ganha um ponteiro para cá, para a trilha ficar descobrível.

## O redesenho (Krug como LENTE, não checklist)

A estrutura de 5 seções numeradas foi **substituída por um caminho único e óbvio**, com a complexidade secundária escondida atrás de revelações progressivas:

1. **O plano JÁ vem pronto e visível.** O card único no topo abre com o plano sugerido (default Seg/Qua/Sex, 2 sessões/dia, reflexão on — os mesmos defaults do `DEFAULT_STUDY_PLAN_CHOICE`), mostrando: veredito ao vivo (com dot colorido), **um resumo essencial (1 frase + 1 número)** citando a carga semanal e se fecha o gap, uma fita de dias escolhidos (leitura instantânea, sem controles), e a **ação principal ("Confirmar meu plano") como o elemento mais alto da tela**. O aluno sabe o que fazer só de olhar — sem ler o parágrafo de apoio, que foi removido.
2. **Ajustar é secundário e recolhido.** Dias, stepper de sessões e switch de reflexão ficam dentro de um `<details>` "Ajustar meu plano" (fechado por default). Só quem quer mexer abre — não é mais um passo obrigatório logo de cara.
3. **O cálculo completo é opcional.** As duas barras de suficiência (progresso/reflexões), o recap textual do diagnóstico e a linha de prazo ficam dentro de outro `<details>` "Ver o cálculo completo". O essencial (a frase-resumo) está sempre visível acima; o detalhe rico está disponível, mas não forçado.

Teste mental aplicado antes de finalizar (Krug): *um aluno que nunca viu a tela saberia o que fazer só de olhar, sem ler nada?* — Sim: título curto → card com veredito + botão grande "Confirmar meu plano". A decisão principal é óbvia em <3s.

### O que NÃO mudou (deliberado)

- **Fonte de dados idêntica.** `progressNow`/`progressTarget`/`reflNow`/`reflTotal`/`reflDoneCount`/`daysLeft`/`weeksLeft` continuam vindo de `computeStudentComparison` via `page.tsx` (intocado) e alimentando o MESMO motor puro `computeStudyPlanProjection` (intocado). Nenhum cálculo foi alterado, reimplementado ou inventado — só a apresentação e a ordem em que as decisões aparecem.
- **Interatividade essencial preservada.** O aluno ainda ajusta dias, sessões e reflexão, e ainda confirma — só que o ajuste virou opcional/expansível em vez de obrigatório/exposto.
- **Fronteira de escopo do SH-3.1 mantida.** Zero migration, zero persistência real, "Confirmar meu plano" continua sendo só `useState` local (testado explicitamente que não chama `fetch`).

## Acceptance Criteria

- [x] **AC1:** A tela abre com UM caminho óbvio: o plano sugerido já montado e visível (card único no topo), com a ação principal "Confirmar meu plano" como elemento mais proeminente — sem exigir que o aluno percorra seções antes de agir.
- [x] **AC2:** A estrutura de 5 seções numeradas do SH-3.1 foi removida; os controles de ajuste (dias/sessões/reflexão) ficam num bloco secundário recolhido ("Ajustar meu plano", `<details>` fechado por default).
- [x] **AC3:** O detalhe pesado (barras de projeção + recap textual + prazo) fica num segundo bloco recolhido ("Ver o cálculo completo"); a versão resumida essencial (1 frase + 1 número) fica sempre visível acima.
- [x] **AC4 (fonte de dados intacta):** `page.tsx`, `study-plan-projection.ts` e a chamada a `computeStudentComparison` NÃO foram tocados; os mesmos campos reais alimentam o mesmo motor puro. Nenhum dado inventado.
- [x] **AC5 (fronteira, crítico):** "Confirmar meu plano" continua 100% estado local — teste dedicado (`vi.spyOn(globalThis, "fetch")`, `not.toHaveBeenCalled()`) segue verde. Zero migration, zero persistência.
- [x] **AC6 (interatividade preservada):** toggle de dia, stepper de sessões (1-5), switch de reflexão, confirmar e recomeçar continuam funcionando e recomputam a projeção/resumo ao vivo.
- [x] **AC7 (degradação graciosa preservada):** sem `daysLeft`/`weeksLeft` → veredito `unknown` e a linha de prazo some (sem número falso); sem `reflectionsMax` → aviso textual em vez de barra; sem diagnóstico → `MeuPlanoEmptyState` (inalterado).
- [x] **AC8 (cobertura de teste):** testes reescritos para a nova estrutura, sem redução de cobertura — 13 testes (era 10), cobrindo o card pronto, o resumo sempre-visível, as duas revelações, e toda a interatividade/degradação anterior.
- [x] **AC9:** Reuso de tokens/componentes do design system (`@eximia/ui` `Button`/`Switch`/`Breadcrumb*`, `formatPctPtBR1`); revelação progressiva por `<details>`/`<summary>` nativo (semântico, acessível por teclado, zero dependência extra), fechado por default. `tsc`/`biome` limpos.

## Tasks

- [x] 1. Ler o SH-3.1 e TODOS os arquivos de `meu-plano/` na íntegra (page, client, empty-state, teste) + o motor `study-plan-projection.ts`.
- [x] 2. Redesenhar `meu-plano-client.tsx`: card do plano pronto (veredito + resumo + fita de dias + CTA), `<details>` "Ajustar meu plano", `<details>` "Ver o cálculo completo". Fonte de dados intocada.
- [x] 3. Reescrever `meu-plano-client.test.tsx` para a nova estrutura, preservando/ampliando cobertura (13 testes verdes).
- [x] 4. `tsc --noEmit` (0 erros) + `vitest run` (23 testes: 10 motor + 13 client, verdes) + `biome check` (limpo).
- [x] 5. Servidor dev (`:3002`) + confirmação visual pelo Hugo (`open`).

## Complexidade & Riscos

- **Complexidade:** M (medium). Redesenho de UI de 1 componente, sem novo dado, sem novo I/O, sem novo cálculo. O risco está em não regredir a interatividade/degradação já provada.
- **Riscos:**
  - R1 (baixo, mitigado): esconder os controles atrás de `<details>` "quebrar" os testes de interatividade. Mitigação: `<details>` renderiza os filhos no DOM mesmo fechado (jsdom), então as queries do Testing Library continuam alcançando os controles; os testes de dia/stepper/switch/confirm/reset seguem verdes.
  - R2 (baixo): o aluno não descobrir os ajustes por estarem recolhidos. Mitigação: a summary "Ajustar meu plano" é auto-rotulada e com hint ("dias, sessões e foco em reflexão"); o resumo essencial já cita a carga do plano, então o default é acionável sem abrir nada.
  - R3 (baixo, mitigado): vazar `fetch`/`POST` numa refatoração. Mitigação: o teste de fronteira do SH-3.1 foi preservado.

## Dev Notes

- **Arquivo modificado:** `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-client.tsx` (redesenho completo do JSX; a lógica de estado — `toggleDay`/`setSessionsPerDay`/`setReflFocus`/`reset`/`confirm` — foi preservada byte-a-byte).
- **Teste reescrito:** `apps/web/src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx` (13 testes para a nova estrutura).
- **NÃO tocado:** `page.tsx`, `study-plan-projection.ts`, `meu-plano-empty-state.tsx`, `student-home-card.tsx`, qualquer migration/schema.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run "src/app/(platform)/meu-plano" src/lib/analytics/__tests__/study-plan-projection.test.ts
npx biome check "src/app/(platform)/meu-plano/_components/meu-plano-client.tsx" "src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx"
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-20 | Simplificação radical da UI de `/meu-plano` sob a lente de Krug ("Don't Make Me Think"), após feedback do Hugo em teste ao vivo do SH-3.1 ("tá muito complexo... não me faça pensar"). **Cortado:** a estrutura de 5 seções numeradas simultâneas (recap, dias, intensidade, projeção com barras, confirmação) e o parágrafo de instrução de cabeçalho. **Ficou:** um card único no topo com o plano JÁ pronto (veredito + resumo essencial de 1 frase + 1 número + fita de dias + CTA "Confirmar meu plano" como elemento mais alto). **Movido para secundário/expansível:** os controles de ajuste (dias/sessões/reflexão) em `<details>` "Ajustar meu plano", e o detalhe pesado (barras + recap + prazo) em `<details>` "Ver o cálculo completo", ambos fechados por default. **Preservado:** fonte de dados (`computeStudentComparison` → `computeStudyPlanProjection`, ambos intocados), toda a interatividade, a degradação graciosa e a fronteira de não-persistência (teste de `fetch` não-chamado segue verde). `tsc` exit 0; 23 testes verdes (10 do motor + 13 do client, era 20 — cobertura ampliada); `biome` limpo. Só `meu-plano-client.tsx` + seu teste tocados. | J.A.R.V.I.S. (@dev / Dex) |

## Dev Agent Record

### Contexto de execução

Feedback do Hugo (fundador) por áudio, após rodar a tela do SH-3.1 localmente. Pedido: simplificar radicalmente sob a lente Krug, sem perder o dado real nem a interatividade essencial, mantendo a fronteira de não-persistência. Redesenho por julgamento de UX sênior (Krug como lente, não checklist mecânico); a materialização concreta (card pronto + duas revelações progressivas) foi decisão de design própria dentro das diretrizes dadas.

### Achados durante a implementação

- **A complexidade era 100% de apresentação, não de dado.** O motor `study-plan-projection.ts` já produzia tudo que a versão resumida precisa (`verdict`, `sessionsPerWeek`, `reflPerWeek`, `weeksToClose`, `progressProj`/`reflProj`) — a frase-resumo `planSummary()` só reembala esses campos já calculados, sem novo caminho de dado. Isso deixou o redesenho seguro: nenhuma linha de cálculo foi tocada.
- **`<details>`/`<summary>` nativo é a revelação progressiva certa aqui** (Krug: esconder complexidade secundária atrás de um controle óbvio e auto-rotulado): semântico, acessível por teclado, fechado por default, e zero dependência nova. E como jsdom mantém os filhos do `<details>` no DOM mesmo fechado, os testes de interatividade (toggle de dia, stepper, switch) seguem alcançando os controles sem precisar simular a abertura.
- **A lógica de estado do SH-3.1 estava limpa o suficiente para ser preservada byte-a-byte** — só o JSX (a árvore de apresentação) mudou. Isso reduziu o risco de regressão ao mínimo: os handlers testados são literalmente os mesmos.

### File List

- `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-client.tsx` (modificado — redesenho de UI)
- `apps/web/src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx` (reescrito — 13 testes)
- `docs/stories/epic-student-home/SH-3.2.story.md` (novo)
- `docs/stories/epic-student-home/SH-3.1.story.md` (Change Log: 1 linha de ponteiro para o SH-3.2)
