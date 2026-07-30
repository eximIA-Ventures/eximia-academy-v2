# Story: Percorrido x Elaborado — captura da exposição por módulo

**Version:** 1.0
**Created:** 2026-07-30
**Author:** Dex (@dev)
**Status:** Ready for Review (parcial — ver §Escopo entregue)
**Priority:** P2
**Branch:** `deploy/cory`
**Type:** Feature (brownfield)
**Contrato:** `docs/architecture/medicao-percorrido-vs-elaborado.md`

---

## User Story

**As a** gestor da eximIA Academy,
**I want** distinguir quem completou um curso elaborando (exercícios, reflexões,
interações socráticas) de quem apenas passou os slides,
**so that** eu intervenha com a pessoa certa antes que o investimento em
treinamento vire desperdício.

---

## Escopo entregue nesta story

| # | Entrega | Status |
|---|---------|:------:|
| 1 | Route handler de escrita da marca d'água | **Feito** |
| 2 | Captura no viewer (observador de `currentIndex`) | **Feito** |
| 3a | Motor de cálculo derivado + testes | **Feito** |
| 3b | Fiação na tabela do gestor (UI) | **PARADO, ver §Divergência** |
| 4 | Aplicação da migration em produção | **Não feito** (decisão de Hugo + @devops) |

A ordem não é acidental: o documento de arquitetura (§9) registra que a métrica
só vale prospectivamente, então **cada dia sem a captura no ar é um dia de série
perdido**. Captura primeiro, leitura depois, é o que preserva dado.

---

## Implementação

### 1. Route handler

`apps/web/src/app/api/chapter-view-progress/route.ts` (novo)

Recebe `{ chapterId, maxSlideIndex, slidesTotal, reachedLastSlide }` e faz upsert
em `chapter_view_progress`.

Invariantes de segurança, conforme §6 do contrato:

- `tenant_id` resolvido **no servidor** a partir da sessão. O payload nunca o
  informa; aceitá-lo permitiria semear linhas em outra empresa.
- O `chapterId` é validado contra o tenant da sessão (`chapters` tem `tenant_id`
  direto), pelo mesmo motivo.
- **Zero uso de service client.** É escrita do próprio aluno sobre o próprio
  dado; a RLS vale integralmente. Verificado:
  `grep -c "createServiceClient" route.ts` → `0`.
- Monotonicidade **não** é reimplementada aqui: o trigger
  `chapter_view_progress_invariants` faz o clamp no banco, o que mantém a
  invariante válida mesmo com requisições fora de ordem (condição normal, já que
  o cliente coalesce e usa `sendBeacon`).

### 2. Captura no viewer

`.../present/_components/use-chapter-view-tracker.ts` (novo) +
2 linhas em `presentation-viewer.tsx`.

O efeito observa o **estado** `currentIndex`, não a função de navegação. Motivo
verificado no código: existem **dois** caminhos que trocam o slide —
`goToSlide` (`presentation-viewer.tsx:190`, navegação deliberada) e o
auto-advance por timestamp de áudio (`presentation-viewer.tsx:273`,
`setCurrentIndex` direto). Um gancho na navegação perderia todo o segundo
caminho, e observar o estado é imune a caminhos que ainda não existem.

Comportamento:

| Gatilho | Ação |
|---------|------|
| Índice supera a marca d'água local | Agenda escrita com debounce de 3s |
| Índice **não** supera (revisita) | Nada é escrito |
| Alcança o último slide | **Flush imediato, sem debounce** — é o evento que define o percorrido e não pode depender de timer |
| `visibilitychange` (hidden) / `pagehide` | Flush via `navigator.sendBeacon` |
| Falha de rede | Silenciosa. Telemetria nunca degrada a aula |

**Decisão de Hugo honrada:** o avanço automático por áudio **conta** como
percorrido. Não há checagem de visibilidade da aba nem ramificação por origem do
avanço (contrário à recomendação técnica original, registrado em §8 do contrato).

### 3a. Motor de cálculo

`apps/web/src/lib/analytics/view-progress.ts` (novo)

Puro, sem I/O, sem armazenar percentual. Expõe `moduleProgressPct`,
`courseProgressPct`, `hasNewContentSince`, `shouldAdvanceWatermark` e
`summarizeCourseView`.

O `pct` do curso é **`null` quando não há dado**, e `null` deve virar
"sem dado" na UI, jamais "0%": a métrica nasce vazia para todos, e um zero
mentiria sobre quem estudou antes de a instrumentação existir.

---

## Divergência encontrada na implementação (requer decisão de Hugo)

O contrato pede "desdobrar a célula Progresso em PERCORRIDO e ELABORADO".
Ao chegar na UI, **o ELABORADO já existe como coluna própria**: a tabela
(`components/analytics/student-insights-table.tsx`) tem "ENGAJ." exibindo
`N interações · M reflexões`, que é exatamente a elaboração.

Implementar o desdobramento literal **duplicaria** o engajamento em duas colunas
vizinhas. Conforme instruído, **parei em vez de improvisar** uma solução
divergente do desenho aprovado.

A leitura que parece resolver o problema real do Hugo, para a decisão dele:
desdobrar a célula em **DECLARADO** (o `courseProgressPct` atual, que é o clique
no botão) versus **PERCORRIDO** (o dado novo). É o contraste entre esses dois
que expõe quem clicou sem ver, e o ELABORADO permanece na coluna ao lado, sem
duplicação.

Ponto adicional que pesa na decisão: até a migration ser aplicada e os alunos
voltarem a estudar, a coluna exibiria "sem dado" para **todos**. Fiar a UI antes
disso entrega uma tela que não mostra nada.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `apps/web/src/app/api/chapter-view-progress/route.ts` | Novo: escrita da marca d'água |
| `apps/web/src/app/(platform)/courses/.../present/_components/use-chapter-view-tracker.ts` | Novo: captura no cliente |
| `apps/web/src/app/(platform)/courses/.../present/_components/presentation-viewer.tsx` | 2 linhas: import + chamada do hook |
| `apps/web/src/lib/analytics/view-progress.ts` | Novo: cálculo derivado |
| `apps/web/src/lib/analytics/__tests__/view-progress.test.ts` | Novo: 17 testes |
| `docs/stories/feat-percorrido-elaborado-captura.md` | Novo: esta story |

---

## Validações

| Gate | Resultado |
|------|-----------|
| Testes novos | **17/17 passam** |
| Suíte completa | **7 falhas** / 1997 passam — idêntico ao baseline herdado, zero regressão |
| Typecheck | exit 0, limpo |
| Lint (arquivos novos) | Limpo |
| Build (`turbo build`) | **2/2 tasks successful** |
| Service client na escrita do aluno | **0 ocorrências** |

Cobertura dos testes: curto-circuito do `reached_last_slide_at`; capítulo que
ganha slides (não rebaixa, mas sinaliza); capítulo que perde slides (clamp em
100%); denominador ausente; marca d'água que não escreve em revisita; e o
`null` que nunca pode virar 0%.

---

## Pendências

1. **Migration não aplicada.** `20260730000000_chapter_view_progress.sql` está
   escrita e não aplicada. **Enquanto ela não subir, o route handler responde 500
   em toda escrita** (tabela inexistente). Isso é silencioso para o aluno por
   contrato, mas significa que a captura só começa a colher depois da aplicação.
2. **Push** não executado — autoridade exclusiva do @devops.
3. **Decisão de UI** descrita em §Divergência.
4. **Gate adversarial do @qa**, com prova explícita de isolamento cross-tenant
   (positivo + os dois controles negativos descritos na migration).
