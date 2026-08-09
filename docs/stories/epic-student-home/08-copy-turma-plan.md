# SH-F.8 — Copy polish: "organização" → "turma" no Meu ritmo (Tier-3, verbatim do Hugo)

> **Autor:** Vitruvio (Planejador) · **Data:** 2026-07-13
> **NÃO é epic novo.** Anexa à **EPIC-STUDENT-HOME-FINALIZAÇÃO** como **SH-F.8**.
> **Fase:** DOCS ONLY. Corrente: Vitruvio → Saga → Roteiro → Contrato → Capataz. Cada estágio curto (é copy, não há design a decidir).
> **Worktree:** `/Users/hugocapitelli/Dev/eximia/integration-worktree` (a mesma da linha). main `52a54f5` intocada. ZERO push.

## 0. Escopo (só copy de DISPLAY; zero lógica/dado)

Trocar a nomenclatura user-facing "organização" → "turma" no componente Meu ritmo. A média continua **ORG-WIDE** (todos os alunos do tenant); no deploy per-client tenant = cliente, então seus alunos = "a turma", logo "Média da turma" é preciso. **Nenhuma mudança de cálculo, tipo, variável ou chave de cache.**

## 1. Ocorrências reais (grep verificado na worktree) e ação

### Trocas OBRIGATÓRIAS (user-facing + assertions, load-bearing)
| # | Arquivo:linha | De | Para |
|:-|:--|:--|:--|
| 1 | `components/analytics/student-home-card.tsx:110` (subtitle) | `Como você está em relação à organização nos últimos 30 dias.` | `Como você está em relação à turma nos últimos 30 dias.` |
| 2 | `components/analytics/comparison-insights-table.tsx:261` (label da linha) | `Média da organização` | `Média da turma` |
| 3 | `components/analytics/__tests__/student-home-card.test.tsx:169` (assertion) | `/em relação à organização/i` | `/em relação à turma/i` |
| 4 | `components/analytics/__tests__/comparison-insights-table.test.tsx:61` (assertion) | `getByText("Média da organização")` | `getByText("Média da turma")` |

### Trocas de CONSISTÊNCIA (comentários + títulos de teste, recomendadas, não bloqueiam build)
| # | Arquivo:linha | Natureza |
|:-|:--|:--|
| 5 | `comparison-insights-table.tsx:4` e `:254` | comentários que citam "Média da organização" → atualizar p/ "turma" (doc honesta) |
| 6 | `app/dev/preview-desempenho/page.tsx:98` | **comentário** descritivo (`Você / Média da organização`). O preview renderiza via `ComparisonInsightsTable`, então o LABEL exibido já vira "turma" automaticamente pela troca #2, **nenhuma mudança funcional no preview**; só o comentário para consistência. |
| 7 | `student-home-card.test.tsx:157,166` | títulos `describe`/`it` que dizem "organização" → renomear p/ "turma" (cosmético) |

### Nada mais a mudar (verificado)
- **Variante de gráficos** (`SignalRowsView` em `student-comparison-view.tsx`): grep NÃO achou copy "organização" ali (só barras "você"/"média"). Nada a trocar. A Lupa reconfirma via grep.
- Fora esses arquivos, `grep "organiza"` no surface Meu ritmo não retorna outra copy user-facing.

## 2. LIMITE DURO (não fazer)

- **NÃO** renomear identificadores internos/tipos/variáveis/chaves de cache: `orgAverage`, `OrgReference`, `org-reference-cache`, campos em `types/analytics.ts`. **Só copy de display.**
- **NÃO** tocar na lógica de cálculo. Média permanece org-wide. Zero mudança de dado/lógica.

## 3. Critério de saída (AC objetivo)

- (a) subtitle (`student-home-card.tsx`) = "…em relação à turma…".
- (b) label (`comparison-insights-table.tsx`) = "Média da turma".
- (c) variante gráficos + preview sem copy "organização" user-facing remanescente (preview herda o label do componente).
- (d) testes dos 2 componentes verdes com "turma".
- (e) zero mudança de lógica/dado; build de produção verde (116/116).

## 4. Verificação (Lupa, no fim, batched com SH-F.6 + SH-F.7)

- `grep -rn "organiza"` nos 2 componentes Meu ritmo + variante gráficos: **nenhuma copy user-facing "organização" restante** (identificadores internos, se houver, são permitidos).
- `grep` confirma "turma" na subtitle e no label.
- Testes dos 2 componentes verdes.
- Build de produção verde (116/116), cobrindo SH-F.6 + SH-F.7 + SH-F.8 juntos num único build.

## 5. Sequenciamento e guardrails

- Pode ser feito **DEPOIS** do SH-F.7 fechar (não atropelar o review focado de LGPD), mas na **MESMA worktree** `integration/main-x-engagement` para o deploy sair batched (um único build verde cobre F.6+F.7+F.8).
- **ZERO push.** main `52a54f5` e deploy/cory intocadas. O @devops só é acionado após a aprovação batched da Lupa.

## 6. Auto-checagem
- [x] 4 trocas load-bearing (2 copy + 2 assertions) + 3 de consistência, com paths:linhas reais.
- [x] Limite duro registrado (só display; zero identificador/lógica/dado).
- [x] Variante gráficos verificada (sem copy "organização"); preview herda o label.
- [x] Anexa a SH-F como SH-F.8; batched no build final; zero push.

**Path:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/08-copy-turma-plan.md`
