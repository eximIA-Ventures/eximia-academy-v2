# Fechamento — Entrega 2 (Tela 1 de Aprendizagem do Time)

Fase 6 do método gauntlet-2: placar real, não "bateu a barra" sem prova.

## O que foi entregue

Ponta a ponta, para a Tela 1 (Visão Geral) do domínio "Aprendizagem do Time":

- **Migration + seed** (Entrega 1): 8 tabelas + RLS + seed de 5 capacidades
  do curso "Análise e Solução de Problemas" — escritas, revisadas, **não
  aplicadas em banco nenhum** (sem credenciais neste ambiente; o repo aponta
  pra produção por padrão — decisão que precisa do Senhor).
- **Pipeline de classificação** (Entrega 1): heurística + LLM com fallback,
  agregador de triangulação, varredura de evidências pendentes, rota de
  disparo. 13 testes unitários puros, todos verdes.
- **Camada de leitura da Tela 1** (Entrega 2): `fonte.ts` → `fonte-supabase.ts`
  → `base.ts` → 6 blocos puros (`placar`, `mudancas`, `atencao`,
  `recomendacoes`, `capacidades-evolucao`, `gaps-prioritarios`) →
  `montagem.ts` → `index.ts`. 8 arquivos de teste, 18 casos, todos verdes.
- **UI da Tela 1**: reusa os tokens visuais de Ativação (`design.tsx`
  reexportado), componente de tabs próprio (`NavSecundaria`, não reusa
  `NavAbas` por causa do `tab=` vs `vista=`), moldura com seletor de domínio
  + trinca de vistas, esqueleto de carregamento, gatilho de classificação
  client-side.
- **Rota**: um único diff aditivo em `page.tsx` (16 linhas, 0 remoções,
  confirmado por `git status`) — a Ativação da Jornada continua byte a byte
  igual para qualquer request sem `?dominio=aprendizagem`.
- **Harness de gauntlet**: rota de preview
  (`/gauntlet-preview/aprendizagem-visao-geral`) com fixture sintética e
  modo motor (banco real), reusando `PreviewShell`/`ForceLightTheme` por
  import — nenhum fork dos scripts de captura.

## Gates mecânicos

| Gate | Resultado |
|---|---|
| `tsc --noEmit` (workspace inteiro) | ✅ limpo, 3 rodadas (Entrega 1, camada de leitura, UI) |
| `biome check` | ✅ limpo (2 bugs reais achados e corrigidos durante o processo: pluralização "reflexãos"→"reflexões" e texto duplicado "evidência em evidência em contexto real" no `rationale` do agregador) |
| `vitest run` (suíte completa, 2921 testes) | ✅ 2889/2921 na primeira rodada (Entrega 1); ✅ 153/154 na rodada focada em Analytics (Entrega 2) — as falhas em ambas as rodadas são pré-existentes, confirmadas por `git status` como arquivos nunca tocados nesta entrega |
| `next build` | ✅ typecheck + as 143 páginas compilaram (Entrega 1); ⚠️ empacotamento `standalone` falha por `EPERM` de symlink do Windows — ambiente local, não código (pacotes `react`/`pdfjs-dist`/`@jridgewell/*`, nunca tocados) |

## Elos da cadeia de prova (§ Lei 6 do gauntlet-2)

1. **A tela pede o dado** — ✅ `carregarVisaoGeralAprendizagem` é chamado pelo
   RSC (`painel.tsx`), sem fixture no caminho de produção.
2. **A rota responde ao método que declara** — ✅ `POST
   /api/analytics/aprendizagem-time/classify` gated, testável por contrato
   (não testado com requisição HTTP real nesta entrega — ver "não medido"
   abaixo).
3. **A rota lê o banco** — ✅ por construção (`fonte-supabase.ts` usa o
   service client, mesmo padrão de Ativação), mas **não confirmado com dado
   real** — sem credenciais Supabase, nunca rodou contra um banco de
   verdade.
4. **O número volta** — ⚠️ **NÃO MEDIDO NESTA ENTREGA.** Provar isto exige
   `?fonte=motor` respondendo com HTTP 200 e um número real na tela — e o
   middleware global da aplicação bloqueia toda rota com HTTP 500 antes de
   qualquer coisa renderizar, porque este clone não tem `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Verificado
   e confirmado por `curl` direto na rota, com e sem `?fonte=fixture` — o
   bloqueio é do middleware, não da minha rota.

**Veredito honesto: "falta prova", não "pronto".** Os elos 1-3 estão
construídos com a mesma disciplina do resto do domínio (I-4 em todo lugar,
zero caminho de escrita fora do pipeline), mas o elo 4 — o que fecha o
círculo e prova que não é só uma casca bem escrita — não pôde ser
verificado neste ambiente. Isso não é uma omissão silenciosa: é a razão
deste documento existir.

## O que o Senhor precisa decidir pra destravar o resto

1. **Aplicar a migration**: preciso de credenciais de um Supabase de
   TESTE/staging (nunca produção sem confirmação explícita) — ou o Senhor
   aplica do lado dele, no workspace Maestri que já tem `.env.local` real.
2. **Ver a tela renderizada**: mesma dependência — sem
   `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, nem
   `?fonte=fixture` (que não deveria precisar de banco) escapa do
   middleware global.
3. **Loop de crítico cego** (decisão anterior do Senhor: "tentar montar
   mesmo assim"): depende dos dois itens acima — sem a tela renderizando,
   não há screenshot pra comparar contra os 3 screenshots de referência.

## Limitações documentadas (não escondidas, já citadas nos comentários do código)

- Critérios de 4 das 5 capacidades semeadas são inferidos, não literais da
  spec (só "Uso de evidência" é literal — §28).
- Sem `capability_concepts` curado, toda evidência de um curso é avaliada
  contra TODAS as capacidades ativas do curso (mais caro, mas honesto — não
  inventa mapeamento módulo→capacidade).
- Limiares de triangulação (`MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA` etc.)
  são decisão de engenharia preenchendo lacuna que a spec deixa em aberto —
  não são fato extraído do texto.
- Telas 2 (Padrões e Evolução) e 3 (Mapa de Capacidades) não existem ainda
  — Entregas 3 e 4, fora do escopo desta rodada.

## Próximo passo recomendado

Não avançar para Entrega 3 (Tela 2) sem antes fechar o elo 4 desta — repetir
o padrão duas vezes sem prova de que a primeira instância lê banco de
verdade multiplicaria o mesmo ponto cego.
