# FIXTURE — Aprendizagem do Time, Tela 1 (Visão Geral)

Descreve o cenário sintético congelado em
`components/analytics/aprendizagem-time/fixture.ts`, usado por
`/gauntlet-preview/aprendizagem-visao-geral?fonte=fixture`.

## Cenário

Curso "Análise e Solução de Problemas", 12 aprendizes elegíveis, período de
30 dias com período anterior comparável (para exercitar os blocos de
tendência em estado `ok`, não `vazio`).

## Valores e por que cada um foi escolhido

| Campo | Valor | Por quê |
|---|---|---|
| Placar — Compreensão | 78% (+14pp) | Mesmo exemplo literal da spec §9.1, fácil de conferir contra o texto original. |
| Placar — Profundidade | 64% (+6pp) | Mesmo exemplo literal §9.2. |
| Placar — Aplicação | 51% (-3pp) | Mesmo exemplo literal §9.3; delta negativo de propósito, para o card de variação exercitar a cor vermelha (`VARIACAO.negativo`) além da verde. |
| Placar — Evolução | 64% (+12pp) | §9.4, mesmo valor da spec. |
| O que mudou | 3 sinais (positivo, neutro, negativo) | Exercita as 3 cores de `CirculoIcone` no mesmo card — se só houvesse sinais positivos, um bug de cor fixa passaria despercebido. |
| O que merece atenção | 2 itens (não 3) | Prova que a lista NÃO precisa estar sempre cheia até o máximo — um card com 2 itens não pode ter um "buraco" visual de um 3º item fantasma. |
| Capacidades com maior evolução | 4 linhas, ordem decrescente de delta | Cobre o teto declarado (§14: "máximo 4"). |
| Gaps prioritários | 2 itens | Mesmo raciocínio do item acima — nunca assumir que a lista está sempre no teto. |

## O que esta fixture NÃO cobre (declarado, para não vestir de "completo")

Os 3 estados de vazio (`amostra-insuficiente`, `sem-tendencia`,
`sem-capacidades-no-curso`) não aparecem aqui — são cobertos pelos testes
`f-03`, `f-04`, `f-05`, `f-20` em `lib/analytics/aprendizagem-time/__tests__/`,
não pela captura visual. Uma fixture que também mostrasse os vazios exigiria
3 rotas de preview adicionais (`?fonte=fixture&caso=vazio-amostra`, etc.) —
não construídas nesta entrega.
