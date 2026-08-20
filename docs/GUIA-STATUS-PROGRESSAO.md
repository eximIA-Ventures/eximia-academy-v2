# Guia de progressão de Status — mantenha o board vivo

> O board só serve pra alguma coisa se ele reflete a realidade **enquanto o
> trabalho acontece**, não só no fim. Uma issue que fica em "Todo" até o
> código já estar pronto é um board cego durante 100% do tempo útil dele.

## A regra central

**Assim que você começar a trabalhar numa issue, mova o Status na hora — não
espere terminar para atualizar.** Isso já é convenção estabelecida no
ecossistema eximIA (não é novidade desta run): começou a trabalhar num item,
ele vai para "In Progress" imediatamente; entregou, vai para o próximo status
da cadeia. Sem esperar alguém pedir, sem esperar o fim do dia.

## Os 6 status deste board, em ordem

| Status | Quando usar | Quem move |
|:---|:---|:---|
| `Todo` | Aceito no backlog, ninguém começou ainda | Estado inicial, ninguém precisa mover manualmente para cá |
| `Aguardando decisão` | Bloqueado por escolha do dono do produto, não por trabalho técnico (ex.: #37 Perfis & Permissões, #58 Competências) | Quem descobrir o bloqueio, no momento em que descobrir |
| `In Progress` | Em execução agora — **mova no instante em que abrir o primeiro arquivo pra trabalhar nela**, não no fim | Quem está executando, imediatamente |
| `In Review` | Trabalho terminado do lado de quem implementou, aguardando revisão humana antes do merge | Quem terminou a implementação |
| `Aguardando deploy` | Mergeado mas ainda não no ar — o Rebuild no EasyPanel é passo manual separado (`docs/DEPLOY-GUIDE.md`) | Quem mergeou |
| `Done` | Concluído, revisado e **confirmado no ar** — não é "achei que terminei", é verificado | Quem confirmou em produção |

## Por que isso importa mais do que parece

Sem isso, ninguém — nem você, nem eu, nem quem olhar o board depois — consegue
responder "o que está rodando agora?" sem abrir cada issue uma por uma. Com
Status atualizado em tempo real, a resposta está na coluna "Status" do board,
visível de relance, e o Roadmap (view de datas) reflete progresso real, não
só planejamento.

## Aplicação prática ao trabalhar uma issue (ex.: Fausto nos lotes A-H de #60)

1. Antes de abrir qualquer arquivo: mover a issue para `In Progress`.
2. Terminou de auditar/implementar/corrigir o que a issue pede: mover para
   `In Review` (se depender de revisão humana) ou direto para `Done` (se o
   Critério de Saída já é auto-verificável por comando, como a maioria das
   issues de auditoria `POP-QA-001`).
3. Se descobrir no meio do caminho que a issue está bloqueada por uma decisão
   que não é sua: mover para `Aguardando decisão` e registrar o motivo no
   corpo da issue antes de sair dela.
4. Nunca deixar uma issue "meio feita" em `Todo` — se você tocou nela, ela sai
   de `Todo`.

## Comando de referência (se preferir CLI a UI)

```bash
gh project item-list 3 --owner eximIA-Ventures --format json --limit 100 \
  -q '.items[] | select(.content.number==<numero>) | .id'
# STATUS_FIELD = PVTSSF_lADOD5z26s4Bf4ImzhaHzrQ ; PROJECT_ID = PVT_kwDOD5z26s4Bf4Im
# opções: Todo=caadfec4, Aguardando decisão=57af06f6, In Progress=93de026a,
#         In Review=974c26bf, Aguardando deploy=a9d53930, Done=fcd7d038
gh project item-edit --id <item-id> --field-id PVTSSF_lADOD5z26s4Bf4ImzhaHzrQ \
  --project-id PVT_kwDOD5z26s4Bf4Im --single-select-option-id <id-da-opcao>
```

Ou, mais simples: a própria interface do board (dropdown na coluna Status de
cada linha) — não precisa de CLI para isso no dia a dia.
