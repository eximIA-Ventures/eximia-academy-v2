# Modelo de árvore de issues — como estruturar trabalho grande no board

> Este documento existe para não redesenhar do zero, toda vez, como quebrar uma
> tarefa grande em issues. Ele descreve o padrão já usado neste board (43 issues
> do roadmap, depois a auditoria de 34 epics em #60) e quando cada nível de
> profundidade se justifica.

## O padrão: 3 níveis, criados sob demanda

```
Issue-mãe (rastreamento, não executa nada sozinha)
  └── Sub-issue (uma frente de trabalho coesa)
        └── Sub-sub-issue (só se a sub-issue for grande demais para uma passada)
```

**Regra central: cada nível só nasce quando o nível acima provar que precisa dele.**
Não se cria a árvore inteira de antemão "porque pode precisar depois" — isso
gera issues vazias ou genéricas demais para executar. O fluxo é sempre:

1. Comece com **uma issue-mãe** descrevendo o objetivo e, se já souber, o
   checklist do que precisa acontecer.
2. Quebre em **sub-issues** quando o trabalho tiver partes **coesas e
   independentes o bastante para alguém pegar uma sem precisar das outras**.
3. Quebre uma sub-issue em **sub-sub-issues** só se, ao começar a trabalhar
   nela, ela se revelar grande demais para uma sessão — nunca antes disso.

GitHub Projects suporta nativamente esses 3 níveis (o campo "Parent issue" e
"Sub-issues progress" seguem a cadeia inteira). Exemplo real deste
repositório, issue `#60` (auditoria de 34 grupos de epic):

```
#16  [EPIC-ANALYTICS-360]                          ← issue-mãe original
  └── #60  [EPIC-QA-STATUS] Auditar Status ...      ← sub-issue que virou mãe
        ├── #61  Lote A — epics 1-9                 ← sub-sub-issue
        ├── #62  Lote B — epics 10-19
        ├── #63  Lote C — epics 20-29
        ├── #64  Lote D — epic-manager-ux
        ├── #65  Lote E — epic-jornada
        ├── #66  Lote F — epic-configuracoes
        ├── #67  Lote G — epic-student-home (28 stories, pode virar 4o nível)
        └── #68  Lote H — epic-engagement-center (17 stories, idem)
```

`#67` e `#68` já nascem com a nota "se for grande demais, quebre de novo" —
mas a quebra em si só acontece se o Fausto (ou quem executar) confirmar que
precisa, não antes.

## Quando quebrar (critérios práticos)

| Sinal | Ação |
|:---|:---|
| A issue-mãe descreve um objetivo, mas tem 3+ entregáveis genuinamente separados | Quebrar em sub-issues, uma por entregável |
| Uma sub-issue lista mais de ~10 itens de checklist, ou cobre mais de ~10-15 arquivos/stories | Considerar quebrar em sub-sub-issues por bloco temático ou por faixa |
| A issue cabe numa sessão de trabalho (algumas horas) sem quebrar o foco | **Não quebrar** — issue única basta |
| Você está quebrando "porque parece mais organizado", sem um entregável real por trás | **Não quebrar** — isso é teatro de estrutura, não ajuda ninguém |

## Como criar (comandos de referência)

Toda issue nova usa o template `.github/ISSUE_TEMPLATE/tarefa-para-agente.md`
(5 blocos: Contexto / Onde Isso Vive / Tarefa / Comandos de Verificação /
Critério de Saída) e é classificada por POP (`docs/GUIA-POPS-EXECUCAO.md`)
antes de qualquer trabalho começar.

Linkar como sub-issue (nativo do GitHub, via GraphQL — a UI também suporta
isso manualmente em "Add sub-issue" dentro da issue-mãe):

```bash
gh api graphql -f query="mutation { addSubIssue(input: {issueId: \"<node-id-da-mae>\", subIssueId: \"<node-id-da-filha>\"}) { issue { number } subIssue { number } } }"
```

O `node-id` (não o número da issue) sai de:

```bash
gh issue view <numero> --repo eximIA-Ventures/eximia-academy-v2 --json id -q .id
```

## Campos de board a preencher em toda issue nova

Status (`Todo` por default — ver `docs/GUIA-STATUS-PROGRESSAO.md` para quando
mudar), Prioridade (P0-P3), Tipo (`Produto`/`Decisão`/...), Epic (o valor do
campo Epic do board, criar novo valor se for uma frente nova), Branch alvo.
