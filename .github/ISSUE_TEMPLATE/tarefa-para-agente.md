---
name: Tarefa para agente
about: Issue autossuficiente, executável por um agente de IA ou por um humano sem nenhum contexto de conversa
title: '[TAREFA] '
---

<!--
  Este template existe para que a issue seja EXECUTÁVEL por quem nunca viu nenhuma
  conversa sobre o assunto — agente de IA ou pessoa. Contrato de 5 blocos nomeados:
  Contexto / Onde Isso Vive / Tarefa / Comandos de Verificação / Critério de Saída,
  cada um suficiente para quem chega frio executar sozinho, sem ida-e-volta.

  Se um dos 5 blocos ficar vago, quem executa trava ou inventa. Preencha os cinco.
  Apague estes comentários antes de publicar a issue.
-->

## Contexto

<!--
  O que quem for executar precisa saber sem ter visto nenhuma conversa:
  situação atual, motivação, decisões já tomadas que restringem a solução.
  Factual, não conversacional.
-->

## Onde Isso Vive

<!--
  Paths EXATOS dos arquivos, pastas e rotas envolvidos — não "no analytics", e sim
  o path literal. Se a issue toca em código já existente, cite o(s) arquivo(s)
  atual(is). Se cria algo novo, cite onde o novo arquivo deve nascer (convenção
  do diretório vizinho). Inclua schema/migration relevante, se houver.

  Exemplo:
    Tela: apps/web/src/app/(platform)/admin/api-keys/page.tsx (já existe)
    Componente: apps/web/src/app/(platform)/admin/api-keys/_components/api-keys-client.tsx
    Nav a editar: apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx
    Schema: packages/database/src/schema/api-keys.ts
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
- [ ] Não toquei em arquivos fora do escopo declarado em "Onde Isso Vive" e "Tarefa"
- [ ] Fiz commit local, sem push (push é revisão do Hugo antes de ir pro remoto)
