---
name: Tarefa para agente
about: Issue autossuficiente, executável por um agente de IA sem nenhum contexto de conversa
title: '[TAREFA] '
---

<!--
  Este template existe para que a issue seja EXECUTÁVEL por um agente de IA que
  nunca viu nenhuma conversa sobre o assunto. Ele segue o mesmo contrato de
  briefing usado internamente no ecossistema eximIA: 4 blocos nomeados
  (Contexto / Tarefa / Comandos de Verificação / Critério de Saída), cada um
  suficiente para quem chega frio executar sozinho, sem ida-e-volta.

  Se um dos 4 blocos ficar vago, o agente trava ou inventa. Preencha os quatro.
  Apague estes comentários antes de publicar a issue.
-->

## Contexto

<!--
  O que quem for executar precisa saber sem ter visto nenhuma conversa:
  situação atual, motivação, decisões já tomadas que restringem a solução.
  Factual, não conversacional. Cite arquivos por path e símbolos por nome.
-->

## Tarefa

<!--
  Passos executáveis concretos, na ordem certa, sem ambiguidade sobre o que
  fazer primeiro. Inclua aqui o escopo (quais arquivos podem ser tocados) e o
  que explicitamente NÃO fazer.
-->

1.
2.
3.

## Comandos de Verificação

<!--
  Os comandos EXATOS que confirmam que terminou certo, copiáveis e coláveis.
  Nunca "rode os testes" — sempre o comando literal, com o path.
  Exemplos:
    pnpm --filter web test -- src/components/analytics/__tests__/ritmo-badge.test.tsx
    pnpm --filter web typecheck
    pnpm biome check apps/web/src/components/analytics/ritmo-badge.tsx
-->

```bash

```

## Critério de Saída

<!--
  A condição objetiva de "terminei": quando considerar a tarefa concluída e
  PARAR. Deve ser verificável por outra pessoa, não uma sensação.
  Ex.: "o teste X passa, o typecheck passa, e nenhum arquivo fora de
  src/components/analytics/ aparece no git status".
-->

---

## Checklist antes de fechar

- [ ] Rodei os comandos de verificação e todos passaram
- [ ] Não toquei em arquivos fora do escopo declarado acima
- [ ] Fiz commit local, sem push (push é revisão do Hugo antes de ir pro remoto)
